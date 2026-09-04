-- PostgreSQL migration
-- Dialect: PostgreSQL
-- Migracion: anadir zona_principal_id a tabla empleados.
-- Permite asignar zona habitual a cada empleado para compatibilidad en LeanFarming.
ALTER TABLE empleados
ADD COLUMN IF NOT EXISTS zona_principal_id UUID;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_empleados_zona_principal') THEN IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'empleados_zona_principal_id_fkey') THEN ALTER TABLE empleados RENAME CONSTRAINT empleados_zona_principal_id_fkey TO fk_empleados_zona_principal; ELSE ALTER TABLE empleados ADD CONSTRAINT fk_empleados_zona_principal FOREIGN KEY (zona_principal_id) REFERENCES zonas(id) ON DELETE SET NULL; END IF; END IF; END $$;

CREATE INDEX IF NOT EXISTS ix_empleados_zona_principal_id ON empleados(zona_principal_id);
