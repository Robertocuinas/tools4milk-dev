from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from app.database import Base
from app.models.tools4milk import SchedulerRun, SyntheticProvenance, TareaEjecucion, TareaRecurrente
from app.synthetic_scheduler import SchedulerRequest, reset_synthetic, run_once, scheduler_status, set_paused


def test_scheduler_retries_are_idempotent_and_observable():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        first = run_once(db, SchedulerRequest(profile="small", horizon_days=2))
        second = run_once(db, SchedulerRequest(profile="small", horizon_days=2))

        assert first["status"] == "ok"
        assert first["created"] == 12
        assert second["created"] == 0
        assert second["skipped"] == 12
        assert scheduler_status(db)["last_execution"]["errors"] == 0
        assert db.scalar(select(func.count()).select_from(TareaRecurrente)) == 6
        assert db.scalar(select(func.count()).select_from(TareaEjecucion)) == 18
        assert db.scalar(select(func.count()).select_from(SchedulerRun)) == 2


def test_scheduler_pause_and_reset_only_remove_synthetic_rows():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        set_paused(db, True)
        assert run_once(db, SchedulerRequest(profile="small", horizon_days=1))["status"] == "paused"
        set_paused(db, False)
        run_once(db, SchedulerRequest(profile="small", horizon_days=1))
        result = reset_synthetic(db)
        assert result["tasks"] == 12
        assert result["recurrences"] == 6
        assert db.scalar(select(func.count()).select_from(SyntheticProvenance)) == 0