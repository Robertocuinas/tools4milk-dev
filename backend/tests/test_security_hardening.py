"""Matriz P0 de configuración, secretos y autorización backend."""

from __future__ import annotations

import httpx
import pytest
from sqlalchemy import select

from app import main
from app.config import DEMO_SECRET_KEY, settings
from app.database import get_db
from app.logging_utils import redact_configured_secret, redact_sensitive_text
from app.models.usuario import Usuario
from app.security import hash_password
from app.services.aemet_client import aemet_client
from app.time_utils import utc_now


ROLES = ("admin", "veterinario", "operario", "alimentacion")


def _headers_for(client, role: str) -> dict[str, str]:
    username = f"p0.{role}"
    db_generator = main.app.dependency_overrides[get_db]()
    db = next(db_generator)
    try:
        user = db.execute(select(Usuario).where(Usuario.username == username)).scalar_one_or_none()
        if user is None:
            db.add(
                Usuario(
                    username=username,
                    email=f"{username}@tools4milk.local",
                    hashed_password=hash_password("testpass123"),
                    role=role,
                    activo=True,
                    debe_cambiar_contrasena=False,
                    fecha_creacion=utc_now(),
                )
            )
        else:
            user.hashed_password = hash_password("testpass123")
            user.role = role
            user.activo = True
        db.commit()
    finally:
        db.close()
        next(db_generator, None)
    response = client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": "testpass123"},
    )
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['token']['access_token']}"}


@pytest.fixture
def role_headers(client) -> dict[str, dict[str, str]]:
    return {role: _headers_for(client, role) for role in ROLES}


def _configure_secure_production(monkeypatch) -> None:
    monkeypatch.setattr(settings, "environment", "production")
    monkeypatch.setattr(settings, "secret_key", "p0-production-secret-that-is-long-enough-123456")
    monkeypatch.setattr(settings, "initial_demo_password", "")
    monkeypatch.setattr(settings, "debug", False)
    monkeypatch.setattr(settings, "database_url", "postgresql+psycopg://tools4milk:strong-password@db:5432/tools4milk")
    monkeypatch.setattr(settings, "app_url", "https://granja.example.com")
    monkeypatch.setattr(settings, "cors_origins", ["https://granja.example.com"])


def test_production_accepts_only_explicit_secure_configuration(monkeypatch):
    _configure_secure_production(monkeypatch)
    main.validate_production_config()


@pytest.mark.parametrize(
    ("field", "value"),
    (
        ("secret_key", ""),
        ("secret_key", DEMO_SECRET_KEY),
        ("initial_demo_password", "testpass123"),
        ("debug", True),
        ("database_url", "sqlite:///./tfm_mvp.db"),
        ("app_url", "http://localhost:8000"),
        ("cors_origins", ["http://localhost:3000"]),
    ),
)
def test_production_rejects_insecure_configuration(monkeypatch, field, value):
    _configure_secure_production(monkeypatch)
    monkeypatch.setattr(settings, field, value)
    with pytest.raises(RuntimeError):
        main.validate_production_config()


def test_demo_seed_is_never_called_in_production(monkeypatch):
    _configure_secure_production(monkeypatch)
    monkeypatch.setattr(main, "inspect", lambda *_args, **_kwargs: pytest.fail("seed must not inspect the database"))
    main.seed_demo_user()


def test_demo_seed_requires_non_empty_password(monkeypatch):
    monkeypatch.setattr(settings, "environment", "development")
    monkeypatch.setattr(settings, "initial_demo_password", "")
    monkeypatch.setattr(main, "inspect", lambda *_args, **_kwargs: pytest.fail("empty password must disable seed"))
    main.seed_demo_user()


def test_secret_values_are_redacted_from_urls_and_text():
    secret = "top-secret-aemet-key"
    value = "GET https://opendata.aemet.es/data?api_key=top-secret-aemet-key&foo=1"
    redacted = redact_configured_secret(value, secret)
    assert secret not in redacted
    assert "api_key=[REDACTED]" in redacted
    assert "api_key=top-secret-aemet-key" not in redact_sensitive_text(value)


@pytest.mark.asyncio
async def test_aemet_error_does_not_expose_api_key(monkeypatch, db):
    secret = "top-secret-aemet-key"
    monkeypatch.setattr(settings, "aemet_api_key", secret)

    async def fail_fetch():
        request = httpx.Request("GET", f"https://aemet.test/data?api_key={secret}")
        raise httpx.RequestError(str(request.url), request=request)

    monkeypatch.setattr(aemet_client, "_fetch_real_forecast", fail_fetch)
    result = await aemet_client.sincronizar_datos(db)
    assert result["status"] == "error"
    assert secret not in str(result["error"])
    assert "api_key=[REDACTED]" in str(result["error"])


def test_protected_surfaces_return_401_without_session(client):
    for path in (
        "/api/v1/weather/current",
        "/api/v1/weather/sync",
        "/api/v1/predictions/animal-001",
        "/api/v1/audit-log",
        "/api/v1/pedidos",
        "/api/v1/turnos",
        "/api/v1/resumenes-relevo",
    ):
        response = client.get(path) if not path.endswith("/sync") else client.post(path)
        assert response.status_code == 401, path


def test_weather_sync_requires_admin(client, role_headers):
    assert client.post("/api/v1/weather/sync", headers=role_headers["admin"]).status_code == 200
    for role in ("veterinario", "operario", "alimentacion"):
        assert client.post("/api/v1/weather/sync", headers=role_headers[role]).status_code == 403


def test_predictions_allow_only_admin_veterinarian_and_feeding(client, role_headers):
    for role in ("admin", "veterinario", "alimentacion"):
        assert client.get("/api/v1/predictions/animal-001", headers=role_headers[role]).status_code == 200
    assert client.get("/api/v1/predictions/animal-001", headers=role_headers["operario"]).status_code == 403


def test_audit_is_admin_only(client, role_headers):
    assert client.get("/api/v1/audit-log", headers=role_headers["admin"]).status_code == 200
    for role in ("veterinario", "operario", "alimentacion"):
        assert client.get("/api/v1/audit-log", headers=role_headers[role]).status_code == 403


def test_read_roles_for_orders_shifts_and_handovers(client, role_headers):
    for role in ("admin", "operario", "alimentacion"):
        assert client.get("/api/v1/pedidos", headers=role_headers[role]).status_code == 200
    assert client.get("/api/v1/pedidos", headers=role_headers["veterinario"]).status_code == 403

    for role in ROLES:
        assert client.get("/api/v1/turnos", headers=role_headers[role]).status_code == 200
        assert client.get("/api/v1/resumenes-relevo", headers=role_headers[role]).status_code == 200

    assert client.post("/api/v1/turnos", json={}, headers=role_headers["operario"]).status_code == 403
    assert client.post("/api/v1/resumenes-relevo", json={}, headers=role_headers["veterinario"]).status_code == 403
    assert client.post(
        "/api/v1/pedidos",
        json={"insumo": "Pienso", "cantidad": 1, "unidad": "kg"},
        headers=role_headers["veterinario"],
    ).status_code == 403
