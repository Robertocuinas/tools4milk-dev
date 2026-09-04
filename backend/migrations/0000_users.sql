CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY,
    username VARCHAR(80) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    role VARCHAR(40) DEFAULT 'operario' NOT NULL,
    activo BOOLEAN DEFAULT TRUE NOT NULL,
    debe_cambiar_contrasena BOOLEAN DEFAULT FALSE NOT NULL,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS role VARCHAR(40) DEFAULT 'operario';
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS debe_cambiar_contrasena BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS ix_usuarios_username ON usuarios (username);
CREATE INDEX IF NOT EXISTS ix_usuarios_email ON usuarios (email);
CREATE INDEX IF NOT EXISTS ix_usuarios_role ON usuarios (role);
