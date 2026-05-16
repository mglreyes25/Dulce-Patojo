-- =============================================================
-- MIGRACIÓN: Módulo de Pedidos, Caja y Mesas (Sprint 3)
-- =============================================================
-- Ejecutar en el SQL Editor de Supabase (Dashboard > SQL Editor)

-- 1. Tabla de mesas
CREATE TABLE IF NOT EXISTS mesas (
  id SERIAL PRIMARY KEY,
  numero INTEGER NOT NULL UNIQUE,
  capacidad INTEGER NOT NULL DEFAULT 4,
  estado VARCHAR(20) NOT NULL DEFAULT 'disponible'
    CHECK (estado IN ('disponible', 'ocupada', 'pagando')),
  creado_en timestamptz DEFAULT now()
);

-- 2. Tabla de pedidos
CREATE TABLE IF NOT EXISTS pedidos (
  id SERIAL PRIMARY KEY,
  numero_ticket INTEGER,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('para_llevar', 'en_mesa', 'para_recoger')),
  mesa_id INTEGER REFERENCES mesas(id) ON DELETE SET NULL,
  cliente_nombre VARCHAR(50),
  estado VARCHAR(20) NOT NULL DEFAULT 'recibido'
    CHECK (estado IN ('recibido', 'en_preparacion', 'listo', 'entregado', 'pagado', 'cancelado')),
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  descuento DECIMAL(10,2) NOT NULL DEFAULT 0,
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  usuario_id INTEGER REFERENCES usuarios(id),
  notas text,
  creado_en timestamptz DEFAULT now(),
  actualizado_en timestamptz DEFAULT now()
);

-- 3. Tabla de items del pedido
CREATE TABLE IF NOT EXISTS pedido_items (
  id SERIAL PRIMARY KEY,
  pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  producto_id INTEGER REFERENCES productos(id) ON DELETE SET NULL,
  combo_id INTEGER REFERENCES combos(id) ON DELETE SET NULL,
  promocion_id INTEGER REFERENCES promociones(id) ON DELETE SET NULL,
  tipo_item VARCHAR(10) NOT NULL CHECK (tipo_item IN ('producto', 'combo', 'promocion')),
  nombre VARCHAR(200) NOT NULL,
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  precio_unitario DECIMAL(10,2) NOT NULL,
  notas VARCHAR(500),
  creado_en timestamptz DEFAULT now()
);

-- 4. Tabla de pagos
CREATE TABLE IF NOT EXISTS pagos (
  id SERIAL PRIMARY KEY,
  pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  metodo VARCHAR(20) NOT NULL CHECK (metodo IN ('efectivo', 'tarjeta')),
  monto_recibido DECIMAL(10,2) NOT NULL,
  cambio DECIMAL(10,2) NOT NULL DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  usuario_id INTEGER REFERENCES usuarios(id),
  creado_en timestamptz DEFAULT now()
);

-- 5. Tabla de tickets (control de numeración correlativa)
CREATE TABLE IF NOT EXISTS tickets (
  id SERIAL PRIMARY KEY,
  pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  numero_ticket INTEGER NOT NULL,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  contador_diario INTEGER NOT NULL,
  creado_en timestamptz DEFAULT now()
);

-- 6. Tabla de cierres de caja
CREATE TABLE IF NOT EXISTS cierres_caja (
  id SERIAL PRIMARY KEY,
  fecha DATE NOT NULL UNIQUE,
  total_pedidos INTEGER NOT NULL DEFAULT 0,
  total_efectivo DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_tarjeta DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_descuentos DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_neto DECIMAL(10,2) NOT NULL DEFAULT 0,
  monto_fisico DECIMAL(10,2),
  diferencia DECIMAL(10,2),
  cerrado_por INTEGER REFERENCES usuarios(id),
  activo BOOLEAN NOT NULL DEFAULT true,
  creado_en timestamptz DEFAULT now()
);

-- 7. Asegurar columnas agregadas en tablas existentes (migración idempotente)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pedidos' AND column_name='numero_pedido')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pedidos' AND column_name='numero_ticket') THEN
    ALTER TABLE pedidos RENAME COLUMN numero_pedido TO numero_ticket;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pedidos' AND column_name='numero_pedido')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pedidos' AND column_name='numero_ticket') THEN
    UPDATE pedidos SET numero_ticket = numero_pedido::integer WHERE numero_ticket IS NULL;
    ALTER TABLE pedidos DROP COLUMN numero_pedido;
  END IF;
END $$;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS numero_ticket INTEGER;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS tipo VARCHAR(20) NOT NULL DEFAULT 'en_mesa';
ALTER TABLE pedidos DROP CONSTRAINT IF EXISTS pedidos_tipo_check;
UPDATE pedidos SET tipo = 'en_mesa' WHERE tipo NOT IN ('para_llevar', 'en_mesa', 'para_recoger');
ALTER TABLE pedidos ADD CONSTRAINT pedidos_tipo_check CHECK (tipo IN ('para_llevar', 'en_mesa', 'para_recoger'));
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS mesa_id INTEGER REFERENCES mesas(id) ON DELETE SET NULL;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cliente_nombre VARCHAR(50);
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS estado VARCHAR(20) NOT NULL DEFAULT 'recibido';
ALTER TABLE pedidos DROP CONSTRAINT IF EXISTS pedidos_estado_check;
UPDATE pedidos SET estado = 'recibido' WHERE estado NOT IN ('recibido', 'en_preparacion', 'listo', 'entregado', 'pagado', 'cancelado');
ALTER TABLE pedidos ADD CONSTRAINT pedidos_estado_check CHECK (estado IN ('recibido', 'en_preparacion', 'listo', 'entregado', 'pagado', 'cancelado'));
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS subtotal DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS descuento DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS total DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS usuario_id INTEGER REFERENCES usuarios(id);
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS notas text;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS actualizado_en timestamptz DEFAULT now();
ALTER TABLE pedido_items ADD COLUMN IF NOT EXISTS notas VARCHAR(500);
ALTER TABLE pedido_items ADD COLUMN IF NOT EXISTS promocion_id INTEGER REFERENCES promociones(id) ON DELETE SET NULL;
ALTER TABLE pedido_items DROP CONSTRAINT IF EXISTS pedido_items_tipo_item_check;
ALTER TABLE pedido_items ADD CONSTRAINT pedido_items_tipo_item_check CHECK (tipo_item IN ('producto', 'combo', 'promocion'));
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS usuario_id INTEGER REFERENCES usuarios(id);
ALTER TABLE cierres_caja ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true;

-- 8. Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_pedidos_estado ON pedidos(estado);
CREATE INDEX IF NOT EXISTS idx_pedidos_fecha ON pedidos(creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_pedidos_mesa ON pedidos(mesa_id);
CREATE INDEX IF NOT EXISTS idx_pedido_items_pedido ON pedido_items(pedido_id);
CREATE INDEX IF NOT EXISTS idx_pagos_pedido ON pagos(pedido_id);
CREATE INDEX IF NOT EXISTS idx_tickets_fecha ON tickets(fecha);
CREATE INDEX IF NOT EXISTS idx_tickets_pedido ON tickets(pedido_id);
CREATE INDEX IF NOT EXISTS idx_cierres_caja_fecha ON cierres_caja(fecha DESC);

-- 8. Insertar mesas predeterminadas (12 mesas)
INSERT INTO mesas (numero, capacidad) VALUES
  (1, 2), (2, 4), (3, 4), (4, 6),
  (5, 2), (6, 4), (7, 4), (8, 6),
  (9, 2), (10, 4), (11, 4), (12, 8)
ON CONFLICT (numero) DO NOTHING;
