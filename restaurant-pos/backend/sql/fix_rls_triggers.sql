-- =============================================================
-- FIX: Error 42501 — RLS en funciones de trigger
-- =============================================================
-- Ejecutar SOLO si ya corriste migracion_triggers_log.sql
-- y obtienes error "new row violates row-level security policy"
-- =============================================================

-- 1. Deshabilitar RLS en tabla de log
ALTER TABLE pedidos_estado_log DISABLE ROW LEVEL SECURITY;

-- 2. Recrear funciones con SECURITY DEFINER para bypassear RLS
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

-- Verificación
SELECT proname, prosecdef FROM pg_proc WHERE proname LIKE 'fn_%' ORDER BY proname;
