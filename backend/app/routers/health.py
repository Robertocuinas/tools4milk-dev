from typing import Annotated, Any

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import get_db

router = APIRouter(prefix="/api/v1/health", tags=["Health"])


@router.get("/db")
def db_health(db: Annotated[Session, Depends(get_db)]) -> dict[str, Any]:
    result = db.execute(text("SELECT 1")).scalar()
    tables_result = db.execute(
        text(
            "SELECT COUNT(*) FROM information_schema.tables "
            "WHERE table_schema = 'public'"
        )
    ).scalar()
    zonas_count = None
    try:
        zonas_count = db.execute(text("SELECT COUNT(*) FROM zonas")).scalar()
    except Exception:
        pass

    return {
        "database": "connected",
        "result": result,
        "public_tables": tables_result,
        "zonas_count": zonas_count,
    }
