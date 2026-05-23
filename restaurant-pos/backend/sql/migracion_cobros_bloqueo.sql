-- =============================================================
-- MIGRACIÓN: Bloqueo de Cobros y Vista de Cobros Pendientes
-- Dulce Patojo SAC — Módulo de Caja
-- =============================================================
-- Ejecutar en el SQL Editor de Supabase (Dashboard > SQL Editor)
-- Orden: después de migracion_pedidos.sql, migracion_iva.sql, migracion_triggers_log.sql
-- =============================================================

-- 1. Tabla de bloqueo de cobros (pesimistic locking)
CREATE TABLE IF NOT EXISTS cobros_bloqueo (
  id SERIAL PRIMARY KEY,
  pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  iniciado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_cobros_bloqueo_pedido UNIQUE (pedido_id)
);

CREATE INDEX IF NOT EXISTS idx_cobros_bloqueo_pedido ON cobros_bloqueo(pedido_id);
CREATE INDEX IF NOT EXISTS idx_cobros_bloqueo_usuario ON cobros_bloqueo(usuario_id);

COMMENT ON TABLE cobros_bloqueo IS 'Bloqueo pesimista de pedidos para evitar cobros duplicados por múltiples cajeros';
COMMENT ON COLUMN cobros_bloqueo.iniciado_en IS 'Momento en que se inició el cobro, usado para timeout';

-- 2. Vista de cobros pendientes (pedidos cobrables + info de bloqueo)
CREATE OR REPLACE VIEW vw_cobros_pendientes AS
SELECT
  p.id,
  p.numero_ticket,
  p.tipo,
  p.mesa_id,
  p.cliente_nombre,
  p.estado,
  p.subtotal,
  p.descuento,
  p.total,
  p.iva,
  p.total_con_iva,
  p.usuario_id AS pedido_usuario_id,
  p.creado_en,
  p.actualizado_en,
  p.notas,
  p.direccion_entrega,
  p.telefono_contacto,
  p.cargo_envio,
  m.numero AS mesa_numero,
  cb.usuario_id AS bloqueo_usuario_id,
  cb.iniciado_en AS bloqueo_iniciado_en,
  u.nombre AS bloqueado_por_nombre,
  COALESCE(
    (SELECT json_agg(json_build_object(
      'id', pi.id,
      'nombre', pi.nombre,
      'cantidad', pi.cantidad,
      'precio_unitario', pi.precio_unitario,
      'tipo_item', pi.tipo_item,
      'notas', pi.notas
     ) ORDER BY pi.id)
     FROM pedido_items pi WHERE pi.pedido_id = p.id),
    '[]'::json
  ) AS items_resumen
FROM pedidos p
LEFT JOIN mesas m ON m.id = p.mesa_id
LEFT JOIN cobros_bloqueo cb ON cb.pedido_id = p.id
LEFT JOIN usuarios u ON u.id = cb.usuario_id
WHERE p.estado IN ('listo', 'entregado')
ORDER BY
  CASE WHEN cb.pedido_id IS NOT NULL THEN 0 ELSE 1 END,
  p.creado_en ASC;

COMMENT ON VIEW vw_cobros_pendientes IS 'Pedidos pendientes de cobro (estados listo/entregado) con información de bloqueo activo';

