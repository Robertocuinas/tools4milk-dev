from __future__ import annotations

import uuid


def test_idempotent_task_update_replays_without_incrementing(client, auth_headers):
    task = client.get("/api/v1/tasks", headers=auth_headers).json()[0]
    operation_id = str(uuid.uuid4())
    payload = {"estado": "en_curso", "expected_version": task["version"]}

    first = client.put(f"/api/v1/tasks/{task['id']}", headers={**auth_headers, "X-Operation-Id": operation_id}, json=payload)
    assert first.status_code == 200, first.text
    assert first.json()["replayed"] is False
    assert first.json()["task"]["version"] == task["version"] + 1

    replay = client.put(f"/api/v1/tasks/{task['id']}", headers={**auth_headers, "X-Operation-Id": operation_id}, json=payload)
    assert replay.status_code == 200
    assert replay.json()["replayed"] is True
    assert replay.json()["task"] == first.json()["task"]


def test_stale_version_is_explicit_conflict(client, auth_headers):
    task = client.get("/api/v1/tasks", headers=auth_headers).json()[0]
    response = client.put(
        f"/api/v1/tasks/{task['id']}",
        headers={**auth_headers, "X-Operation-Id": str(uuid.uuid4())},
        json={"estado": "en_curso", "expected_version": task["version"] + 1},
    )
    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "stale_version"


def test_invalid_operation_and_expected_version_are_rejected(client, auth_headers):
    task = client.get("/api/v1/tasks", headers=auth_headers).json()[0]
    missing_version = client.put(
        f"/api/v1/tasks/{task['id']}",
        headers={**auth_headers, "X-Operation-Id": str(uuid.uuid4())},
        json={"estado": "en_curso"},
    )
    assert missing_version.status_code == 422
    assert missing_version.json()["detail"]["code"] == "invalid_expected_version"

    invalid_operation = client.put(
        f"/api/v1/tasks/{task['id']}",
        headers={**auth_headers, "X-Operation-Id": "not-a-uuid"},
        json={"estado": "en_curso", "expected_version": task["version"]},
    )
    assert invalid_operation.status_code == 422
    assert invalid_operation.json()["detail"]["code"] == "invalid_operation_id"
