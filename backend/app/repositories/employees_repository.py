import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.tools4milk import Empleado


def get_all(db: Session, activo: bool | None = None) -> list[Empleado]:
    query = select(Empleado).order_by(Empleado.nombre)
    if activo is not None:
        query = query.where(Empleado.activo.is_(activo))
    return list(db.scalars(query).all())


def get_by_id(db: Session, employee_id: str) -> Empleado | None:
    try:
        uid = uuid.UUID(employee_id)
    except (ValueError, AttributeError):
        return None
    return db.get(Empleado, uid)


def create(db: Session, data: dict) -> Empleado:
    item = Empleado(
        id=uuid.uuid4(),
        nombre=data["nombre"],
        apellidos=data.get("apellidos", ""),
        rol=data.get("role") or data.get("rol", "auxiliar"),
        cualificaciones=data.get("cualificaciones", []),
        telefono=data.get("telefono"),
        email=data.get("email"),
        activo=bool(data.get("activo", True)),
        fecha_alta=date.today(),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def update(db: Session, item: Empleado, data: dict) -> Empleado:
    allowed = {"nombre", "apellidos", "rol", "role", "cualificaciones", "telefono", "email", "activo"}
    for key, value in data.items():
        if key == "role":
            item.rol = value
        elif key in allowed:
            setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return item
