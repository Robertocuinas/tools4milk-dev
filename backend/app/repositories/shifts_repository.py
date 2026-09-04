import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.enums import TipoTurno
from app.models.tools4milk import AsignacionTurno, Turno


# ---------------------------------------------------------------------------
# Turnos
# ---------------------------------------------------------------------------

def get_all_turnos(
    db: Session,
    skip: int = 0,
    limit: int = 50,
    fecha=None,
    tipo_turno: str | None = None,
) -> list[Turno]:
    stmt = select(Turno).order_by(Turno.fecha.desc(), Turno.hora_inicio)
    if fecha:
        stmt = stmt.where(Turno.fecha == _parse_date(fecha))
    if tipo_turno:
        try:
            stmt = stmt.where(Turno.tipo_turno == TipoTurno(tipo_turno))
        except ValueError:
            pass
    return list(db.scalars(stmt.offset(skip).limit(limit)).all())


def get_turno_by_id(db: Session, turno_id: str) -> Turno | None:
    try:
        uid = uuid.UUID(turno_id)
    except (ValueError, AttributeError):
        return None
    return db.get(Turno, uid)


def create_turno(db: Session, data: dict) -> Turno:
    raw = data["tipo_turno"]
    tipo = TipoTurno(raw) if raw in (e.value for e in TipoTurno) else TipoTurno.MANANA
    item = Turno(
        id=uuid.uuid4(),
        fecha=_parse_date(data["fecha"]),
        tipo_turno=tipo,
        hora_inicio=data["hora_inicio"],
        hora_fin=data["hora_fin"],
        notas=data.get("notas"),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


# ---------------------------------------------------------------------------
# Asignaciones de turno
# ---------------------------------------------------------------------------

def get_all_asignaciones(
    db: Session,
    skip: int = 0,
    limit: int = 50,
    turno_id: str | None = None,
    empleado_id: str | None = None,
) -> list[AsignacionTurno]:
    stmt = select(AsignacionTurno)
    if turno_id:
        try:
            stmt = stmt.where(AsignacionTurno.turno_id == uuid.UUID(turno_id))
        except (ValueError, AttributeError):
            return []
    if empleado_id:
        try:
            stmt = stmt.where(AsignacionTurno.empleado_id == uuid.UUID(empleado_id))
        except (ValueError, AttributeError):
            return []
    return list(db.scalars(stmt.offset(skip).limit(limit)).all())


def create_asignacion(db: Session, data: dict) -> AsignacionTurno:
    turno_uid = uuid.UUID(data["turno_id"])
    empleado_uid = uuid.UUID(data["empleado_id"])
    item = AsignacionTurno(
        id=uuid.uuid4(),
        turno_id=turno_uid,
        empleado_id=empleado_uid,
        zona_id=_to_uuid(data.get("zona_id")),
        rol=data.get("rol"),
    )
    db.add(item)
    try:
        db.commit()
    except IntegrityError:
        # El empleado ya esta asignado a este turno (UniqueConstraint
        # turno_id+empleado_id). Hacemos la operacion idempotente devolviendo
        # la asignacion existente en lugar de propagar el error.
        db.rollback()
        existing = db.scalar(
            select(AsignacionTurno).where(
                AsignacionTurno.turno_id == turno_uid,
                AsignacionTurno.empleado_id == empleado_uid,
            )
        )
        if existing is not None:
            return existing
        raise
    db.refresh(item)
    return item


def _parse_date(value) -> date:
    if isinstance(value, date):
        return value
    return date.fromisoformat(str(value)[:10])


def _to_uuid(value: str | None) -> uuid.UUID | None:
    if not value:
        return None
    try:
        return uuid.UUID(value)
    except (ValueError, AttributeError):
        return None
