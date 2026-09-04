from typing import Any
from app.models.tools4milk import Maquinaria


def serialize(m: Maquinaria) -> dict[str, Any]:
    return {
        "id": str(m.id),
        "nombre": m.nombre,
        "tipo": m.tipo,
        "zona_id": str(m.zona_id) if m.zona_id else None,
        "estado": m.estado if m.activa else "baja",
        "proxima_revision": None,
        "observaciones": m.notas,
    }
