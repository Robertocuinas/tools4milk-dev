from typing import Any
from app.models.tools4milk import Incidencia


def serialize(i: Incidencia) -> dict[str, Any]:
    return {
        "id": str(i.id),
        "tipo": i.tipo,
        "zona_id": str(i.zona_id) if i.zona_id else None,
        "animal_id": str(i.animal_id) if i.animal_id else None,
        "descripcion": i.descripcion or i.titulo,
        "prioridad": i.severidad,
        "estado": i.estado,
        "fecha_creacion": i.ts_apertura.isoformat() if i.ts_apertura else None,
        "fecha_resolucion": i.ts_cierre.isoformat() if i.ts_cierre else None,
        "resolucion": None,
        "reportado_por": str(i.reportado_por) if i.reportado_por else None,
    }
