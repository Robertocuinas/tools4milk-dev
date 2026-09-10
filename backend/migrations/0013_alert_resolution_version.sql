-- Release 4 R4-2: optimistic versioning for alert resolution.
ALTER TABLE alertas ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE alertas ADD CONSTRAINT alertas_version_positive CHECK (version > 0);
