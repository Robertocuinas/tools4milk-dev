import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.tools4milk import ResumenRelevo


def get_all(
    db: Session,
    skip: int = 0,
    limit: int = 50,
    turno_saliente_id: str | None = None,
    turno_entrante_id: str | None = None,
) -> list[ResumenRelevo]:
    stmt = select(ResumenRelevo).order_by(ResumenRelevo.ts_generacion.desc())
    if turno_saliente_id:
        try:
            stmt = stmt.where(ResumenRelevo.turno_saliente_id == uuid.UUID(turno_saliente_id))
        except (ValueError, AttributeError):
            return []
    if turno_entrante_id:
        try:
            stmt = stmt.where(ResumenRelevo.turno_entrante_id == uuid.UUID(turno_entrante_id))
        except (ValueError, AttributeError):
            return []
    return list(db.scalars(stmt.offset(skip).limit(limit)).all())


def get_by_id(db: Session, relevo_id: str) -> ResumenRelevo | None:
    try:
        uid = uuid.UUID(relevo_id)
    except (ValueError, AttributeError):
        return None
    return db.get(ResumenRelevo, uid)


def create(db: Session, data: dict) -> ResumenRelevo:
    item = ResumenRelevo(
        id=uuid.uuid4(),
        turno_saliente_id=uuid.UUID(data["turno_saliente_id"]),
        turno_entrante_id=uuid.UUID(data["turno_entrante_id"]),
        ts_generacion=data.get("ts_generacion") or datetime.now(timezone.utc),
        incidencias_abiertas=data.get("incidencias_abiertas") or [],
        tareas_pendientes=data.get("tareas_pendientes") or [],
        alertas_pendientes=data.get("alertas_pendientes") or [],
        notas_saliente=data.get("notas_saliente"),
        confirmado_por=_to_uuid(data.get("confirmado_por")),
        ts_confirmacion=data.get("ts_confirmacion"),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def _to_uuid(value: str | None) -> uuid.UUID | None:
    if not value:
        return None
    try:
        return uuid.UUID(value)
    except (ValueError, AttributeError):
        return None