-- 3. Función: Iniciar cobro (bloqueo atómico)
CREATE OR REPLACE FUNCTION fn_iniciar_cobro(
  p_pedido_id INTEGER,
  p_usuario_id INTEGER
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_pedido RECORD;
  v_bloqueo_existente RECORD;
  v_usuario_nombre VARCHAR;
BEGIN
  -- Validar pedido existe y es cobrable
  SELECT * INTO v_pedido FROM pedidos WHERE id = p_pedido_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 404, 'error', 'Pedido no encontrado');
  END IF;

  IF v_pedido.estado = 'pagado' THEN
    RETURN jsonb_build_object('success', false, 'code', 400, 'error', 'El pedido ya está pagado');
  END IF;

  IF v_pedido.estado = 'cancelado' THEN
    RETURN jsonb_build_object('success', false, 'code', 400, 'error', 'El pedido está cancelado');
  END IF;

  IF v_pedido.estado NOT IN ('listo', 'entregado') THEN
    RETURN jsonb_build_object('success', false, 'code', 400, 'error', 'El pedido no está en estado cobrable (listo/entregado)');
  END IF;

  -- Verificar bloqueo existente
  SELECT cb.*, u.nombre INTO v_bloqueo_existente
  FROM cobros_bloqueo cb
  JOIN usuarios u ON u.id = cb.usuario_id
  WHERE cb.pedido_id = p_pedido_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', false, 'code', 409,
      'error', format('El pedido #%s ya está siendo cobrado por %s', v_pedido.numero_ticket, v_bloqueo_existente.nombre),
      'bloqueado_por', v_bloqueo_existente.usuario_id,
      'bloqueado_por_nombre', v_bloqueo_existente.nombre,
      'bloqueo_iniciado_en', v_bloqueo_existente.iniciado_en
    );
  END IF;

  -- Obtener nombre del usuario que solicita
  SELECT nombre INTO v_usuario_nombre FROM usuarios WHERE id = p_usuario_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 400, 'error', 'Usuario no encontrado');
  END IF;

  -- Insertar bloqueo
  INSERT INTO cobros_bloqueo (pedido_id, usuario_id)
  VALUES (p_pedido_id, p_usuario_id);

  -- Cambiar estado de mesa a 'pagando' si aplica
  IF v_pedido.mesa_id IS NOT NULL THEN
    UPDATE mesas SET estado = 'pagando' WHERE id = v_pedido.mesa_id;
  END IF;

  -- Registrar en bitacora
  INSERT INTO bitacora_permisos (usuario_id, accion, descripcion)
  VALUES (p_usuario_id, 'INICIAR_COBRO',
    format('Inicio de cobro pedido #%s por %s', v_pedido.numero_ticket, v_usuario_nombre));

  RETURN jsonb_build_object(
    'success', true, 'code', 200,
    'pedido_id', p_pedido_id,
    'usuario_id', p_usuario_id,
    'usuario_nombre', v_usuario_nombre,
    'iniciado_en', now()
  );
END;
$$;

COMMENT ON FUNCTION fn_iniciar_cobro IS 'Bloquea un pedido para cobro exclusivo por un cajero. Cambia mesa a pagando. Retorna error 409 si ya bloqueado.';

-- 4. Función: Liberar bloqueo de cobro manualmente
CREATE OR REPLACE FUNCTION fn_liberar_bloqueo(
  p_pedido_id INTEGER,
  p_usuario_id INTEGER,
  p_es_admin BOOLEAN DEFAULT false
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_bloqueo RECORD;
  v_pedido RECORD;
BEGIN
  SELECT cb.* INTO v_bloqueo FROM cobros_bloqueo cb WHERE cb.pedido_id = p_pedido_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 404, 'error', 'No hay bloqueo activo para este pedido');
  END IF;

  -- Solo el dueño del bloqueo o admin pueden liberar
  IF v_bloqueo.usuario_id != p_usuario_id AND NOT p_es_admin THEN
    RETURN jsonb_build_object('success', false, 'code', 403, 'error', 'No tienes permiso para liberar este bloqueo');
  END IF;

  DELETE FROM cobros_bloqueo WHERE pedido_id = p_pedido_id;

  -- Restaurar estado de mesa si sigue ocupada/pagando
  SELECT * INTO v_pedido FROM pedidos WHERE id = p_pedido_id;
  IF v_pedido.mesa_id IS NOT NULL AND v_pedido.estado NOT IN ('pagado', 'cancelado') THEN
    UPDATE mesas SET estado = 'ocupada' WHERE id = v_pedido.mesa_id AND estado = 'pagando';
  END IF;

  INSERT INTO bitacora_permisos (usuario_id, accion, descripcion)
  VALUES (p_usuario_id, 'LIBERAR_BLOQUEO',
    format('Bloqueo liberado pedido #%s', v_pedido.numero_ticket));

  RETURN jsonb_build_object('success', true, 'code', 200, 'pedido_id', p_pedido_id);
