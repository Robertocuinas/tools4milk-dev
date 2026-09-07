from typing import Annotated, Any

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import get_db

router = APIRouter(prefix="/api/v1/health", tags=["Health"])


@router.get("/db")
def db_health(db: Annotated[Session, Depends(get_db)]) -> dict[str, Any]:
    """Database connectivity probe. Dialect-agnostic.

    Antes la consulta a ``information_schema.tables`` reventaba con
    ``OperationalError`` en SQLite. Ahora detecta el dialecto del engine
    y usa la vista adecuada (``information_schema`` para Postgres,
    ``sqlite_master`` para SQLite).
    """
    result = db.execute(text("SELECT 1")).scalar()
    dialect = db.get_bind().dialect.name

    if dialect == "postgresql":
        tables_result = db.execute(
            text("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'")
        ).scalar()
    else:
        tables_result = db.execute(
            text("SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
        ).scalar()

    zonas_count: int | None = None
    try:
        zonas_count = db.execute(text("SELECT COUNT(*) FROM zonas")).scalar()
    except Exception:
        zonas_count = None

    return {
        "database": "connected",
        "dialect": dialect,
        "result": result,
        "public_tables": tables_result,
        "zonas_count": zonas_count,
    }