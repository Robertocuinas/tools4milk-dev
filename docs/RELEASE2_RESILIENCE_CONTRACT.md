# ADR / contrato Release 2: resiliencia sintética y modo degradado

- Estado: propuesta técnica validada contra el baseline Release 1
- Fecha: 2026-09-09
- Alcance: demo local/staging sintética; no es diseño de producción, SLA ni HA
- Decisión principal: backend autoritativo + outbox IndexedDB para las mutaciones mínimas de LeanFarming

## 1. Contexto y fuentes auditadas

Fuentes de verdad usadas para este contrato:

- `docs/RELEASE1.md`: alcance, límites, perfiles, escenarios, autenticación HttpOnly y recuperación por generador/seed.
- `docs/LEANFARMING_CONTRACT.md`: estados canónicos, compatibilidad legacy y endpoints `/api/v1`.
- `backend/app/routers/tasks.py`: GET/POST `/tasks`, GET/PUT/DELETE `/tasks/{task_id}` y catálogo.
- `backend/app/repositories/tasks_repository.py`: transición de estados, validaciones y ausencia actual de versión/idempotencia.
- `backend/app/models/tools4milk.py`: `tareas_ejecuciones` no tiene aún `version`; `synthetic_provenance` ya tiene unicidad por entidad.
- `backend/migrations/0010_leanfarming_contract.sql` y `0011_synthetic_scheduler.sql`: patrón de migración incremental.
- `backend/app/security.py`: autenticación por cookie/access token y dependencias de roles; los routers de tareas requieren usuario y las mutaciones `TaskManager`.
- `frontend/src/lib/api.ts`: `fetch` con `credentials: include`, refresh coordinado ante 401 y mutaciones actuales sin idempotency key.
- `frontend/src/store/app-store.ts`: `localStorage` conserva usuario/zona, pero no debe convertirse en cola durable.
- `frontend/package.json`: no existe todavía dependencia PWA/IndexedDB ni service worker.

Capacidades actuales relevantes:

- API FastAPI versionada, PostgreSQL y migraciones SQL ordenadas.
- Tareas con estados canónicos `pendiente`, `en_curso`, `verificacion`, `completada`; aliases legacy solo por compatibilidad.
- IDs UUID y datos sintéticos reproducibles por `generator_version + scenario_id + random_seed`.
- Cookies HttpOnly para sesión; el frontend no persiste el JWT.
- El frontend ya distingue fallos de red de respuestas HTTP y coordina refresh, pero descarta una mutación si la red falla.
- No hay service worker, manifest PWA, cache offline ni outbox en el baseline.

Decisión de alcance: Release 2 solo añade lectura degradada de tareas y solicitud offline de cambios de estado en LeanFarming. No se encolan animales, incidencias, pedidos, catálogo, turnos, scheduler, TV ni operaciones administrativas. TV sigue siendo solo lectura y no muta ni muestra una cola local.

## 2. Decisiones no negociables

1. La base de datos y las reglas de autorización del backend son autoritativas.
2. Una operación offline nunca se ejecuta localmente como si estuviera confirmada: su estado es `queued` hasta respuesta del servidor.
3. Toda mutación lleva `operation_id` estable y `expected_version` del recurso.
4. El backend deduplica por usuario + operación; el mismo `operation_id` con payload distinto es error, no una nueva operación.
5. Una versión esperada que ya no coincide produce `409 Conflict` explícito. Nunca se aplica last-write-wins silencioso.
6. Un `401` conserva la operación, pausa el envío y exige reautenticación. No se almacena ningún token en la outbox.
7. Un `403`, `404`, `409`, `422` o error permanente se conserva como resultado terminal visible; no se reintenta automáticamente salvo acción explícita compatible.
8. Los reintentos automáticos se limitan a fallos de transporte, timeout y respuestas 5xx/429, con backoff y jitter acotados.
9. Cachear solo app shell y lecturas sintéticas necesarias; nunca cookies, tokens, datos de credenciales ni respuestas de endpoints sensibles fuera de la política indicada.
10. El demo puede reconstruirse siempre con versión de generador, seed y escenario. Un snapshot PostgreSQL, si se adopta, es complemento y no la fuente canónica.

