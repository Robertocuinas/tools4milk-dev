from concurrent.futures import ThreadPoolExecutor
import uuid
import httpx

base = 'http://127.0.0.1:18042'
with httpx.Client(timeout=30) as client:
    login = client.post(base + '/api/v1/auth/login', json={'username': 'admin', 'password': 'testpass123'})
    assert login.status_code == 200, login.text
    token = login.json()['token']['access_token']
    headers = {'Authorization': f'Bearer {token}'}
    tasks = client.get(base + '/api/v1/tasks', headers=headers)
    assert tasks.status_code == 200, tasks.text
    task = tasks.json()[0]
    operation_id = str(uuid.uuid4())
    payload = {'estado': 'en_curso', 'expected_version': task['version']}

def send():
    try:
        response = client.put(base + f"/api/v1/tasks/{task['id']}", headers={**headers, 'X-Operation-Id': operation_id}, json=payload, timeout=180)
        return response.status_code, response.json()
    except Exception as exc:
        return 'exception', repr(exc)

with httpx.Client(timeout=180, limits=httpx.Limits(max_connections=200)) as client:
    with ThreadPoolExecutor(max_workers=200) as pool:
        results = list(pool.map(lambda _: send(), range(200)))

status_counts = {}
exception_samples = []
replayed = 0
for status, body in results:
    status_counts[status] = status_counts.get(status, 0) + 1
    if status == 'exception' and len(exception_samples) < 5:
        exception_samples.append(body)
    if isinstance(body, dict) and body.get('replayed'):
        replayed += 1
print({'task_id': task['id'], 'operation_id': operation_id, 'status_counts': status_counts, 'exception_samples': exception_samples, 'replayed': replayed, 'mutations': sum(1 for status, body in results if status == 200 and isinstance(body, dict) and not body.get('replayed'))})
assert status_counts == {200: 200}
assert replayed == 199
