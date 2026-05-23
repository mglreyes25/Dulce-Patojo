-- =============================================================
-- MIGRACIÓN: Triggers, Log de Estados y Notificaciones (Sprint 4)
-- =============================================================
-- Ejecutar en el SQL Editor de Supabase (Dashboard > SQL Editor)
-- Orden sugerido: después de migracion_pedidos.sql y migracion_iva.sql

-- 1. Tabla de log de cambios de estado (colas de auditoría)
CREATE TABLE IF NOT EXISTS pedidos_estado_log (
  id SERIAL PRIMARY KEY,
  pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  estado_anterior VARCHAR(20),
  estado_nuevo VARCHAR(20) NOT NULL,
  cambiado_por INTEGER REFERENCES usuarios(id),
  nota TEXT,
  creado_en timestamptz DEFAULT now()
);

-- Deshabilitar RLS en tabla de log para que los triggers funcionen
ALTER TABLE pedidos_estado_log DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_pedidos_estado_log_pedido ON pedidos_estado_log(pedido_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_estado_log_creado ON pedidos_estado_log(creado_en DESC);

-- 2. Trigger: al insertar pedido con mesa_id, ocupar la mesa
--    Usa SECURITY DEFINER para que el trigger corra con permisos del owner
--    (bypasea RLS al actualizar mesas)
CREATE OR REPLACE FUNCTION fn_ocupar_mesa_al_crear_pedido()
RETURNS TRIGGER
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.mesa_id IS NOT NULL THEN
    UPDATE mesas SET estado = 'ocupada' WHERE id = NEW.mesa_id AND estado = 'disponible';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ocupar_mesa_al_crear_pedido ON pedidos;
CREATE TRIGGER trg_ocupar_mesa_al_crear_pedido
  AFTER INSERT ON pedidos
  FOR EACH ROW
  WHEN (NEW.mesa_id IS NOT NULL)
  EXECUTE FUNCTION fn_ocupar_mesa_al_crear_pedido();

-- 3. Trigger: al insertar pago, marcar pedido como pagado y liberar mesa
--    SECURITY DEFINER para bypassear RLS en pedidos y mesas
CREATE OR REPLACE FUNCTION fn_pagar_y_liberar_mesa()
RETURNS TRIGGER
SECURITY DEFINER
AS $$
DECLARE
  v_mesa_id INTEGER;
  v_pedido RECORD;
BEGIN
  SELECT * INTO v_pedido FROM pedidos WHERE id = NEW.pedido_id;

  IF v_pedido.estado NOT IN ('pagado', 'cancelado') THEN
    UPDATE pedidos SET estado = 'pagado', actualizado_en = now()
    WHERE id = NEW.pedido_id;

    IF v_pedido.mesa_id IS NOT NULL THEN
      UPDATE mesas SET estado = 'disponible' WHERE id = v_pedido.mesa_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pagar_y_liberar_mesa ON pagos;
CREATE TRIGGER trg_pagar_y_liberar_mesa
  AFTER INSERT ON pagos
  FOR EACH ROW
  EXECUTE FUNCTION fn_pagar_y_liberar_mesa();

-- 4. Trigger: log automático y NOTIFY al cambiar estado del pedido
--    SECURITY DEFINER para poder insertar en pedidos_estado_log
CREATE OR REPLACE FUNCTION fn_log_y_notify_cambio_estado()
RETURNS TRIGGER
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.estado IS DISTINCT FROM NEW.estado THEN
    INSERT INTO pedidos_estado_log (pedido_id, estado_anterior, estado_nuevo)
    VALUES (NEW.id, OLD.estado, NEW.estado);

    PERFORM pg_notify('pedido_estado_cambiado',
      json_build_object(
        'pedido_id', NEW.id,
        'numero_ticket', NEW.numero_ticket,
        'estado_anterior', OLD.estado,
        'estado_nuevo', NEW.estado,
        'mesa_id', NEW.mesa_id
      )::text
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_log_y_notify_cambio_estado ON pedidos;
CREATE TRIGGER trg_log_y_notify_cambio_estado
  AFTER UPDATE OF estado ON pedidos
  FOR EACH ROW
  EXECUTE FUNCTION fn_log_y_notify_cambio_estado();

-- 5. Trigger: NOTIFY al crear nuevo pedido (solo emite NOTIFY, no toca tablas)
CREATE OR REPLACE FUNCTION fn_notify_nuevo_pedido()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify('nuevo_pedido',
    json_build_object(
      'pedido_id', NEW.id,
      'numero_ticket', NEW.numero_ticket,
      'tipo', NEW.tipo,
      'mesa_id', NEW.mesa_id,
      'cliente_nombre', NEW.cliente_nombre,
      'estado', NEW.estado
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_nuevo_pedido ON pedidos;
CREATE TRIGGER trg_notify_nuevo_pedido
  AFTER INSERT ON pedidos
  FOR EACH ROW
  EXECUTE FUNCTION fn_notify_nuevo_pedido();

-- 6. Trigger: NOTIFY al registrar pago (solo emite NOTIFY, no toca tablas)
CREATE OR REPLACE FUNCTION fn_notify_pago_registrado()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify('pago_registrado',
    json_build_object(
      'pago_id', NEW.id,
      'pedido_id', NEW.pedido_id,
      'metodo', NEW.metodo,
      'total', NEW.total,
      'creado_en', NEW.creado_en
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_pago_registrado ON pagos;
CREATE TRIGGER trg_notify_pago_registrado
  AFTER INSERT ON pagos
  FOR EACH ROW
  EXECUTE FUNCTION fn_notify_pago_registrado();

-- 7. Comentarios de uso
COMMENT ON TABLE pedidos_estado_log IS 'Auditoría de cambios de estado de pedidos. La UI/cocina/despachador pueden suscribirse a NOTIFY.';
COMMENT ON FUNCTION fn_ocupar_mesa_al_crear_pedido() IS 'Garantiza que al crear pedido con mesa_id, la mesa pase a ocupada.';
COMMENT ON FUNCTION fn_pagar_y_liberar_mesa() IS 'Garantiza que al registrar pago, el pedido pase a pagado y la mesa se libere.';
