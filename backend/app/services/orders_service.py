from decimal import Decimal
from typing import Any

from app.models.tools4milk import Pedido


def serialize(p: Pedido) -> dict[str, Any]:
    return {
        "id": str(p.id),
        "insumo": p.insumo,
        "descripcion": p.descripcion,
        "cantidad": float(p.cantidad) if isinstance(p.cantidad, Decimal) else p.cantidad,
        "unidad": p.unidad,
        "estado": p.estado,
        "solicitante_id": str(p.solicitante_id) if p.solicitante_id else None,
        "ts_solicitud": p.ts_solicitud.isoformat() if p.ts_solicitud else None,
        "ts_aprobacion": p.ts_aprobacion.isoformat() if p.ts_aprobacion else None,
        "ts_recepcion": p.ts_recepcion.isoformat() if p.ts_recepcion else None,
        "proveedor": p.proveedor,
        "coste_estimado": float(p.coste_estimado) if isinstance(p.coste_estimado, Decimal) else p.coste_estimado,
        "coste_real": float(p.coste_real) if isinstance(p.coste_real, Decimal) else p.coste_real,
        "notas": p.notas,
    }
