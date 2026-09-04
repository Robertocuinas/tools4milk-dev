-- Migración: separar probabilidad de precipitación de la precipitación acumulada.
-- Dialect: PostgreSQL
--
-- La predicción diaria de AEMET devuelve PROBABILIDAD de precipitación (%), no mm
-- acumulados. Antes ese valor se guardaba incorrectamente en precipitacion_mm.
-- Añadimos una columna específica prob_precipitacion_pct y dejamos precipitacion_mm
-- para precipitación acumulada real (cuando exista una fuente que la aporte).

ALTER TABLE lecturas_meteorologia
    ADD COLUMN IF NOT EXISTS prob_precipitacion_pct NUMERIC(5,1);