END;
$$;

COMMENT ON FUNCTION fn_liberar_bloqueo IS 'Libera manualmente un bloqueo de cobro. Solo el usuario que bloqueó o un admin pueden hacerlo.';

-- 5. Trigger: Limpiar bloqueo automáticamente al registrar pago
CREATE OR REPLACE FUNCTION fn_limpiar_bloqueo_al_pagar()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM cobros_bloqueo WHERE pedido_id = NEW.pedido_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_limpiar_bloqueo_al_pagar ON pagos;
CREATE TRIGGER trg_limpiar_bloqueo_al_pagar
  AFTER INSERT ON pagos
  FOR EACH ROW
  EXECUTE FUNCTION fn_limpiar_bloqueo_al_pagar();

COMMENT ON FUNCTION fn_limpiar_bloqueo_al_pagar IS 'Limpia automáticamente el bloqueo cuando se registra un pago para ese pedido.';

-- 6. Trigger: NOTIFY cuando se inicia un cobro (para actualización en tiempo real)
CREATE OR REPLACE FUNCTION fn_notify_cobro_iniciado()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_numero_ticket INTEGER;
  v_usuario_nombre VARCHAR;
BEGIN
  SELECT numero_ticket INTO v_numero_ticket FROM pedidos WHERE id = NEW.pedido_id;
  SELECT nombre INTO v_usuario_nombre FROM usuarios WHERE id = NEW.usuario_id;

  PERFORM pg_notify('cobro_iniciado',
    json_build_object(
      'pedido_id', NEW.pedido_id,
      'numero_ticket', v_numero_ticket,
      'usuario_id', NEW.usuario_id,
      'usuario_nombre', v_usuario_nombre,
      'iniciado_en', NEW.iniciado_en
    )::text
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_cobro_iniciado ON cobros_bloqueo;
CREATE TRIGGER trg_notify_cobro_iniciado
  AFTER INSERT ON cobros_bloqueo
  FOR EACH ROW
  EXECUTE FUNCTION fn_notify_cobro_iniciado();

-- 7. Trigger: NOTIFY cuando se libera un bloqueo
CREATE OR REPLACE FUNCTION fn_notify_bloqueo_liberado()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_numero_ticket INTEGER;
BEGIN
  SELECT numero_ticket INTO v_numero_ticket FROM pedidos WHERE id = OLD.pedido_id;

  PERFORM pg_notify('bloqueo_liberado',
    json_build_object(
      'pedido_id', OLD.pedido_id,
      'numero_ticket', v_numero_ticket
    )::text
  );
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_bloqueo_liberado ON cobros_bloqueo;
CREATE TRIGGER trg_notify_bloqueo_liberado
  AFTER DELETE ON cobros_bloqueo
  FOR EACH ROW
  EXECUTE FUNCTION fn_notify_bloqueo_liberado();

-- 8. Job de limpieza (recomendado — ejecutar como cron cada 5 minutos)
--    Libera automáticamente bloqueos con más de N minutos de antigüedad
CREATE OR REPLACE FUNCTION fn_limpiar_bloqueos_expirados(
  p_timeout_minutos INTEGER DEFAULT 10
) RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM cobros_bloqueo
  WHERE iniciado_en < now() - (p_timeout_minutos || ' minutes')::INTERVAL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION fn_limpiar_bloqueos_expirados IS 'Limpia bloqueos más antiguos que p_timeout_minutos. Llamar desde cron job. Retorna cantidad de bloqueos eliminados.';
