ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS role VARCHAR(40) DEFAULT 'operario';
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS debe_cambiar_contrasena BOOLEAN DEFAULT FALSE;

UPDATE usuarios
SET role = 'operario'
WHERE role IS NULL;

CREATE INDEX IF NOT EXISTS ix_usuarios_role ON usuarios (role);
