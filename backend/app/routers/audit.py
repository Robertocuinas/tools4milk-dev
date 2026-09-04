from datetime import datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Usuario
from app.models.tools4milk import AuditLog
from app.security import require_roles

router = APIRouter(prefix="/api/v1", tags=["audit"])

DbDep = Annotated[Session, Depends(get_db)]
# El registro de auditoría es exclusivo de administradores.
UserDep = Annotated[Usuario, Depends(require_roles("admin"))]


@router.get("/audit-log")
def get_audit_log(
    db: DbDep,
    current_user: UserDep,
    tabla: str | None = Query(None, description="Filtrar por tabla afectada"),
    accion: str | None = Query(None, description="Filtrar por operación: INSERT, UPDATE, DELETE"),
    usuario_bd: str | None = Query(None, description="Filtrar por usuario de base de datos"),
    fecha_desde: datetime | None = Query(None, description="Fecha inicio (ISO 8601)"),
    fecha_hasta: datetime | None = Query(None, description="Fecha fin (ISO 8601)"),
    limit: int = Query(100, ge=1, le=1000, description="Número máximo de registros"),
) -> dict[str, Any]:
    stmt = select(AuditLog).order_by(AuditLog.ts.desc())

    if tabla:
        stmt = stmt.where(AuditLog.tabla_afectada == tabla)
    if accion:
        stmt = stmt.where(AuditLog.operacion == accion.upper())
    if usuario_bd:
        stmt = stmt.where(AuditLog.usuario_bd == usuario_bd)
    if fecha_desde:
        stmt = stmt.where(AuditLog.ts >= fecha_desde)
    if fecha_hasta:
        stmt = stmt.where(AuditLog.ts <= fecha_hasta)

    stmt = stmt.limit(limit)
    rows = db.execute(stmt).scalars().all()

    return {
        "total": len(rows),
        "limit": limit,
        "registros": [
            {
                "id": r.id,
                "ts": r.ts.isoformat() if r.ts else None,
                "tabla_afectada": r.tabla_afectada,
                "operacion": r.operacion,
                "registro_id": str(r.registro_id),
                "datos_anteriores": r.datos_anteriores,
                "datos_nuevos": r.datos_nuevos,
                "usuario_bd": r.usuario_bd,
                "hash_sha256": r.hash_sha256,
            }
            for r in rows
        ],
    }
