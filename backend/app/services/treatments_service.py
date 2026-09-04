from typing import Any
from app.models.tools4milk import TratamientoActivo


def serialize(t: TratamientoActivo) -> dict[str, Any]:
    return {
        "id": str(t.id),
        "animal_id": str(t.animal_id),
        "medicamento": t.farmaco,
        "dosis": t.dosis,
        "via_administracion": t.via_administracion,
        "fecha_inicio": t.fecha_inicio.isoformat() if t.fecha_inicio else None,
        "fecha_fin": t.fecha_fin_prevista.isoformat() if t.fecha_fin_prevista else None,
        "periodo_retirada_dias": None,
        "fecha_fin_retirada": None,
        "activo": t.activo,
        "motivo": None,
        "veterinario": str(t.prescrito_por) if t.prescrito_por else None,
        "observaciones": t.notas,
    }
