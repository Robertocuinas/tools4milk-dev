-- Release 2: versionado optimista y deduplicación durable de mutaciones.
ALTER TABLE tareas_ejecuciones ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE tareas_ejecuciones ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE tareas_ejecuciones ADD CONSTRAINT tareas_ejecuciones_version_positive CHECK (version > 0);

CREATE TABLE IF NOT EXISTS operation_dedupe (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    operation_id UUID NOT NULL,
    actor_user_id UUID NOT NULL REFERENCES usuarios(id),
    resource_type VARCHAR(40) NOT NULL,
    resource_id UUID NOT NULL,
    request_hash CHAR(64) NOT NULL,
    status VARCHAR(20) NOT NULL,
    response_status SMALLINT NOT NULL CHECK (response_status BETWEEN 100 AND 599),
    response_body JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT operation_dedupe_actor_operation_unique UNIQUE (actor_user_id, operation_id)
);
CREATE INDEX IF NOT EXISTS idx_operation_dedupe_resource ON operation_dedupe(resource_type, resource_id);