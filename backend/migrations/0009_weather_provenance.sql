-- Origen inequívoco de cada lectura meteorológica.
ALTER TABLE lecturas_meteorologia
    ADD COLUMN IF NOT EXISTS fuente VARCHAR(40) NOT NULL DEFAULT 'generated';

ALTER TABLE datos_metereologicos
    ADD COLUMN IF NOT EXISTS fuente VARCHAR(80) NOT NULL DEFAULT 'generated';