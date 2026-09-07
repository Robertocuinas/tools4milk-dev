-- 0009 — Tabla refresh_tokens para R12 (rotación + revocación de tokens).
--
-- El flujo de R12:
--   1. POST /api/v1/auth/login emite un access token (corto) y un refresh
--      token (largo). El refresh se persiste aquí con su jti (claim único
--      del JWT) y expires_at.
--   2. POST /api/v1/auth/refresh recibe el refresh actual, lo marca
--      revoked_at = now() y emite un par (access, refresh) nuevo. Si el
--      refresh ya estaba revocado se interpreta como reuso (token robado)
--      y se revocan TODOS los refresh del usuario.
--   3. POST /api/v1/auth/logout marca revoked_at en el refresh actual sin
--      emitir uno nuevo.
--
-- La tabla se crea vacía: la rotación comienza con la primera sesión
-- emitida tras desplegar este cambio. Los tokens existentes (los emitidos
-- con el flujo anterior, sólo access) siguen siendo válidos hasta su
-- expiración natural — ningún usuario queda bloqueado.

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id              UUID PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    jti             VARCHAR(64) NOT NULL UNIQUE,
    expires_at      TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at      TIMESTAMP WITH TIME ZONE,
    emitido_desde_ip VARCHAR(64),
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Búsquedas por usuario para la rotación y para "revocar todo".
CREATE INDEX IF NOT EXISTS ix_refresh_tokens_user_active
    ON refresh_tokens (user_id, revoked_at, expires_at);

-- Limpieza periódica: tarea cron / job de mantenimiento que borra tokens
-- revocados o expirados hace más de 90 días para que la tabla no crezca
-- sin límite. No se automatiza aquí para mantener la migración pura SQL.
