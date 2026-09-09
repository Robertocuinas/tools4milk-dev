from concurrent.futures import ThreadPoolExecutor
import httpx
import uuid

base = 'http://127.0.0.1:18042'
with httpx.Client(timeout=30) as client:
    login = client.post(base + '/api/v1/auth/login', json={'username': 'admin', 'password': 'testpass123'})
    assert login.status_code == 200, login.text
    headers = {'Authorization': f"Bearer {login.json()['token']['access_token']}"}
    response = client.get(base + '/api/v1/tasks?limit=100', headers=headers)
    assert response.status_code == 200, response.text
    tasks = response.json()
    task = next(item for item in tasks if item.get('estado_canonico') == 'pendiente')
    operation_id = str(uuid.uuid4())
    payload = {'estado': 'en_curso', 'expected_version': task['version']}

def send(_: int):
    try:
        with httpx.Client(timeout=180) as client:
            response = client.put(base + f"/api/v1/tasks/{task['id']}", headers={**headers, 'X-Operation-Id': operation_id}, json=payload)
            return response.status_code, response.json()
    except Exception as exc:
        return 'exception', repr(exc)

with ThreadPoolExecutor(max_workers=200) as pool:
    results = list(pool.map(send, range(200)))
status_counts = {}
replayed = 0
exceptions = []
for status, body in results:
    status_counts[status] = status_counts.get(status, 0) + 1
    if status == 'exception':
        exceptions.append(body)
    if isinstance(body, dict) and body.get('replayed'):
        replayed += 1
mutations = sum(1 for status, body in results if status == 200 and isinstance(body, dict) and body.get('replayed') is False)
print({'task_id': task['id'], 'initial_version': task['version'], 'status_counts': status_counts, 'replayed': replayed, 'mutations': mutations, 'exception_samples': exceptions[:3]})
assert status_counts == {200: 200}
assert replayed == 199
assert mutations == 1
