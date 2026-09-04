import uuid
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.tools4milk import Animal, TratamientoActivo


def get_all(
    db: Session,
    skip: int = 0,
    limit: int = 50,
    animal_id: str | None = None,
    activo: bool | None = None,
) -> list[TratamientoActivo]:
    query = select(TratamientoActivo).order_by(TratamientoActivo.fecha_inicio.desc())
    if animal_id is not None:
        try:
            query = query.where(TratamientoActivo.animal_id == uuid.UUID(animal_id))
        except (ValueError, AttributeError):
            return []
    if activo is not None:
        query = query.where(TratamientoActivo.activo.is_(activo))
    return list(db.scalars(query.offset(skip).limit(limit)).all())


def get_by_id(db: Session, treatment_id: str) -> TratamientoActivo | None:
    try:
        uid = uuid.UUID(treatment_id)
    except (ValueError, AttributeError):
        return None
    return db.get(TratamientoActivo, uid)


def create(db: Session, data: dict) -> TratamientoActivo:
    fecha_inicio = _parse_date(data.get("fecha_inicio")) or date.today()
    fecha_fin = _parse_date(data.get("fecha_fin")) or (fecha_inicio + timedelta(days=1))
    dias = max((fecha_fin - fecha_inicio).days, 1)

    item = TratamientoActivo(
        id=uuid.uuid4(),
        animal_id=_resolve_animal_uuid(db, data["animal_id"]),
        farmaco=data.get("medicamento") or data.get("farmaco", "Desconocido"),
        dosis=data.get("dosis"),
        via_administracion=data.get("via_administracion"),
        dias_tratamiento=dias,
        fecha_inicio=fecha_inicio,
        fecha_fin_prevista=fecha_fin,
        activo=bool(data.get("activo", True)),
        checkboxes=[],
        prescrito_por=_to_uuid(data.get("veterinario")),
        notas=data.get("observaciones") or data.get("motivo"),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def update(db: Session, item: TratamientoActivo, data: dict) -> TratamientoActivo:
    if "medicamento" in data or "farmaco" in data:
        item.farmaco = data.get("medicamento") or data.get("farmaco") or item.farmaco
    if "dosis" in data:
        item.dosis = data["dosis"]
    if "via_administracion" in data:
        item.via_administracion = data["via_administracion"]
    if "fecha_fin" in data:
        nueva_fin = _parse_date(data["fecha_fin"])
        if nueva_fin:
            item.fecha_fin_prevista = nueva_fin
            item.dias_tratamiento = max((nueva_fin - item.fecha_inicio).days, 1)
    if "activo" in data:
        item.activo = bool(data["activo"])
        if not item.activo and item.fecha_fin_real is None:
            item.fecha_fin_real = date.today()
    if "observaciones" in data or "motivo" in data:
        item.notas = data.get("observaciones") or data.get("motivo")
    if "veterinario" in data:
        item.prescrito_por = _to_uuid(data["veterinario"])
    db.commit()
    db.refresh(item)
    return item


def _parse_date(value: str | date | None) -> date | None:
    if value is None:
        return None
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value)[:10])
    except (ValueError, TypeError):
        return None


def _to_uuid(value: str | None) -> uuid.UUID | None:
    if not value:
        return None
    try:
        return uuid.UUID(value)
    except (ValueError, AttributeError):
        return None


def _resolve_animal_uuid(db: Session, value: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except (ValueError, AttributeError):
        animal = db.scalar(select(Animal).where(Animal.crotal_oficial == value))
        if animal is None:
            raise ValueError("Animal no encontrado")
        return animal.id
