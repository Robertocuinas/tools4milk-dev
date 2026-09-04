from typing import Any
from app.models.tools4milk import Alerta


def serialize(a: Alerta) -> dict[str, Any]:
    if a.ts_resolucion:
        estado = "resuelta"
    elif a.activa:
        estado = "pendiente"
    else:
        estado = "revisada"

    return {
        "id": str(a.id),
        "animal_id": str(a.animal_id) if a.animal_id else None,
        "tipo_alerta": a.titulo,
        "severidad": a.nivel,
        "descripcion": a.mensaje or "",
        "recomendacion": None,
        "estado": estado,
        "confianza_prediccion": None,
        "requiere_escalacion": a.nivel in {"alta"},
        "fecha_creacion": a.ts_generacion.isoformat() if a.ts_generacion else None,
        "fecha_revision": a.ts_resolucion.isoformat() if a.ts_resolucion else None,
        "revisada": a.ts_resolucion is not None or not a.activa,
        "notas_operario": None,
        "accion_tomada": None,
        "veterinario_responsable": None,
    }