## 3. Contrato API mínimo

### 3.1 Lecturas

Se mantienen sin cambio de semántica:

- `GET /api/v1/tasks?skip=0&limit=50&estado=<estado>&zona_id=<uuid>`
- `GET /api/v1/tasks/{task_id}`
- `GET /api/v1/tareas-catalogo` solo para catálogo necesario para interpretar la tarea

Las respuestas de tarea deben añadir en Release 2:

```json
{
  "id": "uuid",
  "estado": "programada",
  "estado_canonico": "pendiente",
  "version": 4,
  "updated_at": "2026-09-09T10:30:00Z",
  "synthetic_provenance": {
    "source": "synthetic/generated",
    "generator_version": "1.0",
    "scenario_id": "degraded_connectivity",
    "random_seed": 20260602
  }
}
```

`version` es un entero monotónico por tarea, empieza en 1 al materializarse y aumenta exactamente una vez por mutación efectiva. `updated_at` es informativo y no sustituye a `version` para conflictos.

### 3.2 Mutación

La primera implementación soporta únicamente cambio de estado de una tarea, y reutiliza `PUT /api/v1/tasks/{task_id}` para conservar compatibilidad de ruta. El cliente debe enviar:

Headers obligatorios:

```text
Content-Type: application/json
X-Operation-Id: <UUID v4 generado una vez y conservado en reintentos>
```

Cuerpo mínimo:

```json
{
  "estado": "en_curso",
  "expected_version": 4
}
```

El cuerpo puede incluir los campos ya admitidos por el endpoint (por ejemplo `fecha_ejecucion`, `fecha_fin`, `observaciones`), pero el primer flujo offline debe limitarse a `estado` y, opcionalmente, los timestamps generados por la misma acción. La outbox guarda el cuerpo exacto que se intentará enviar.

Reglas de validación:

- `X-Operation-Id` debe ser UUID válido y no vacío; si falta o es inválido, responder `422` con código `invalid_operation_id`.
- `expected_version` debe ser entero positivo; si falta o es inválido, responder `422` con código `invalid_expected_version`.
- El usuario autenticado debe tener `TaskManager` para cambiar estado.
- Se aplican las transiciones de `tasks_repository.py`; transición inválida devuelve `422`.
- La operación y el incremento de versión se confirman en una única transacción PostgreSQL.

### 3.3 Respuestas de mutación

Éxito nuevo: `200 OK` con la tarea canónica actualizada y cabecera opcional `X-Operation-Replayed: false`.

```json
{
  "operation_id": "uuid",
  "replayed": false,
  "task": { "id": "uuid", "estado_canonico": "en_curso", "version": 5 }
}
```

Repetición idéntica: `200 OK` con el mismo resultado persistido, `replayed: true`. No vuelve a aplicar la transición ni incrementa `version`. Esto cubre reintento tras timeout con commit desconocido.

Misma operación con payload diferente: `409 Conflict` con código estable `operation_payload_mismatch`; no se modifica la tarea.

Versión obsoleta: `409 Conflict` con código `stale_version` y estado autoritativo:

```json
{
  "error": {
    "code": "stale_version",
    "message": "La tarea cambió mientras estaba pendiente",
    "operation_id": "uuid",
    "resource": { "id": "uuid", "version": 6, "estado_canonico": "completada" },
    "expected_version": 4
  }
}
```

La UI debe pasar la operación a `conflict`, mostrar la versión/estado remoto y exigir decisión del usuario. Resolver significa descartar la operación o crear una nueva operación con la versión remota; nunca reescribir silenciosamente.

Otros códigos:

