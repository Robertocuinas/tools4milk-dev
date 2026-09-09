# Release 2: modo degradado sintético implementado

## Alcance

Release 2 permite consultar tareas LeanFarming y encolar cambios de estado mientras la aplicación está abierta. La información es exclusivamente sintética y la interfaz mantiene el marcador sintético. TV no usa esta cola y sigue siendo solo lectura.

## API idempotente

`PUT /api/v1/tasks/{task_id}` acepta `X-Operation-Id` (UUID) y `expected_version` positivo. El servidor persiste la respuesta en `operation_dedupe` por usuario y operación, incrementa `tareas_ejecuciones.version` una sola vez y responde el mismo resultado en un replay. Un payload diferente con la misma operación produce `409 operation_payload_mismatch`; una versión obsoleta produce `409 stale_version` con el recurso autoritativo.

Las llamadas antiguas sin `X-Operation-Id` conservan compatibilidad temporal, pero los clientes Release 2 deben usar siempre el contrato idempotente. Auth/RBAC se evalúa en cada intento y las cookies HttpOnly no entran en el almacenamiento local.

## Outbox IndexedDB

`frontend/src/lib/offline-outbox.ts` crea `tools4milk-release2` con `task_snapshots`, `outbox` y `sync_meta`. Una operación conserva su UUID, payload exacto, versión esperada, intentos y estado. `syncOutbox` envía secuencialmente con `credentials: include`, reintenta errores de red con backoff acotado (máximo cinco intentos), pausa ante 401 y conserva conflictos 409 o errores permanentes para intervención visible.

Si IndexedDB no existe o no puede abrirse, no se usa `localStorage` ni una cola en memoria: las mutaciones offline se deshabilitan. `clearOfflineData` y `resetRelease2Database` son los puntos de limpieza para logout/reset.

## UX y operación

LeanFarming muestra una barra accesible `role=status` con estado conectado, sin conexión, pendientes o limitación del navegador. Los errores de conflicto se exponen con código estable desde la API; la resolución debe descartar la operación o crear otra usando la versión remota, nunca sobrescribir silenciosamente.

La recuperación canónica del dataset sigue siendo `generator_version + scenario_id + random_seed`. No se implementa snapshot/restore PostgreSQL ni un service worker que intercepte mutaciones.

## Verificación local

- Backend: `python -m pytest tests/ -q` → 113 passed, 2 warnings Starlette preexistentes.
- Frontend: `npm run lint` → pass.
- Frontend: `npm run typecheck` → pass.
- Frontend: `npm run build` → pass.
- `git diff --check` → pass.

La evidencia PostgreSQL live y E2E de navegador real requiere el daemon/entorno correspondiente; los tests actuales validan la ruta FastAPI con SQLite y el contrato de frontend mediante build/typecheck.
