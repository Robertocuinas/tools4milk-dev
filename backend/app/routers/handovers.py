from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Usuario
from app.repositories import handovers_repository
from app.security import get_current_user
from app.services import handovers_service

router = APIRouter(prefix="/api/v1/resumenes-relevo", tags=["resumenes-relevo"])

DbDep = Annotated[Session, Depends(get_db)]
UserDep = Annotated[Usuario, Depends(get_current_user)]


@router.get("")
def list_resumenes(
    db: DbDep,
    current_user: UserDep,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    turno_saliente_id: str | None = Query(None),
    turno_entrante_id: str | None = Query(None),
) -> dict[str, Any]:
    items = handovers_repository.get_all(
        db, skip=skip, limit=limit,
        turno_saliente_id=turno_saliente_id,
        turno_entrante_id=turno_entrante_id,
    )
    return {"total": len(items), "resumenes": [handovers_service.serialize(r) for r in items]}


@router.post("")
def create_resumen(body: dict, db: DbDep, current_user: UserDep) -> dict[str, Any]:
    for required in ("turno_saliente_id", "turno_entrante_id"):
        if not body.get(required):
            raise HTTPException(status_code=422, detail=f"El campo '{required}' es obligatorio")
    try:
        item = handovers_repository.create(db, body)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return handovers_service.serialize(item)
