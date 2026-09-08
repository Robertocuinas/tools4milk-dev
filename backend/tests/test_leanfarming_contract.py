import uuid

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.database import Base
from app.models.tools4milk import TareaCatalogo
from app.repositories.tasks_repository import create, update


def test_task_transition_contract_rejects_invalid_transition():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        catalog = TareaCatalogo(id=uuid.uuid4(), codigo="contract-test", nombre="Contrato")
        db.add(catalog)
        db.commit()
        task, _ = create(db, catalog.id, {"estado": "pendiente"})
        task, _ = update(db, task, {"estado": "completada"})
        assert task.estado == "completada"

        task, _ = create(db, catalog.id, {"estado": "pendiente"})
        task, _ = update(db, task, {"estado": "en_curso"})
        task, _ = update(db, task, {"estado": "pendiente"})
        task, _ = update(db, task, {"estado": "en_curso"})
        task, _ = update(db, task, {"estado": "verificacion"})
        try:
            update(db, task, {"estado": "pendiente"})
        except ValueError as exc:
            assert "transición inválida" in str(exc)
        else:
            raise AssertionError("verificacion -> pendiente debe rechazarse")
