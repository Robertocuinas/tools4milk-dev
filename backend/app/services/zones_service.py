from typing import Any
from app.models.tools4milk import Zona


def serialize(z: Zona) -> dict[str, Any]:
    return {
        "id": str(z.id),
        "nombre": z.nombre,
        "codigo": z.codigo,
        "descripcion": z.descripcion,
        "tipo": None,
        "tiene_pantalla_tv": z.tiene_pantalla_tv,
        "tiene_tablet": z.tiene_tablet,
        "activa": True,
    }
