from typing import Any
from app.models.tools4milk import Animal


def serialize(a: Animal) -> dict[str, Any]:
    return {
        "id": str(a.id),
        "crotal_oficial": a.crotal_oficial,
        "nombre": a.nombre,
        "sexo": a.sexo,
        "fecha_nacimiento": a.fecha_nacimiento.isoformat() if a.fecha_nacimiento else None,
        "raza": a.raza,
        "estado": a.estado,
        "estado_reproductivo": a.estado_reproductivo,
        "fecha_entrada": a.fecha_entrada.isoformat() if a.fecha_entrada else None,
        "fecha_baja": a.fecha_baja.isoformat() if a.fecha_baja else None,
        "zona_id": str(a.zona_id) if getattr(a, "zona_id", None) else None,
        "motivo_baja": a.motivo_baja,
        "notas": a.notas,
    }
