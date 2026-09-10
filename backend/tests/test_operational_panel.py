"""R4-4: RBAC HTTP del panel operativo (scheduler sintético + weather sync).

Verifica el contrato que consume la UI de `/integration` sin cambiar los
permisos acordados: operaciones mutables exclusivamente `admin` (401 sin
sesión, 403 para el resto de roles), usando únicamente endpoints existentes.

- GET  /api/v1/admin/synthetic/scheduler
- POST /api/v1/admin/synthetic/scheduler/pause
- POST /api/v1/admin/synthetic/scheduler/resume
- POST /api/v1/admin/synthetic/reset  (solo dataset sintético demo)
- POST /api/v1/weather/sync           (opcional, solo admin)
"""

OPERATIONAL_ENDPOINTS = [
    ("GET", "/api/v1/admin/synthetic/scheduler"),
    ("POST", "/api/v1/admin/synthetic/scheduler/pause"),
    ("POST", "/api/v1/admin/synthetic/scheduler/resume"),
    ("POST", "/api/v1/admin/synthetic/reset"),
    ("POST", "/api/v1/weather/sync"),
]


def _call(client, method, path, headers=None):
    if method == "GET":
        return client.get(path, headers=headers)
    return client.post(path, headers=headers)


def test_admin_scheduler_status_200(client, auth_headers):
    response = client.get("/api/v1/admin/synthetic/scheduler", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "paused" in data
    assert "last_execution" in data
    assert set(data["last_execution"]) >= {"started_at", "finished_at", "created", "skipped", "errors"}


def test_admin_pause_resume_roundtrip(client, auth_headers):
    paused = client.post("/api/v1/admin/synthetic/scheduler/pause", headers=auth_headers)
    assert paused.status_code == 200
    assert paused.json()["paused"] is True

    resumed = client.post("/api/v1/admin/synthetic/scheduler/resume", headers=auth_headers)
    assert resumed.status_code == 200
    assert resumed.json()["paused"] is False


def test_admin_reset_devuelve_conteos_sinteticos(client, auth_headers):
    response = client.post("/api/v1/admin/synthetic/reset", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert set(data) >= {"tasks", "recurrences", "provenance", "operation_dedupe"}
    assert all(isinstance(data[key], int) for key in ("tasks", "recurrences", "provenance", "operation_dedupe"))


def test_admin_weather_sync_modo_generado_sin_secretos(client, auth_headers):
    """Sin AEMET configurado el sync usa datos sintéticos y no expone claves."""
    response = client.post("/api/v1/weather/sync", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["modo"] == "generated"
    assert "registros_insertados" in data
    assert "registros_actualizados" in data
    lowered = response.text.lower()
    assert "api_key" not in lowered
    assert "aemet_api_key" not in lowered


def test_roles_no_admin_reciben_403(client, operario_headers):
    for method, path in OPERATIONAL_ENDPOINTS:
        response = _call(client, method, path, headers=operario_headers)
        assert response.status_code == 403, f"{method} {path} debería ser 403"


def test_sin_sesion_reciben_401(client):
    for method, path in OPERATIONAL_ENDPOINTS:
        response = _call(client, method, path)
        assert response.status_code == 401, f"{method} {path} debería ser 401"
