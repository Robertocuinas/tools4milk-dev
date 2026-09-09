"""Hardening operativo Release 3: TTL canónico 8 h, RBAC de `/health/db`
y orden lexicográfico de migraciones (incluidas `0002`/`0002b`).

- TTL access canónico = 8 h (480 min) en un único contrato: default de
  `settings`, expiración real del JWT, `expires_in` del login y Max-Age de
  la cookie `t4m_token`. El refresh no se alarga (30 d).
- `/health` público; `/api/v1/health/db` exige admin (401/403/200) y no
  filtra secretos.
- Las migraciones se aplican en orden lexicográfico sin renombrar historia.
"""

from jose import jwt

from app.config import settings
from app.security import AUTH_COOKIE_MAX_AGE_SECONDS
from scripts.apply_migrations import load_migrations

CANONICAL_ACCESS_MINUTES = 480
CANONICAL_COOKIE_MAX_AGE = 480 * 60


def test_access_ttl_canonical_default_8h():
    """El default vive en `config.py`: producción no depende de la variable demo."""
    assert settings.access_token_expire_minutes == CANONICAL_ACCESS_MINUTES


def test_auth_cookie_max_age_matches_token_ttl():
    """Constante de referencia y setting vigente coinciden (8 h)."""
    assert AUTH_COOKIE_MAX_AGE_SECONDS == CANONICAL_COOKIE_MAX_AGE
    assert settings.access_token_expire_minutes * 60 == AUTH_COOKIE_MAX_AGE_SECONDS


def test_refresh_ttl_not_extended():
    """El handoff exige no alargar el refresh: sigue en 30 d."""
    assert settings.refresh_token_expire_days == 30


def test_login_token_expiry_and_cookie_coherent(client, test_user, test_user_credentials):
    """JWT `exp-iat` ~= 8 h, `expires_in` == 8 h y cookie Max-Age == 8 h."""
    response = client.post("/api/v1/auth/login", json=test_user_credentials)
    assert response.status_code == 200
    body = response.json()
    assert body["token"]["expires_in"] == CANONICAL_COOKIE_MAX_AGE

    payload = jwt.decode(
        body["token"]["access_token"],
        settings.secret_key,
        algorithms=[settings.algorithm],
    )
    assert payload["exp"] - payload["iat"] == CANONICAL_COOKIE_MAX_AGE

    set_cookie = response.headers.get("set-cookie", "")
    assert "t4m_token=" in set_cookie
    assert f"Max-Age={CANONICAL_COOKIE_MAX_AGE}" in set_cookie


def test_health_public_but_db_requires_auth(client):
    """/health sigue público aunque `/api/v1/health/db` exija auth."""
    assert client.get("/health").status_code == 200
    assert client.get("/api/v1/health/db").status_code == 401


def test_health_db_forbidden_for_non_admin(client, operario_headers):
    """Rol no-admin (alimentacion) recibe 403."""
    response = client.get("/api/v1/health/db", headers=operario_headers)
    assert response.status_code == 403


def test_health_db_ok_for_admin_without_secrets(client, auth_headers):
    """Admin obtiene diagnóstico útil sin secretos."""
    response = client.get("/api/v1/health/db", headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["database"] == "connected"
    assert body["result"] == 1
    assert isinstance(body["public_tables"], int)
    lowered = response.text.lower()
    for leaked in ("secret", "password", "passwd", "token", "dsn", "postgres:"):
        assert leaked not in lowered


def test_migrations_lexicographic_order_with_0002_and_0002b():
    """Orden lexicográfico verificado; `0002` < `0002b`; sin renombrar historia."""
    migrations = load_migrations()
    names = [path.name for path in migrations]
    assert names == sorted(names)
    assert "0002_user_roles.sql" in names
    assert "0002b_baseline_tools4milk.sql" in names
    assert names.index("0002_user_roles.sql") < names.index("0002b_baseline_tools4milk.sql")


def test_scheduler_heartbeat_writes_file(tmp_path, monkeypatch):
    """Liveness del worker: cada iteración deja timestamp fresco (Compose lo vigila)."""
    import scripts.run_synthetic_scheduler as sched

    target = tmp_path / "scheduler-alive"
    monkeypatch.setattr(sched, "HEARTBEAT_FILE", str(target))
    sched.write_heartbeat()
    assert target.exists()
    assert target.read_text(encoding="utf-8").strip()
