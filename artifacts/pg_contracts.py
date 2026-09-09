import httpx
import uuid

base = 'http://127.0.0.1:18042'
with httpx.Client(timeout=30) as client:
    login = client.post(base + '/api/v1/auth/login', json={'username': 'admin', 'password': 'testpass123'})
    token = login.json()['token']['access_token']
    headers = {'Authorization': f'Bearer {token}'}
    task = client.get(base + '/api/v1/tasks', headers=headers).json()[0]
    operation_id = str(uuid.uuid4())
    request_headers = {**headers, 'X-Operation-Id': operation_id}
    payload = {'estado': 'en_curso', 'expected_version': task['version']}
    first = client.put(f"{base}/api/v1/tasks/{task['id']}", headers=request_headers, json=payload)
    replay = client.put(f"{base}/api/v1/tasks/{task['id']}", headers=request_headers, json=payload)
    mismatch = client.put(f"{base}/api/v1/tasks/{task['id']}", headers=request_headers, json={'estado': 'completada', 'expected_version': task['version']})
    stale = client.put(f"{base}/api/v1/tasks/{task['id']}", headers={**headers, 'X-Operation-Id': str(uuid.uuid4())}, json={'estado': 'en_curso', 'expected_version': task['version']})
    print({'first': first.status_code, 'replay': replay.status_code, 'replayed': replay.json().get('replayed'), 'mismatch': mismatch.status_code, 'stale': stale.status_code})
    assert first.status_code == 200
    assert replay.status_code == 200 and replay.json()['replayed'] is True
    assert mismatch.status_code == 409
    assert stale.status_code == 409
