-- Migración: campos de calidad y zona para animales/lactaciones
-- Añade zona_id a animales (para conteo por zona)
-- Añade grasa/proteína/RCS a lactaciones (para pantalla de calidad)

ALTER TABLE animales
    ADD COLUMN IF NOT EXISTS zona_id UUID REFERENCES zonas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_animales_zona_id ON animales(zona_id);

ALTER TABLE lactaciones
    ADD COLUMN IF NOT EXISTS grasa_promedio    NUMERIC(5,3),
    ADD COLUMN IF NOT EXISTS proteina_promedio NUMERIC(5,3),
    ADD COLUMN IF NOT EXISTS rcs_promedio      INTEGER;
