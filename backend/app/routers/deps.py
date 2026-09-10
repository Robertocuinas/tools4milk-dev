"""Dependencias FastAPI compartidas por los routers de dominio.

Centraliza la sesión de base de datos y los controles de acceso por rol que antes
estaban duplicados en frontend_core.py.
"""

from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Usuario
from app.security import require_roles

DbSession = Annotated[Session, Depends(get_db)]
AdminOnly = Annotated[Usuario, Depends(require_roles("admin"))]
AnimalManager = Annotated[Usuario, Depends(require_roles("admin", "veterinario"))]
TaskManager = Annotated[Usuario, Depends(require_roles("admin", "operario", "alimentacion"))]
ClinicalManager = Annotated[Usuario, Depends(require_roles("admin", "veterinario"))]
QualityManager = Annotated[Usuario, Depends(require_roles("admin", "veterinario", "alimentacion"))]
QualityReader = Annotated[Usuario, Depends(require_roles("admin", "veterinario", "operario", "alimentacion"))]
OperationsManager = Annotated[Usuario, Depends(require_roles("admin", "operario", "alimentacion"))]
PredictionReader = Annotated[Usuario, Depends(require_roles("admin", "veterinario", "alimentacion"))]
WeatherReader = Annotated[Usuario, Depends(require_roles("admin", "veterinario", "operario", "alimentacion"))]
OrderReader = Annotated[Usuario, Depends(require_roles("admin", "operario", "alimentacion"))]
OrderManager = Annotated[Usuario, Depends(require_roles("admin", "alimentacion"))]
ShiftReader = Annotated[Usuario, Depends(require_roles("admin", "operario", "alimentacion", "veterinario"))]
ShiftManager = Annotated[Usuario, Depends(require_roles("admin"))]
HandoverReader = Annotated[Usuario, Depends(require_roles("admin", "operario", "alimentacion", "veterinario"))]
HandoverManager = Annotated[Usuario, Depends(require_roles("admin", "operario", "alimentacion"))]
