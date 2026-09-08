"""Operación manual del scheduler sintético (solo demo/staging)."""
from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.routers.deps import AdminOnly
from app.synthetic_data import SCENARIOS
from app.synthetic_scheduler import (
    SchedulerRequest,
    reset_synthetic,
    run_once,
    scheduler_status,
    set_paused,
)

router = APIRouter(prefix="/api/v1/admin/synthetic", tags=["Synthetic scheduler"])
Db = Annotated[Session, Depends(get_db)]


def _guard_demo() -> None:
    if settings.environment.lower() == "production":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Synthetic scheduler is disabled in production")


@router.get("/scheduler")
def get_scheduler_status(_user: AdminOnly, db: Db) -> dict[str, Any]:
    _guard_demo()
    return scheduler_status(db)


@router.post("/scheduler/run")
def execute_scheduler(
    _user: AdminOnly,
    db: Db,
    profile: str = Query(default="small", pattern="^(small|demo|load)$"),
    scenario: str = Query(default="normal"),
    seed: int = Query(default=20260602),
    horizon_days: int = Query(default=7, ge=1, le=365),
) -> dict[str, Any]:
    _guard_demo()
    if scenario not in SCENARIOS:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Unknown synthetic scenario")
    return run_once(db, SchedulerRequest(profile=profile, scenario=scenario, seed=seed, horizon_days=horizon_days))


@router.post("/scheduler/pause")
def pause_scheduler(_user: AdminOnly, db: Db) -> dict[str, Any]:
    _guard_demo()
    return set_paused(db, True)


@router.post("/scheduler/resume")
def resume_scheduler(_user: AdminOnly, db: Db) -> dict[str, Any]:
    _guard_demo()
    return set_paused(db, False)


@router.post("/reset")
def reset_scheduler_data(_user: AdminOnly, db: Db) -> dict[str, int]:
    _guard_demo()
    return reset_synthetic(db)