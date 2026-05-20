-- ═══════════════════════════════════════════════════════════════
-- Migración: IVA 13%, métodos de pago, tipo domicilio
-- Dulce Patojo SAC — Mejoras Contables
-- ═══════════════════════════════════════════════════════════════

-- 1. TABLA impuestos
CREATE TABLE IF NOT EXISTS impuestos (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  tasa DECIMAL(5,3) NOT NULL DEFAULT 0.130, -- 13% IVA
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insertar IVA por defecto
INSERT INTO impuestos (nombre, tasa) VALUES ('IVA', 0.130)
ON CONFLICT DO NOTHING;

-- 2. Agregar columna exento_iva a productos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'productos' AND column_name = 'exento_iva'
  ) THEN
    ALTER TABLE productos ADD COLUMN exento_iva BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
END $$;

-- 3. Agregar columna iva y total_con_iva a pedidos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pedidos' AND column_name = 'iva'
  ) THEN
    ALTER TABLE pedidos ADD COLUMN iva DECIMAL(12,2) NOT NULL DEFAULT 0;
    ALTER TABLE pedidos ADD COLUMN total_con_iva DECIMAL(12,2) NOT NULL DEFAULT 0;
  END IF;
END $$;

-- 4. Agregar columna iva, subtotal_sin_iva, total_con_iva a pagos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pagos' AND column_name = 'iva'
  ) THEN
    ALTER TABLE pagos ADD COLUMN iva DECIMAL(12,2) NOT NULL DEFAULT 0;
    ALTER TABLE pagos ADD COLUMN subtotal_sin_iva DECIMAL(12,2) NOT NULL DEFAULT 0;
    ALTER TABLE pagos ADD COLUMN total_con_iva DECIMAL(12,2) NOT NULL DEFAULT 0;
  END IF;
END $$;

-- 5. Agregar columna tipo_domicilio a pedidos (además de 'para_llevar', 'en_mesa', 'para_recoger')
--    y campos para dirección de entrega
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pedidos' AND column_name = 'direccion_entrega'
  ) THEN
    ALTER TABLE pedidos ADD COLUMN direccion_entrega TEXT;
    ALTER TABLE pedidos ADD COLUMN telefono_contacto VARCHAR(50);
    ALTER TABLE pedidos ADD COLUMN cargo_envio DECIMAL(12,2) NOT NULL DEFAULT 0;
  END IF;
END $$;

-- 6. Agregar columna propina a pagos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pagos' AND column_name = 'propina'
  ) THEN
    ALTER TABLE pagos ADD COLUMN propina DECIMAL(12,2) NOT NULL DEFAULT 0;
  END IF;
END $$;
