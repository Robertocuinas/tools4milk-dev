from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from app.database import Base
from app.models.tools4milk import SyntheticProvenance, TareaEjecucion, Turno
from app.synthetic_data import GenerationRequest, generate_dataset
from app.synthetic_loader import load_dataset


def test_synthetic_dataset_load_is_transactional_and_idempotent():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    dataset = generate_dataset(GenerationRequest(profile="small"))

    with Session(engine) as db:
        first = load_dataset(db, dataset)
        second = load_dataset(db, dataset)
        assert first == second
        assert first["base"] == {"zones": 3, "employees": 3, "catalog": 6}
        assert first["events"] == {"shifts": 60, "assignments": 60, "tasks": 6}
        assert db.scalar(select(func.count()).select_from(Turno)) == 60
        assert db.scalar(select(func.count()).select_from(TareaEjecucion)) == 6
        assert db.scalar(select(func.count()).select_from(SyntheticProvenance)) == 3 + 3 + 6 + 60 + 60 + 6


def test_synthetic_loader_rejects_records_without_provenance():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    dataset = generate_dataset(GenerationRequest(profile="small"))
    del dataset["zones"][0]["provenance"]

    with Session(engine) as db:
        try:
            load_dataset(db, dataset)
        except ValueError as exc:
            assert "provenance" in str(exc)
        else:
            raise AssertionError("a dataset without provenance must be rejected")
        assert db.scalar(select(func.count()).select_from(SyntheticProvenance)) == 0
