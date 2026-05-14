-- =============================================================
-- MIGRACIÓN: Módulo de Inventario
-- =============================================================
-- Ejecutar en el SQL Editor de Supabase (Dashboard > SQL Editor)

-- 1. Agregar columnas de stock a la tabla productos
ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS stock integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stock_minimo integer DEFAULT 0;

-- 2. Crear tabla de movimientos de inventario
CREATE TABLE IF NOT EXISTS inventario_movimientos (
  id SERIAL PRIMARY KEY,
  producto_id integer REFERENCES productos(id) ON DELETE CASCADE,
  tipo varchar(20) NOT NULL CHECK (tipo IN ('entrada', 'salida', 'ajuste')),
  cantidad integer NOT NULL,
  stock_anterior integer NOT NULL,
  stock_nuevo integer NOT NULL,
  descripcion text,
  usuario_id integer REFERENCES usuarios(id),
  creado_en timestamptz DEFAULT now()
);

-- 3. Índice para búsquedas rápidas por producto
CREATE INDEX IF NOT EXISTS idx_inventario_movimientos_producto
  ON inventario_movimientos(producto_id);

-- 4. Índice por fecha (descendente)
CREATE INDEX IF NOT EXISTS idx_inventario_movimientos_fecha
  ON inventario_movimientos(creado_en DESC);
