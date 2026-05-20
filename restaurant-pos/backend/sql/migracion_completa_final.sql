-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN COMPLETA FINAL — Dulce Patojo SAC v1.0.0
-- Ejecutar en el Dashboard de Supabase > SQL Editor
-- ═══════════════════════════════════════════════════════════════
-- Este script es IDEMPOTENTE (puede ejecutarse múltiples veces
-- sin dañar datos existentes).
-- ═══════════════════════════════════════════════════════════════

-- 1. REFRESCAR CACHE DE PostgREST (necesario si se crearon tablas nuevas)
NOTIFY pgrst, 'reload schema';

-- 2. TABLA ingredientes
CREATE TABLE IF NOT EXISTS ingredientes (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(200) NOT NULL,
  unidad VARCHAR(50) NOT NULL DEFAULT 'unidad',
  stock DECIMAL(12,3) NOT NULL DEFAULT 0,
  stock_minimo DECIMAL(12,3) NOT NULL DEFAULT 0,
  precio_compra DECIMAL(12,2) NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_ingredientes_activo ON ingredientes(activo) WHERE deleted_at IS NULL;

-- 3. TABLA recetas
CREATE TABLE IF NOT EXISTS recetas (
  id SERIAL PRIMARY KEY,
  producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  ingrediente_id INTEGER NOT NULL REFERENCES ingredientes(id) ON DELETE CASCADE,
  cantidad DECIMAL(12,3) NOT NULL DEFAULT 1,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(producto_id, ingrediente_id)
);
CREATE INDEX IF NOT EXISTS idx_recetas_producto ON recetas(producto_id);
CREATE INDEX IF NOT EXISTS idx_recetas_ingrediente ON recetas(ingrediente_id);

-- 4. TABLA movimientos_ingredientes
CREATE TABLE IF NOT EXISTS movimientos_ingredientes (
  id SERIAL PRIMARY KEY,
  ingrediente_id INTEGER NOT NULL REFERENCES ingredientes(id) ON DELETE CASCADE,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('entrada', 'salida', 'ajuste')),
  cantidad DECIMAL(12,3) NOT NULL,
  stock_anterior DECIMAL(12,3) NOT NULL DEFAULT 0,
  stock_nuevo DECIMAL(12,3) NOT NULL DEFAULT 0,
  descripcion TEXT,
  referencia_tipo VARCHAR(50),
  referencia_id INTEGER,
  usuario_id INTEGER REFERENCES usuarios(id),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mov_ingredientes_ingrediente ON movimientos_ingredientes(ingrediente_id);
CREATE INDEX IF NOT EXISTS idx_mov_ingredientes_fecha ON movimientos_ingredientes(creado_en);

-- 5. TABLA proveedores
CREATE TABLE IF NOT EXISTS proveedores (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(200) NOT NULL,
  contacto VARCHAR(200),
  telefono VARCHAR(50),
  correo VARCHAR(200),
  direccion TEXT,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- 6. Agregar proveedor_id a ingredientes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ingredientes' AND column_name = 'proveedor_id'
  ) THEN
    ALTER TABLE ingredientes ADD COLUMN proveedor_id INTEGER REFERENCES proveedores(id);
  END IF;
END $$;

-- 7. TABLA impuestos
CREATE TABLE IF NOT EXISTS impuestos (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  tasa DECIMAL(5,3) NOT NULL DEFAULT 0.130,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO impuestos (nombre, tasa) VALUES ('IVA', 0.130) ON CONFLICT DO NOTHING;

-- 8. Agregar columnas IVA a productos
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'productos' AND column_name = 'exento_iva') THEN
    ALTER TABLE productos ADD COLUMN exento_iva BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
END $$;

-- 9. Agregar columnas IVA a pedidos
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pedidos' AND column_name = 'iva') THEN
    ALTER TABLE pedidos ADD COLUMN iva DECIMAL(12,2) NOT NULL DEFAULT 0;
    ALTER TABLE pedidos ADD COLUMN total_con_iva DECIMAL(12,2) NOT NULL DEFAULT 0;
  END IF;
END $$;

-- 10. Agregar columnas IVA a pagos
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pagos' AND column_name = 'iva') THEN
    ALTER TABLE pagos ADD COLUMN iva DECIMAL(12,2) NOT NULL DEFAULT 0;
    ALTER TABLE pagos ADD COLUMN subtotal_sin_iva DECIMAL(12,2) NOT NULL DEFAULT 0;
    ALTER TABLE pagos ADD COLUMN total_con_iva DECIMAL(12,2) NOT NULL DEFAULT 0;
  END IF;
END $$;

-- 11. Agregar columnas de domicilio a pedidos
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pedidos' AND column_name = 'direccion_entrega') THEN
    ALTER TABLE pedidos ADD COLUMN direccion_entrega TEXT;
    ALTER TABLE pedidos ADD COLUMN telefono_contacto VARCHAR(50);
    ALTER TABLE pedidos ADD COLUMN cargo_envio DECIMAL(12,2) NOT NULL DEFAULT 0;
  END IF;
END $$;

-- 12. Agregar columna propina a pagos
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pagos' AND column_name = 'propina') THEN
    ALTER TABLE pagos ADD COLUMN propina DECIMAL(12,2) NOT NULL DEFAULT 0;
  END IF;
END $$;

-- 13. Agregar columna tipo 'domicilio' al CHECK de pedidos
ALTER TABLE pedidos DROP CONSTRAINT IF EXISTS pedidos_tipo_check;
UPDATE pedidos SET tipo = 'en_mesa' WHERE tipo NOT IN ('para_llevar', 'en_mesa', 'para_recoger', 'domicilio');
ALTER TABLE pedidos ADD CONSTRAINT pedidos_tipo_check CHECK (tipo IN ('para_llevar', 'en_mesa', 'para_recoger', 'domicilio'));

-- 14. Agregar métodos de pago adicionales al CHECK de pagos
ALTER TABLE pagos DROP CONSTRAINT IF EXISTS pagos_metodo_check;
UPDATE pagos SET metodo = 'efectivo' WHERE metodo NOT IN ('efectivo', 'tarjeta', 'qr', 'billetera_digital', 'transferencia');
ALTER TABLE pagos ADD CONSTRAINT pagos_metodo_check CHECK (metodo IN ('efectivo', 'tarjeta', 'qr', 'billetera_digital', 'transferencia'));

-- 15. Refrescar schema cache nuevamente
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload schema';
