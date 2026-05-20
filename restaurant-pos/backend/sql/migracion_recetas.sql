-- ═══════════════════════════════════════════════════════════════
-- Migración: Ingredientes y Recetas (Fase 4)
-- Dulce Patojo SAC — Sistema de Inventario Completo
-- ═══════════════════════════════════════════════════════════════

-- 1. TABLA ingredientes
CREATE TABLE IF NOT EXISTS ingredientes (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(200) NOT NULL,
  unidad VARCHAR(50) NOT NULL DEFAULT 'unidad', -- kg, g, l, ml, unidad, pieza, etc.
  stock DECIMAL(12,3) NOT NULL DEFAULT 0,
  stock_minimo DECIMAL(12,3) NOT NULL DEFAULT 0,
  precio_compra DECIMAL(12,2) NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ingredientes_activo ON ingredientes(activo) WHERE deleted_at IS NULL;

-- 2. TABLA recetas (relaciona producto → ingrediente + cantidad)
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

-- 3. TABLA movimientos_ingredientes (bitácora de stock de ingredientes)
CREATE TABLE IF NOT EXISTS movimientos_ingredientes (
  id SERIAL PRIMARY KEY,
  ingrediente_id INTEGER NOT NULL REFERENCES ingredientes(id) ON DELETE CASCADE,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('entrada', 'salida', 'ajuste')),
  cantidad DECIMAL(12,3) NOT NULL,
  stock_anterior DECIMAL(12,3) NOT NULL DEFAULT 0,
  stock_nuevo DECIMAL(12,3) NOT NULL DEFAULT 0,
  descripcion TEXT,
  referencia_tipo VARCHAR(50), -- 'pedido', 'compra', 'ajuste'
  referencia_id INTEGER,
  usuario_id INTEGER REFERENCES usuarios(id),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mov_ingredientes_ingrediente ON movimientos_ingredientes(ingrediente_id);
CREATE INDEX IF NOT EXISTS idx_mov_ingredientes_fecha ON movimientos_ingredientes(creado_en);

-- 4. TABLA proveedores
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

-- 5. Agregar columna proveedor_id a ingredientes (después de creada la tabla)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ingredientes' AND column_name = 'proveedor_id'
  ) THEN
    ALTER TABLE ingredientes ADD COLUMN proveedor_id INTEGER REFERENCES proveedores(id);
  END IF;
END $$;
