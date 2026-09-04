from typing import Any
from app.models.tools4milk import Empleado


def serialize(e: Empleado) -> dict[str, Any]:
    return {
        "id": str(e.id),
        "nombre": e.nombre,
        "apellidos": e.apellidos,
        "role": e.rol,
        "zona_principal_id": str(e.zona_principal_id) if getattr(e, "zona_principal_id", None) else None,
        "activo": e.activo,
    }
