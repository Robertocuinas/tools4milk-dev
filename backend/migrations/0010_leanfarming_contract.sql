-- LeanFarming Release 1: canonical task contract and synthetic provenance.
-- Compatibility: legacy vencida/cancelada remain readable; new writes use the
-- four canonical states pendiente, en_curso, verificacion, completada.
DO $$ BEGIN
    ALTER TYPE estado_tarea ADD VALUE IF NOT EXISTS 'verificacion';
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE tareas_ejecuciones
    ADD COLUMN IF NOT EXISTS duracion_estimada_min INTEGER,
    ADD COLUMN IF NOT EXISTS duracion_real_min INTEGER,
    ADD COLUMN IF NOT EXISTS prioridad SMALLINT NOT NULL DEFAULT 3,
    ADD COLUMN IF NOT EXISTS turno_id UUID REFERENCES turnos(id);

CREATE INDEX IF NOT EXISTS idx_ejecuciones_turno ON tareas_ejecuciones(turno_id);
CREATE INDEX IF NOT EXISTS idx_ejecuciones_prioridad ON tareas_ejecuciones(prioridad);

CREATE TABLE IF NOT EXISTS synthetic_provenance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(40) NOT NULL,
    entity_id UUID NOT NULL,
    source VARCHAR(80) NOT NULL,
    generator_version VARCHAR(30) NOT NULL,
    scenario_id VARCHAR(80) NOT NULL,
    random_seed INTEGER NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL,
    simulation_time TIMESTAMPTZ NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::JSONB,
    CONSTRAINT uq_synthetic_provenance_entity UNIQUE (entity_type, entity_id)
);
CREATE INDEX IF NOT EXISTS idx_synthetic_provenance_source
    ON synthetic_provenance(source, scenario_id);

ALTER TABLE tareas_ejecuciones
    ADD CONSTRAINT chk_ejecuciones_duracion_estimada
    CHECK (duracion_estimada_min IS NULL OR duracion_estimada_min > 0);
ALTER TABLE tareas_ejecuciones
    ADD CONSTRAINT chk_ejecuciones_duracion_real
    CHECK (duracion_real_min IS NULL OR duracion_real_min >= 0);
ALTER TABLE tareas_ejecuciones
    ADD CONSTRAINT chk_ejecuciones_prioridad
    CHECK (prioridad BETWEEN 1 AND 5);
