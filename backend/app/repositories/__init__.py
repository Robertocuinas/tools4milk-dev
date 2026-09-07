"""Repositorios de acceso a datos.

Cada módulo expone funciones de utilidad que reciben un ``Session`` de
SQLAlchemy y devuelven modelos ORM (o listas). El paquete los reexporta
para permitir ``from app.repositories import animals_repository`` y
``from app import animals_repository`` indistintamente.

Patrón de uso (routers):

    from app.repositories import animals_repository
    animal = animals_repository.get_by_id(db, animal_id)
"""
from app.repositories import (
    alerts_repository,
    animals_repository,
    employees_repository,
    handovers_repository,
    incidents_repository,
    lactations_repository,
    machinery_repository,
    orders_repository,
    shifts_repository,
    tasks_repository,
    treatments_repository,
    zones_repository,
)

__all__ = [
    "alerts_repository",
    "animals_repository",
    "employees_repository",
    "handovers_repository",
    "incidents_repository",
    "lactations_repository",
    "machinery_repository",
    "orders_repository",
    "shifts_repository",
    "tasks_repository",
    "treatments_repository",
    "zones_repository",
]