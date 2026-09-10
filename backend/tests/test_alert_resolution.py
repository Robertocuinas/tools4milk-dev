import uuid

import pytest

from tests.conftest import ensure_test_user


ALERT_PAYLOAD = {
    "animal_id": "animal-r4-alert",
    "tipo_alerta": "health_alert",
    "severidad": "alta",
    "descripcion": "Alerta sintetica de prueba",
}


def _headers_for(client, role: str, username: str) -> dict[str, str]:
    ensure_test_user(username, f"{username}@example.invalid", role)
    response = client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": "testpass123"},
    )
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['token']['access_token']}"}


def _create_alert(client, headers: dict[str, str]) -> dict:
    response = client.post("/api/v1/alerts", json=ALERT_PAYLOAD, headers=headers)
    assert response.status_code == 201
    return response.json()


def test_resolve_alert_requires_authentication(client, auth_headers):
    alert = _create_alert(client, auth_headers)
    client.cookies.clear()

    response = client.patch(
        f"/api/v1/alerts/{alert['id']}",
        headers={"X-Operation-Id": str(uuid.uuid4())},
        json={"estado": "resuelta", "expected_version": alert["version"]},
    )

    assert response.status_code == 401


@pytest.mark.parametrize("role", ["operario", "alimentacion"])
def test_resolve_alert_requires_resolve_capability(client, auth_headers, role):
    alert = _create_alert(client, auth_headers)
    headers = _headers_for(client, role, f"{role}-alert-r4")
    headers["X-Operation-Id"] = str(uuid.uuid4())

    response = client.patch(
        f"/api/v1/alerts/{alert['id']}",
        headers=headers,
        json={"estado": "resuelta", "expected_version": alert["version"]},
    )

    assert response.status_code == 403


def test_resolve_alert_allows_veterinario(client, auth_headers):
    alert = _create_alert(client, auth_headers)
    headers = _headers_for(client, "veterinario", "veterinario-alert-r4")
    operation_id = str(uuid.uuid4())

    response = client.patch(
        f"/api/v1/alerts/{alert['id']}",
        headers={**headers, "X-Operation-Id": operation_id},
        json={"estado": "resuelta", "expected_version": alert["version"]},
    )

    assert response.status_code == 200
    assert response.json()["operation_id"] == operation_id
    assert response.json()["alert"]["estado"] == "resuelta"


def test_resolve_alert_is_versioned_and_idempotent(client, auth_headers):
    alert = _create_alert(client, auth_headers)
    operation_id = str(uuid.uuid4())
    headers = {**auth_headers, "X-Operation-Id": operation_id}
    payload = {"estado": "resuelta", "expected_version": alert["version"]}

    first = client.patch(f"/api/v1/alerts/{alert['id']}", headers=headers, json=payload)
    replay = client.patch(f"/api/v1/alerts/{alert['id']}", headers=headers, json=payload)

    assert first.status_code == 200
    assert first.json()["operation_id"] == operation_id
    assert first.json()["replayed"] is False
    assert first.json()["alert"]["estado"] == "resuelta"
    assert first.json()["alert"]["version"] == alert["version"] + 1
    assert replay.status_code == 200
    assert replay.json() == {**first.json(), "replayed": True}


def test_resolve_alert_rejects_stale_version(client, auth_headers):
    alert = _create_alert(client, auth_headers)
    first_headers = {**auth_headers, "X-Operation-Id": str(uuid.uuid4())}
    payload = {"estado": "resuelta", "expected_version": alert["version"]}
    assert client.patch(f"/api/v1/alerts/{alert['id']}", headers=first_headers, json=payload).status_code == 200

    conflict = client.patch(
        f"/api/v1/alerts/{alert['id']}",
        headers={**auth_headers, "X-Operation-Id": str(uuid.uuid4())},
        json=payload,
    )

    assert conflict.status_code == 409
    assert conflict.json()["detail"]["code"] == "stale_version"
    assert conflict.json()["detail"]["resource"] == {
        "id": alert["id"],
        "version": alert["version"] + 1,
        "estado": "resuelta",
    }


def test_resolve_alert_rejects_reused_operation_with_other_payload(client, auth_headers):
    alert = _create_alert(client, auth_headers)
    operation_id = str(uuid.uuid4())
    headers = {**auth_headers, "X-Operation-Id": operation_id}
    first = {"estado": "resuelta", "expected_version": alert["version"]}
    assert client.patch(f"/api/v1/alerts/{alert['id']}", headers=headers, json=first).status_code == 200

    mismatch = client.patch(
        f"/api/v1/alerts/{alert['id']}",
        headers=headers,
        json={"estado": "resuelta", "notas_operario": "otro payload", "expected_version": alert["version"]},
    )

    assert mismatch.status_code == 409
    assert mismatch.json()["detail"]["code"] == "operation_payload_mismatch"


def test_resolve_alert_requires_operation_id_and_expected_version(client, auth_headers):
    alert = _create_alert(client, auth_headers)

    missing_operation = client.patch(
        f"/api/v1/alerts/{alert['id']}",
        headers=auth_headers,
        json={"estado": "resuelta", "expected_version": alert["version"]},
    )
    missing_version = client.patch(
        f"/api/v1/alerts/{alert['id']}",
        headers={**auth_headers, "X-Operation-Id": str(uuid.uuid4())},
        json={"estado": "resuelta"},
    )
    missing_state = client.patch(
        f"/api/v1/alerts/{alert['id']}",
        headers={**auth_headers, "X-Operation-Id": str(uuid.uuid4())},
        json={"expected_version": alert["version"]},
    )
    invalid_state = client.patch(
        f"/api/v1/alerts/{alert['id']}",
        headers={**auth_headers, "X-Operation-Id": str(uuid.uuid4())},
        json={"estado": "falsa_alarma", "expected_version": alert["version"]},
    )

    assert missing_operation.status_code == 428
    assert missing_version.status_code == 422
    assert missing_state.status_code == 422
    assert invalid_state.status_code == 422


def test_resolve_alert_rejects_second_terminal_transition(client, auth_headers):
    alert = _create_alert(client, auth_headers)
    first = client.patch(
        f"/api/v1/alerts/{alert['id']}",
        headers={**auth_headers, "X-Operation-Id": str(uuid.uuid4())},
        json={"estado": "resuelta", "expected_version": alert["version"]},
    )
    assert first.status_code == 200

    second = client.patch(
        f"/api/v1/alerts/{alert['id']}",
        headers={**auth_headers, "X-Operation-Id": str(uuid.uuid4())},
        json={"estado": "resuelta", "expected_version": alert["version"] + 1},
    )

    assert second.status_code == 409
    assert second.json()["detail"]["code"] == "invalid_transition"
    assert second.json()["detail"]["resource"]["estado"] == "resuelta"


def test_openapi_documents_versioned_alert_resolution(client):
    operation = client.get("/openapi.json").json()["paths"]["/api/v1/alerts/{alert_id}"]["patch"]

    assert operation["operationId"] == "resolve_alert"
    assert {"401", "403", "409", "422", "428"} <= set(operation["responses"])
    assert any(parameter["name"] == "X-Operation-Id" and parameter["required"] for parameter in operation["parameters"])
