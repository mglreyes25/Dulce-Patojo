-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: Agregar campo cantidad_maxima a promociones
-- Dulce Patojo SAC — Happy Hour
-- ═══════════════════════════════════════════════════════════════
-- Ejecutar en el Dashboard de Supabase > SQL Editor
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE promociones ADD COLUMN IF NOT EXISTS cantidad_maxima INTEGER;

COMMENT ON COLUMN promociones.cantidad_maxima IS 'Cantidad máxima de productos a los que aplica la promoción (ej: Happy Hour)';

NOTIFY pgrst, 'reload schema';
