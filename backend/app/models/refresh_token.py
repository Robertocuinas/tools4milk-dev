import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.time_utils import utc_now


class RefreshToken(Base):
    """Refresh tokens persistidos con estado (rotación + revocación).

    El flujo de R12 es:
    1. ``POST /auth/login`` emite un access token (corto) y un refresh
       token (largo) — ambos como JWT. El refresh se persiste aquí.
    2. ``POST /auth/refresh`` recibe el refresh, lo marca ``revoked_at``
       y emite un par nuevo. Si el refresh ya estaba revocado, se
       interpreta como reuso (token robado) y se revocan TODOS los
       refresh del usuario.
    3. ``POST /auth/logout`` revoca el refresh actual sin emitir uno
       nuevo.

    El ``jti`` (claim del JWT) es la clave de búsqueda — único, indexado.
    ``revoked_at`` distinto de NULL = consumido. ``expires_at`` se
    chequea en cada uso aunque la fecha del JWT ya está firmada, porque
    un admin podría querer acortar TTLs sin re-firmar tokens.
    """

    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("usuarios.id", ondelete="CASCADE"), index=True
    )
    jti: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Origen de la emisión (user agent, IP). Útil para investigar
    # actividad sospechosa en el log de auditoría.
    emitido_desde_ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )

    @property
    def is_revoked(self) -> bool:
        return self.revoked_at is not None

    @property
    def is_expired(self) -> bool:
        # SQLite no preserva tz en columnas DateTime(timezone=True).
        # Comparamos en UTC naive para que la propiedad sea portable.
        from app.time_utils import utc_now

        stored = self.expires_at
        if stored is None:
            return True
        if stored.tzinfo is not None:
            stored = stored.replace(tzinfo=None)
        return stored <= utc_now().replace(tzinfo=None)
