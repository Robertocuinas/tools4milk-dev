-- Migración: crear tabla datos_metereologicos, requerida por el modelo
-- app.models.datos_metereologicos.DatosMetereologicos.
--
-- Esta tabla es un espejo histórico de las lecturas de AEMET con metadatos
-- de geolocalización y origen (latitud/longitud/ubicacion/fuente), separada
-- de lecturas_meteorologia (que se centra en series temporales y se replica
-- desde el cliente AEMET). Hasta ahora la tabla no estaba declarada en
-- init.sql ni en migraciones, pero aemet_client intentaba insertar filas
-- tras cada sync, lo que rompía con ``relation does not exist``.
--
-- El esquema es Postgres-first (usa TIMESTAMPTZ y tipos nativos) y se crea
-- de forma idempotente. En SQLite el modelo declara columnas nativas
-- equivalentes que se crean vía ``Base.metadata.create_all`` al arrancar.

CREATE TABLE IF NOT EXISTS datos_metereologicos (
    id                 BIGSERIAL    PRIMARY KEY,
    fecha_hora         TIMESTAMPTZ  NULL,
    temperatura_media  DOUBLE PRECISION NULL,
    temperatura_maxima DOUBLE PRECISION NULL,
    temperatura_minima DOUBLE PRECISION NULL,
    humedad_relativa   DOUBLE PRECISION NULL,
    precipitacion      DOUBLE PRECISION NULL,
    velocidad_viento   DOUBLE PRECISION NULL,
    presion_atmosferica DOUBLE PRECISION NULL,
    estado_cielo       VARCHAR(120) NULL,
    ubicacion          VARCHAR(160) NOT NULL DEFAULT 'Villalba, Lugo',
    latitud            DOUBLE PRECISION NULL,
    longitud           DOUBLE PRECISION NULL,
    fuente             VARCHAR(80)  NULL
);

CREATE INDEX IF NOT EXISTS idx_datos_met_fecha
    ON datos_metereologicos (fecha_hora DESC);
CREATE INDEX IF NOT EXISTS idx_datos_met_ubicacion
    ON datos_metereologicos (ubicacion);