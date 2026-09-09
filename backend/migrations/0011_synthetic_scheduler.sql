-- Scheduler sintético Release 1: estado observable y métricas de ejecución.
CREATE TABLE IF NOT EXISTS synthetic_scheduler_state (
    id SMALLINT PRIMARY KEY,
    paused BOOLEAN NOT NULL DEFAULT FALSE,
    last_started_at TIMESTAMPTZ,
    last_finished_at TIMESTAMPTZ,
    last_duration_ms INTEGER,
    last_created INTEGER NOT NULL DEFAULT 0,
    last_skipped INTEGER NOT NULL DEFAULT 0,
    last_errors INTEGER NOT NULL DEFAULT 0,
    last_error VARCHAR(500),
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS synthetic_scheduler_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    started_at TIMESTAMPTZ NOT NULL,
    finished_at TIMESTAMPTZ NOT NULL,
    duration_ms INTEGER NOT NULL CHECK (duration_ms >= 0),
    profile VARCHAR(20) NOT NULL,
    scenario VARCHAR(80) NOT NULL,
    seed INTEGER NOT NULL,
    created INTEGER NOT NULL DEFAULT 0,
    skipped INTEGER NOT NULL DEFAULT 0,
    errors INTEGER NOT NULL DEFAULT 0,
    error_class VARCHAR(80)
);
CREATE INDEX IF NOT EXISTS idx_synthetic_scheduler_runs_finished
    ON synthetic_scheduler_runs(finished_at DESC);

INSERT INTO synthetic_scheduler_state (id, updated_at)
VALUES (1, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;