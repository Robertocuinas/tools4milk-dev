# Changelog

## Release 3 — Demo portable y reproducible (base, en curso)

### Añadido

- `.env.example` raíz (placeholders `CAMBIAME-…`, comentarios en español,
  AEMET opcional) y `python scripts/demo.py` como único punto de entrada
  multiplataforma (solo biblioteca estándar): `init|up|status|smoke|reset|down`,
  proyecto Compose aislado `tfm_r3_demo`, `--dry-run` y confirmaciones para
  operaciones destructivas.
- Smoke reproducible: `/health` público, login demo con cookie en memoria,
  `/auth/me`, estado del scheduler y reset sintético, sin rastro residual.
- `docs/RELEASE3.md` y quickstart único de 5 minutos en README/OPERATIONS.

### Corregido

- OPERATIONS: migraciones `0000..0012`, 5 servicios, TTL access 8 h,
  matriz de puertos/URLs base + overrides, backup con usuario real
  (`postgres`), generación de secretos portable (sin OpenSSL),
  Playwright/axe Release 2 ya implementados.
- `docs/RELEASE2_IMPLEMENTATION.md`: cifra certificada 114 tests.

## Release 2 — READY (modo degradado sintético certificado)

### Añadido

- Mutaciones de tareas idempotentes (`X-Operation-Id` + `expected_version`,
  tabla `operation_dedupe`, 409 ante replay divergente o versión obsoleta).
- Outbox IndexedDB (`tools4milk-release2`) con backoff acotado y pausa ante 401.
- 3 specs Playwright (`release2-contract` con axe, `release2-full-matrix-cert`,
  `release2-offline-cert-independent`).
- Migración `0012_release2_resilience.sql`.

### Verificación

- Backend: 114 tests pytest. Frontend: typecheck + lint + build sin errores.
- Datos solo sintéticos (`synthetic/generated`); TV sigue solo lectura.

## Release 1 — baseline sintética

### Añadido

- Demo reproducible con API `/api/v1`, contratos OpenAPI y frontend responsive.
- Generador de datos sintéticos con perfiles, escenarios, provenance,
  controles de calidad y recuperación determinista por versión + seed +
  escenario.
- LeanFarming para tareas, incidencias, pedidos, turnos mañana/tarde,
  asignaciones, zonas y vistas de tablet.
- Scheduler sintético idempotente con ejecución manual y periódica.
- Pantalla TV de solo lectura.
- Gates de backend, frontend, contratos, Compose, E2E y accesibilidad.

### Límites

- Esta Release 1 es una demo académica reproducible; no es una afirmación de
  preparación para producción.
- Los datasets son exclusivamente sintéticos. No se incluyen datos reales ni
  validación científica de las distribuciones o predicciones.
- No se introducen Redis, Celery, ML ni proveedores externos obligatorios.

### Seguridad y dependencias

- El gate `npm audit --omit=dev --audit-level=high` no presenta vulnerabilidades
  high/critical en dependencias de producción en la integración.
- Se fija `baseline-browser-mapping` en `2.11.21` mediante `overrides`,
  eliminando el advisory moderado transitivo `GHSA-w5vr-8v7q-w6rv` sin una
  migración mayor.
- No se ejecuta `npm audit fix --force`.