| HTTP | Código/causa | Outbox |
|---|---|---|
| 400/422 | esquema, UUID, estado o transición inválida | `failed`, sin retry automático |
| 401 | falta/expiró sesión | conservar `queued`, pausar y reautenticar |
| 403 | rol insuficiente | `failed`, conservar auditoría local y no reintentar |
| 404 | tarea ya no existe | `failed`, no reintentar |
| 409 | versión u operación conflictiva | `conflict`, intervención explícita |
| 429/5xx | rate limit/error temporal | reintentar con backoff acotado |
| red/timeout | resultado desconocido o no enviado | reintentar con el mismo `operation_id` |

El wrapper de foreground conserva el refresh coordinado existente para un `401`. El worker de outbox debe considerar el resultado final tras ese intento de refresh: si sigue siendo `401`, pausa la cola y exige reautenticación explícita; nunca descarta ni reescribe la operación.

## 4. Persistencia backend y migración

### 4.1 Cambios mínimos

Añadir a `tareas_ejecuciones`:

- `version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0)`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`

Añadir tabla `operation_dedupe` (nombre canónico para la implementación):

- `id UUID PRIMARY KEY DEFAULT uuid_generate_v4()`
- `operation_id UUID NOT NULL`
- `actor_user_id UUID NOT NULL REFERENCES usuarios(id)`
- `resource_type VARCHAR(40) NOT NULL` (`task` en esta entrega)
- `resource_id UUID NOT NULL`
- `request_hash CHAR(64) NOT NULL` (SHA-256 del método, ruta y JSON canónico; no contiene secretos)
- `status VARCHAR(20) NOT NULL` (`applied` o `rejected`)
- `response_status SMALLINT NOT NULL`
- `response_body JSONB NOT NULL`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- `completed_at TIMESTAMPTZ NOT NULL DEFAULT now()`

Índices/constraints:

- `UNIQUE(actor_user_id, operation_id)`; la deduplicación está delimitada por cuenta y evita colisiones entre usuarios sintéticos.
- `INDEX(resource_type, resource_id)` para diagnóstico.
- No almacenar access/refresh tokens, headers de autorización ni payloads no necesarios.

Migración compatible `0012_release2_resilience.sql`:

1. Añadir columnas nullable o con default seguro para no bloquear el esquema existente.
2. Backfill `version = 1` y `updated_at = COALESCE(creado_en, now())`.
3. Aplicar `NOT NULL` y checks después del backfill.
4. Crear tabla/índices con `IF NOT EXISTS` siguiendo el patrón de `0010`/`0011`.
5. No eliminar aliases ni columnas legacy.

### 4.2 Algoritmo transaccional

Dentro de una transacción PostgreSQL:

1. Autenticar y autorizar antes de leer/escribir la tarea.
2. Calcular `request_hash` del payload normalizado.
3. Buscar `(actor_user_id, operation_id)` con bloqueo apropiado.
4. Si existe y el hash coincide, devolver el `response_body` guardado sin tocar la tarea.
5. Si existe y el hash difiere, devolver `409 operation_payload_mismatch`.
6. Bloquear la tarea (`SELECT ... FOR UPDATE`), comprobar `expected_version`.
7. Si no coincide, guardar respuesta rechazada en dedupe y devolver `409 stale_version`.
8. Validar transición y permisos de negocio.
9. Actualizar estado, `version = version + 1`, `updated_at = now()`.
10. Guardar la respuesta completa en dedupe y hacer commit.

Un timeout del cliente después del commit se resuelve repitiendo exactamente la operación; la respuesta almacenada hace que el resultado sea determinista.

## 5. Outbox IndexedDB y sincronización

### 5.1 Modelo local

Crear una base IndexedDB versionada, por ejemplo `tools4milk-release2`, con object stores:

- `task_snapshots`: key `task_id`; tarea, `version`, `cached_at`, provenance y `cache_schema_version`.
- `outbox`: key `operation_id`; `task_id`, método/ruta, body exacto, `expected_version`, `created_at`, `attempts`, `next_attempt_at`, estado, `last_error_code`, `last_error_message`, `session_user_id`.
- `sync_meta`: una fila con `schema_version`, `last_sync_at`, `cache_generation`.

Estados visibles y reglas:

- `online`: conectividad detectada; no implica sesión válida.
- `offline`: lectura desde cache; nuevas mutaciones pasan a `queued`.
- `queued`: pendiente, sin envío en curso.
- `syncing`: envío activo; solo una operación por `operation_id`.
- `conflict`: respuesta 409; requiere elección.
- `failed`: error permanente; permite borrar o reintentar manualmente si procede.
- `synced`: resultado confirmado; conservar breve historial o eliminar según política de limpieza.

La creación de una operación y su paso a `queued` deben ser una única transacción IndexedDB. Nunca usar `localStorage` para cuerpos de mutación, cola o tokens. `localStorage` actual de usuario/zona queda fuera de la outbox; en logout/reset se limpia también el cache de tareas.

### 5.2 Flujo de sync

1. Al iniciar LeanFarming, abrir IndexedDB y cargar snapshots válidos; mostrar `online/offline` de forma accesible.
2. En cada mutación, generar UUID una vez, capturar `expected_version` del snapshot y escribir la outbox antes de intentar red.
3. Si `navigator.onLine` es falso, no llamar a la API.
4. Al recuperar conexión, al abrir la app o mediante botón “Sincronizar”, ordenar por `created_at` y enviar secuencialmente por recurso.
5. Antes de cada envío, si la sesión está marcada como expirada, detener la cola; no enviar a ciegas.
6. Con `200`, actualizar snapshot con la respuesta, marcar `synced` y retirar la operación tras una retención corta.
7. Con `401`, pausar toda la cola y mostrar “Vuelve a iniciar sesión para sincronizar”; después de login no reenviar automáticamente hasta una acción/reanudación explícita.
8. Con `409`, marcar `conflict` y continuar con operaciones independientes; no reordenar una operación conflictiva detrás de una operación que depende de su resultado sin decisión explícita.
9. Con red/timeout/5xx/429, calcular `min(30 s, 1 s * 2^attempts) + jitter`, máximo 5 reintentos automáticos en el demo; luego `failed` con reintento manual.
10. Al cerrar sesión, borrar snapshots/outbox de ese usuario. “Reset demo” borra toda la base IndexedDB y fuerza recarga de app shell.

El service worker, si se incorpora, solo precachea el app shell versionado y no intercepta POST/PUT/DELETE para “hacerlos pasar” como exitosos. El sync en primer alcance ocurre mientras la app está abierta; Background Sync queda fuera de Release 2 salvo prueba explícita de compatibilidad.

## 6. Seguridad y autorización

- La cookie HttpOnly sigue siendo la única ubicación del token; IndexedDB no contiene access ni refresh token.
- Toda petición de sync usa `credentials: include`; no se permite construir un `Authorization` desde datos locales.
- El backend vuelve a evaluar autenticación, rol `TaskManager`, existencia de tarea y transición en cada reintento.
- Un usuario que pierde permisos recibe `403` y la operación no se reintenta.
- Aplicar límites de tamaño: una operación de tarea pequeña, body JSON limitado y máximo de operaciones/snapshot para evitar llenar IndexedDB en el demo.
- Sanitizar/validar strings con las mismas reglas del endpoint online; no confiar en una validación frontend realizada offline.
- No cachear `/auth/*`, auditoría, secretos, credenciales, ni respuestas de otros usuarios.
- Logout, cambio de usuario y reset invalidan cache/outbox local; una operación no se transfiere a otra sesión.
- Registrar en backend actor, operation_id, recurso, hash, resultado y timestamps; no registrar cookies ni cuerpos con secretos.

## 7. UX accesible y superficies

Barra persistente en móvil/tablet/desktop, con texto y color/icono:

- “Conectado” (`online`), “Sin conexión: los cambios se guardarán en este dispositivo” (`offline`), “3 cambios pendientes” (`queued`), “Sincronizando” (`syncing`).
- Cada tarjeta de tarea muestra estado de sincronización y no dice “completada” hasta confirmación del servidor.
- En conflicto: `role="alertdialog"`, foco inicial en resumen, texto del estado local/remoto y botones “Descartar mi cambio” / “Revisar y volver a intentar”. Nunca un modal sin alternativa de teclado.
- En fallo permanente: mensaje accionable, código legible y botones “Reintentar”/“Eliminar de la cola”.
- `aria-live="polite"` para cambios normales y `assertive` solo para expiración/conflicto; contraste AA y controles táctiles adecuados.
- En TV: solo lectura, sin outbox, sin botones de mutación y sin afirmar que una acción offline se ha aplicado.

## 8. Escenarios sintéticos reproducibles

Todos usan `generator_version=1.0`, `scenario_id`, `random_seed=20260602`, perfil `small` salvo que se indique lo contrario, y un usuario sintético con rol explícito.

| ID | Preparación/fallo | Criterio verificable |
|---|---|---|
| S01 | cargar tarea v1, cortar red antes de mutar | aparece `offline`; operación queda `queued`; no cambia DB |
| S02 | crear operación offline, restaurar red | se envía una vez y termina `synced`; version pasa v1→v2 |
| S03 | caída durante envío después de commit | reintento con mismo ID devuelve `replayed=true`; no duplica ni incrementa dos veces |
| S04 | duplicar exactamente la misma solicitud | segunda respuesta es replay idéntico; una sola fila de efecto |
| S05 | mismo operation_id con body distinto | `409 operation_payload_mismatch`; tarea intacta |
| S06 | access token expirado, refresh disponible | `401` pausa; login/refresh explícito permite reanudar sin perder operación |
| S07 | usuario sin `TaskManager` | `403`; operación `failed`; no cambia DB |
| S08 | dos clientes leen v4 y ambos solicitan cambios | uno confirma v5; el otro recibe `409 stale_version` y queda `conflict` |
| S09 | tarea remota ya eliminada | `404`; no retry automático |
| S10 | transición no permitida | `422`; no retry automático |
| S11 | red intermitente/5xx/timeout | backoff acotado, máximo 5 retries automáticos y mismo operation_id |
| S12 | logout/reset mientras hay cola | IndexedDB se limpia; ninguna operación de usuario A aparece para B |
| S13 | rebuild | mismo generator version+seed+scenario reproduce claves sintéticas; snapshot opcional no cambia el contrato |

Los fallos son inyectados en un stub/controlador de prueba, no en proveedores externos ni datos reales.

## 9. Estrategia de pruebas y gates

Unitarias frontend/backend:

- canonicalización/hash estable del body y generación de operation_id.
- reducer de estados outbox, límites de backoff y transición `401`/`409`.
- repositorio dedupe: nuevo, replay idéntico y mismatch.
- incremento exactamente una vez de `version`.
- transiciones canónicas y permisos existentes.

Contratos/API:

- OpenAPI documenta headers, `expected_version`, `version`, respuestas 200/401/403/409/422.
- pruebas HTTP para todos los códigos de la tabla, incluyendo replay tras timeout simulado.
- PostgreSQL concurrente: dos transacciones con la misma versión; exactamente una gana.
- rollback: fallo de dedupe o actualización no deja media operación aplicada.

Playwright:

- `context.setOffline(true)` para S01, creación de operación y lectura cacheada.
- restauración de red para S02/S11.
- route interception para timeout después de responder/commit simulado, 401, 403 y 409.
- dos browser contexts con la misma tarea para S08.
- reload/cierre/reapertura para demostrar persistencia IndexedDB.
- `axe` en móvil/tablet/desktop sobre banner, cola y diálogo de conflicto; teclado completo.
- asserts de no duplicados por `operation_id`, no por tiempos o mensajes visuales.

Gates: backend pytest, typecheck/lint/build frontend, migración contra PostgreSQL, contratos OpenAPI, Playwright offline, axe y revisión manual de TV read-only. Docker live queda condicionado a que el daemon esté disponible; si no, registrar la limitación, no inventar evidencia.

## 10. Backup, restore y reset

La recuperación canónica sigue siendo ejecutar migraciones y regenerar el dataset con `generator_version + profile + scenario + seed`. Este método es barato, auditable y ya está probado en Release 1.

Snapshot PostgreSQL se acepta solo como complemento para depurar una ejecución concreta: debe incluir versión del esquema, manifest sintético y checksum, y restaurarse en una base aislada. No se usa para transportar sesiones, tokens ni datos reales. No se añade proveedor ni servicio nuevo. En el alcance actual el coste/beneficio no justifica automatizar snapshots: documentar el procedimiento manual opcional es suficiente.

Reset demo:

1. borrar volumen/filas sintéticas según `OPERATIONS.md`;
2. regenerar con los parámetros del manifest;
3. borrar IndexedDB/cache del navegador;
4. iniciar sesión de nuevo y verificar que no quedan operaciones pendientes.

## 11. Grafo mínimo de implementación

Orden y dependencias, sin entregar feature parcial:

1. `R2-DB`: migración 0012, modelo ORM, índices y transacción atómica (depende de baseline Release 1).
2. `R2-API`: esquemas/headers, dedupe, versionado y respuestas 409 (depende de R2-DB).
3. `R2-CLIENT`: wrapper de request con operation_id y tipos de error (depende de R2-API).
4. `R2-OUTBOX`: IndexedDB versionada, snapshots, cola y backoff (depende de R2-CLIENT).
5. `R2-UX`: banner, estados, conflicto, logout/reset y accesibilidad (depende de R2-OUTBOX).
6. `R2-TESTS`: unitarias, contratos, concurrencia PostgreSQL y Playwright/axe (depende de R2-API, R2-OUTBOX y R2-UX).
7. `R2-DOCS-GATE`: actualizar operaciones y evidencia sintética; solo después de todos los gates.

Fuera del grafo: Redis/Celery, Background Sync obligatorio, mutaciones de otras áreas, producción/HA/SLA, proveedor externo y claims científicos o de campo.

## 12. Preguntas abiertas y riesgos residuales

Preguntas que no bloquean este contrato:

- Confirmar el nombre exacto de la tabla de usuarios en el esquema instalado (`usuarios` frente a cualquier alias legacy) antes de escribir la FK de migración.
- Decidir si la respuesta de replay conserva indefinidamente `operation_dedupe` o aplica retención de demo; ambas opciones mantienen el contrato mientras la ventana cubra reintentos.
- Confirmar soporte del navegador objetivo para IndexedDB en los dispositivos de demo; si falta, la app debe deshabilitar mutaciones offline, no caer silenciosamente a localStorage.

Riesgos residuales aceptados:

- La conectividad del navegador no prueba que el backend esté sano; `online` es solo una señal y el resultado real es la respuesta HTTP.
- IndexedDB puede ser borrada por el usuario/navegador; la UI debe advertir que la cola local no sustituye un sistema de mensajería durable.
- Un timeout puede dejar el resultado desconocido hasta el replay; por eso la idempotencia backend es obligatoria.
- La demo sigue siendo sintética y no representa seguridad operativa, disponibilidad productiva, rendimiento productivo ni validación científica.
- Sin daemon Docker disponible en el baseline, el gate live Compose debe repetirse cuando exista runtime; no se considera evidencia falsa ni se amplía el alcance.

## Handoff estructurado

- `sources`: archivos listados en §1.
- `current_capabilities`: API FastAPI/PostgreSQL, tareas canónicas, cookies HttpOnly, refresh coordinado, generator/seed; sin PWA/outbox actual.
- `decisions`: backend autoritativo, solo tareas/estado, IndexedDB, operation_id + expected_version, 409 explícito, no nuevos proveedores.
- `api_contract`: §§3–4.
- `storage_contract`: §5 y migración §4.
- `conflict_policy`: 409 `stale_version`/`operation_payload_mismatch`, resolución explícita.
- `security_model`: §6.
- `synthetic_scenarios`: §8.
- `test_strategy`: §9.
- `migration_plan`: §4.
- `implementation_graph`: §11.
- `open_questions`: §12.
- `residual_risk`: §12.
