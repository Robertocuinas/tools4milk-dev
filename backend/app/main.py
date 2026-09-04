import json
import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator
from uuid import uuid4

logging.basicConfig(level=logging.INFO, format="%(levelname)s:     %(name)s - %(message)s")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from app.config import settings
from app.database import Base, engine
from app.openapi import install_openapi
from app.routers import (
    admin,
    alerts,
    animals,
    audit,
    auth,
    dashboard,
    employees,
    handovers,
    health,
    incidents,
    lactations,
    machinery,
    orders,
    predictions,
    shifts,
    tasks,
    treatments,
    weather,
    zones,
)
from app.security import hash_password
from app.time_utils import utc_now

logger = logging.getLogger("tools4milk.startup")


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    logger.info("[startup] validating config...")
    validate_production_config()

    logger.info("[startup] connecting to database at %s ...", settings.database_url.split("@")[-1])
    try:
        with engine.connect() as _conn:
            _conn.execute(text("SELECT 1"))
        logger.info("[startup] database connection OK")
    except Exception as exc:
        logger.error("[startup] CANNOT CONNECT TO DATABASE: %s", exc)
        raise RuntimeError(
            f"Database not reachable ({settings.database_url.split('@')[-1]}). "
            "Ensure the db container is running and port 5432 is exposed. "
            f"Original error: {exc}"
        ) from exc

    logger.info("[startup] running create_all (Core* tables) ...")
    Base.metadata.create_all(bind=engine)

    logger.info("[startup] ensuring runtime schema ...")
    ensure_runtime_schema()

    logger.info("[startup] seeding demo users ...")
    seed_demo_user()

    logger.info("[startup] startup complete.")
    yield


def validate_production_config() -> None:
    if settings.environment.lower() != "production":
        return

    if settings.secret_key == "tools4milk-dev-secret-change-me" or len(settings.secret_key) < 32:
        raise RuntimeError("SECRET_KEY must be changed before running in production")

    origins = parse_cors_origins()
    if not origins or "*" in origins:
        raise RuntimeError("CORS_ORIGINS must be explicit before running in production")


def ensure_runtime_schema() -> None:
    inspector = inspect(engine)
    if "usuarios" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("usuarios")}
    statements: list[str] = []
    if "role" not in columns:
        statements.append("ALTER TABLE usuarios ADD COLUMN role VARCHAR(40) DEFAULT 'operario'")
    if "debe_cambiar_contrasena" not in columns:
        statements.append("ALTER TABLE usuarios ADD COLUMN debe_cambiar_contrasena BOOLEAN DEFAULT FALSE")

    if not statements:
        return

    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))


def seed_demo_user() -> None:
    user_columns = {column["name"] for column in inspect(engine).get_columns("usuarios")}
    legacy_password_change_column = "debe_cambiar_contrase\u00f1a"
    demo_users = [
        ("admin", "admin@tools4milk.local", "admin"),
        ("roberto.castro", "roberto.castro@tools4milk.local", "admin"),
        ("operario.zona", "operario.zona@tools4milk.local", "operario"),
        ("laura.fernandez", "laura.fernandez@tools4milk.local", "alimentacion"),
        ("dr.mendez", "dr.mendez@tools4milk.local", "veterinario"),
    ]

    with engine.begin() as connection:
        for username, email, role in demo_users:
            password_hash = hash_password(settings.initial_demo_password)
            values = {
                "username": username,
                "email": email,
                "hashed_password": password_hash,
                "role": role,
                "activo": True,
            }
            result = connection.execute(
                text(
                    "UPDATE usuarios "
                    "SET email = :email, hashed_password = :hashed_password, role = :role, activo = :activo "
                    "WHERE username = :username"
                ),
                values,
            )
            if result.rowcount:
                continue

            insert_columns = [
                "id",
                "username",
                "email",
                "hashed_password",
                "role",
                "activo",
                "fecha_creacion",
            ]
            insert_placeholders = [
                ":id",
                ":username",
                ":email",
                ":hashed_password",
                ":role",
                ":activo",
                ":fecha_creacion",
            ]
            insert_values = {
                **values,
                "id": str(uuid4()),
                "fecha_creacion": utc_now(),
            }
            if legacy_password_change_column in user_columns:
                insert_columns.append(f'"{legacy_password_change_column}"')
                insert_placeholders.append(":legacy_password_change")
                insert_values["legacy_password_change"] = False
            if "debe_cambiar_contrasena" in user_columns:
                insert_columns.append("debe_cambiar_contrasena")
                insert_placeholders.append(":debe_cambiar_contrasena")
                insert_values["debe_cambiar_contrasena"] = False

            connection.execute(
                text(
                    "INSERT INTO usuarios "
                    f"({', '.join(insert_columns)}) "
                    f"VALUES ({', '.join(insert_placeholders)})"
                ),
                insert_values,
            )


def parse_cors_origins() -> list[str]:
    origins = settings.cors_origins
    if isinstance(origins, list):
        return origins
    try:
        parsed = json.loads(origins)
        if isinstance(parsed, list) and all(isinstance(item, str) for item in parsed):
            return parsed
    except json.JSONDecodeError:
        pass
    return [item.strip() for item in origins.split(",") if item.strip()]


app = FastAPI(
    title="Tools4Milk API",
    version="1.0.0",
    description=(
        "API para la plataforma Tools4Milk: TV por zona, tablet operativa, "
        "LeanFarming, alertas, predicciones, calidad de leche y meteorologia."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_tags=[
        {"name": "Auth", "description": "Autenticacion JWT y sesion de usuario."},
        {"name": "Frontend Core", "description": "Endpoints usados por TV y tablet."},
        {"name": "Weather", "description": "Datos meteorologicos y sincronizacion AEMET."},
    ],
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=parse_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["Health"])
def root() -> dict[str, str]:
    return {"status": "ok", "service": "Tools4Milk API", "docs": "/docs"}


@app.get("/health", tags=["Frontend Core"])
def health_check() -> dict[str, str]:
    return {
        "status": "ok",
        "database": "ok",
        "environment": settings.environment,
    }


app.include_router(health.router)
app.include_router(auth.router)
app.include_router(admin.router)
# Routers de dominio (antes el monolítico frontend_core.py), todos bajo /api/v1.
app.include_router(dashboard.router)
app.include_router(animals.router)
app.include_router(zones.router)
app.include_router(tasks.router)
app.include_router(lactations.router)
app.include_router(alerts.router)
app.include_router(predictions.router)
app.include_router(incidents.router)
app.include_router(treatments.router)
app.include_router(employees.router)
app.include_router(machinery.router)
app.include_router(weather.router)
app.include_router(audit.router)
app.include_router(orders.router)
app.include_router(shifts.router)
app.include_router(handovers.router)
install_openapi(app)
