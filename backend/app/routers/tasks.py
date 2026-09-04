import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.tools4milk import TareaCatalogo
from app.repositories import tasks_repository
from app.routers.deps import DbSession, TaskManager
from app.security import get_current_user
from app.services import tasks_service

router = APIRouter(prefix="/api/v1", tags=["Frontend Core"], dependencies=[Depends(get_current_user)])


def _resolve_catalogo_id(db: Session, payload: dict) -> uuid.UUID | None:
    catalog_id_str = payload.get("tarea_catalogo_id")
    if catalog_id_str:
        try:
            uid = uuid.UUID(catalog_id_str)
            if db.get(TareaCatalogo, uid):
                return uid
        except (ValueError, AttributeError):
            pass
    catalog = db.scalar(select(TareaCatalogo).where(TareaCatalogo.activa.is_(True)).limit(1))
    if catalog:
        return catalog.id
    catalog_payload = payload.get("tarea_catalogo") or {}
    catalog = TareaCatalogo(
        id=uuid.uuid4(),
        codigo=str(payload.get("tarea_catalogo_id") or f"task-{uuid.uuid4().hex[:8]}")[:60],
        nombre=str(catalog_payload.get("nombre") or "Tarea operativa")[:150],
        descripcion=catalog_payload.get("descripcion"),
        cualificacion_requerida=catalog_payload.get("categoria"),
        duracion_estimada_min=catalog_payload.get("duracion_estimada_min"),
        activa=True,
    )
    db.add(catalog)
    db.flush()
    return catalog.id


@router.get("/tareas-catalogo", operation_id="list_task_catalog")
def task_catalog(
    db: DbSession,
    activa: bool | None = None,
) -> list[dict[str, Any]]:
    """Return the task catalog (TareaCatalogo). Defaults to active items only."""
    query = select(TareaCatalogo).order_by(TareaCatalogo.nombre)
    if activa is None:
        query = query.where(TareaCatalogo.activa.is_(True))
    elif activa is False:
        pass  # no filter — return all
    else:
        query = query.where(TareaCatalogo.activa.is_(True))
    items = db.scalars(query).all()
    return [
        {
            "id": str(item.id),
            "codigo": item.codigo,
            "nombre": item.nombre,
            "descripcion": item.descripcion,
            "cualificacion_requerida": item.cualificacion_requerida,
            "duracion_estimada_min": item.duracion_estimada_min,
            "activa": item.activa,
        }
        for item in items
    ]


@router.post("/tareas-catalogo", status_code=201)
def create_task_catalog(payload: dict[str, Any], db: DbSession) -> dict[str, Any]:
    """Create a new task catalog item."""
    item = TareaCatalogo(
        id=uuid.uuid4(),
        codigo=payload.get("codigo", f"TASK-{uuid.uuid4().hex[:8].upper()}"),
        nombre=payload.get("nombre"),
        descripcion=payload.get("descripcion"),
        cualificacion_requerida=payload.get("rol_requerido") or payload.get("cualificacion_requerida"),
        duracion_estimada_min=payload.get("duracion_estimada"),
        activa=payload.get("activa", True),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return {
        "id": str(item.id),
        "codigo": item.codigo,
        "nombre": item.nombre,
        "descripcion": item.descripcion,
        "cualificacion_requerida": item.cualificacion_requerida,
        "duracion_estimada_min": item.duracion_estimada_min,
        "activa": item.activa,
    }


@router.put("/tareas-catalogo/{catalog_id}")
def update_task_catalog(catalog_id: str, payload: dict[str, Any], db: DbSession) -> dict[str, Any]:
    """Update a task catalog item."""
    try:
        uid = uuid.UUID(catalog_id)
    except (ValueError, AttributeError):
        raise HTTPException(status_code=400, detail="ID inválido")

    item = db.get(TareaCatalogo, uid)
    if item is None:
        raise HTTPException(status_code=404, detail="Tarea de catálogo no encontrada")

    if "nombre" in payload:
        item.nombre = payload["nombre"]
    if "descripcion" in payload:
        item.descripcion = payload["descripcion"]
    if "rol_requerido" in payload:
        item.cualificacion_requerida = payload["rol_requerido"]
    if "cualificacion_requerida" in payload:
        item.cualificacion_requerida = payload["cualificacion_requerida"]
    if "duracion_estimada" in payload:
        item.duracion_estimada_min = payload["duracion_estimada"]
    if "activa" in payload:
        item.activa = payload["activa"]

    db.commit()
    db.refresh(item)
    return {
        "id": str(item.id),
        "codigo": item.codigo,
        "nombre": item.nombre,
        "descripcion": item.descripcion,
        "cualificacion_requerida": item.cualificacion_requerida,
        "duracion_estimada_min": item.duracion_estimada_min,
        "activa": item.activa,
    }


@router.delete("/tareas-catalogo/{catalog_id}", status_code=204)
def delete_task_catalog(catalog_id: str, db: DbSession) -> None:
    """Delete or deactivate a task catalog item."""
    try:
        uid = uuid.UUID(catalog_id)
    except (ValueError, AttributeError):
        raise HTTPException(status_code=400, detail="ID inválido")

    item = db.get(TareaCatalogo, uid)
    if item is None:
        raise HTTPException(status_code=404, detail="Tarea de catálogo no encontrada")

    # Soft delete: marcar como inactiva en lugar de eliminar
    item.activa = False
    db.commit()


@router.get(
    "/tasks",
    operation_id="list_tasks",
    responses={
        200: {
            "content": {
                "application/json": {
                    "examples": {
                        "sample": {
                            "value": [
                                {
                                    "id": "task-001",
                                    "tarea_catalogo": {"nombre": "Revisar tanque"},
                                    "estado": "programada",
                                }
                            ]
                        }
                    }
                }
            }
        },
        422: {"description": "Parametros invalidos"},
        500: {"description": "Error interno"},
    },
)
def tasks(
    db: DbSession,
    skip: int = 0,
    limit: int = 50,
    estado: str | None = None,
    zona_id: str | None = None,
) -> list[dict[str, Any]]:
    rows = tasks_repository.get_all(db, skip=skip, limit=limit, estado=estado, zona_id=zona_id)
    return [tasks_service.serialize(ejecucion, catalogo) for ejecucion, catalogo in rows]


@router.post("/tasks", status_code=201)
def create_task(payload: dict[str, Any], db: DbSession, _user: TaskManager) -> dict[str, Any]:
    catalogo_id = _resolve_catalogo_id(db, payload)
    if catalogo_id is None:
        raise HTTPException(status_code=400, detail="No hay tareas en el catalogo disponibles")
    ejecucion, catalogo = tasks_repository.create(db, catalogo_id, payload)
    return tasks_service.serialize(ejecucion, catalogo)


@router.get("/tasks/{task_id}")
def task_detail(task_id: str, db: DbSession) -> dict[str, Any]:
    row = tasks_repository.get_by_id(db, task_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    return tasks_service.serialize(row[0], row[1])


@router.put("/tasks/{task_id}")
def update_task(task_id: str, payload: dict[str, Any], db: DbSession, _user: TaskManager) -> dict[str, Any]:
    row = tasks_repository.get_by_id(db, task_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    ejecucion, catalogo = tasks_repository.update(db, row[0], payload)
    return tasks_service.serialize(ejecucion, catalogo)


@router.delete("/tasks/{task_id}", status_code=204)
def delete_task(task_id: str, db: DbSession, _user: TaskManager) -> None:
    row = tasks_repository.get_by_id(db, task_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    tasks_repository.update(db, row[0], {"estado": "cancelada"})
