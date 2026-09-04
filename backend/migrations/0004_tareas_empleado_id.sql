-- Migración: confirmar columna empleado_id en tareas_ejecuciones
-- La columna ya existe en el esquema tools4milk original.
-- Esta migración es un no-op seguro que registra la versión.
-- El índice usa IF NOT EXISTS para ser idempotente.
CREATE INDEX IF NOT EXISTS ix_tareas_ejecuciones_empleado_id ON tareas_ejecuciones(empleado_id);
