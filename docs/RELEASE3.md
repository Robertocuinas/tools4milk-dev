# Release 3 — Demo portable y reproducible (base)

## Objetivo

Que un tercero en Windows, Linux o macOS, con solo **Python 3.12+** y
**Docker Desktop**, clone, configure y ejecute la demo sintética con
diagnóstico claro, sin inventar variables ni instalar tooling extra
(sin Bash, Make, PowerShell ni OpenSSL).

## Punto de entrada único

`python scripts/demo.py` (solo biblioteca estándar):

| Comando | Efecto |
|---|---|
| `init [--force]` | Genera `.env` local con secretos aleatorios; idempotente. |
| `up [--no-build] [--timeout N]` | Levanta `tfm_r3_demo` y espera `/health`. |
| `status` | `compose ps` + `/health` + URLs. |
| `smoke [--timeout N]` | Health, login demo, `/auth/me`, scheduler, reset sintético. |
| `reset [--yes]` | Reset SOLO de filas `synthetic/generated` vía API. |
| `down [--volumes] [--yes]` | Apaga SOLO `tfm_r3_demo` (con `-v` opcional). |

`--dry-run` (global o por subcomando) muestra lo previsto sin ejecutar.
`reset` y `down --volumes` piden confirmación salvo `--yes`. Ningún
comando imprime secretos; las cookies del smoke viven solo en memoria.

## Configuración

`.env.example` (raíz) contiene placeholders `CAMBIAME-…` y comentarios
en español; **ningún secreto válido**. `init` regenera `POSTGRES_PASSWORD`,
`SECRET_KEY` e `INITIAL_DEMO_PASSWORD` (aleatorios) y deriva `DATABASE_URL`.
`.env` está en `.gitignore` (600 en POSIX). Credenciales demo: abrir `.env`
en el editor; no copiar a logs/issues/CI. Producción sigue rechazando
`INITIAL_DEMO_PASSWORD` no vacía (`validate_production_config`).

## Arquitectura demo

Cinco servicios (`docker-compose.yml`, proyecto `tfm_r3_demo`):
`db` (PostgreSQL 15), `backend` (FastAPI, migraciones `0000..0012`),
`scheduler` (sintético, idempotente), `frontend` (Next.js, Node 24),
`nginx` (proxy). Matriz de puertos/URLs base y overrides históricos en
`OPERATIONS.md` (§ URLs). Sin Redis/Celery/TimescaleDB/S3/ML; AEMET opt-in
con fallback sintético.

## Seguridad y datos

- Auth por cookies HttpOnly (`t4m_token` Lax 8 h canónicas,
  `t4m_refresh` Strict 30 d); el frontend no guarda JWT en storage.
  Contrato único Release 3: el access dura **8 h (480 min)** en un solo
  sitio — default de `backend/app/config.py`
  (`access_token_expire_minutes = 480`); la expiración real del JWT
  (`exp-iat`), el `expires_in` del login y el Max-Age de la cookie derivan
  de ese setting y no pueden divergir (test
  `backend/tests/test_release3_hardening.py`). Ningún entorno —incluida
  producción— depende de la variable demo `ACCESS_TOKEN_EXPIRE_MINUTES`
  para obtenerlo; la demo la fija en `.env` solo por claridad. El refresh
  no se alarga (30 d).
- `/health` público (liveness); `/api/v1/health/db` ejecuta queries reales
  y exige usuario autenticado con rol `admin`: 401 sin credenciales, 403
  con otro rol, 200 con diagnóstico útil sin secretos (dialecto, `SELECT 1`,
  conteos — nunca DSNs, passwords ni tokens).
- Backend y scheduler (misma imagen) corren como usuario no-root `appuser`
  (`backend/Dockerfile`); el scheduler escribe un heartbeat
  (`/tmp/tools4milk-scheduler-alive`) tras cada iteración y Compose lo
  vigila con un healthcheck de frescura (> 2x intervalo + 10 min = stale).
  Sin servicio nuevo y sin falsos healthy.
- Datos exclusivamente sintéticos/ficticios con provenance
  `synthetic/generated`; sin PII ni claims científicos/productivos.
- La demo no es producción ni recibe datos reales.

## Verificación base (esta tarjeta)

- `scripts/demo.py up` → 5 contenedores healthy; `smoke` 5/5
  (reset: `tasks=48, recurrences=6, provenance=180`); `down --volumes`
  elimina solo recursos `tfm_r3_demo` (red + volumen), resto intacto.
- Tests unitarios CLI: `python -m pytest tests/test_demo_cli.py -q` (8 tests,
  sin red ni Docker).
- Backend/frontend: suites habituales (ver CHANGELOG); `git diff --check` limpio.

## Gates CI (job `portable`, Node 24 canónico)

CI conserva los jobs existentes (`backend`, `migrations-pg`, `frontend` con
Node **24** + `npm run build` portable) y añade `portable`:

- `docker compose -p tfm_r3_ci -f docker-compose.yml config --quiet`
  (interpolación válida sin levantar nada).
- `docker build` backend + frontend y verificación de que la imagen
  backend corre como `appuser` (no-root).
- `python -m pytest tests/test_demo_cli.py` (CLI stdlib).
- Snapshot OpenAPI determinista (doble generación + `sha256`, artefacto
  `openapi-r3`) con presencia de `/api/v1/health/db`.
- `npx playwright test --list` (las specs compilan; sin fingir ejecución).

## Gate E2E completo (local)

El full stack es intencionadamente local por coste (imágenes + Postgres +
navegadores). Reproducible así, sin registry ni push:

```bash
python scripts/demo.py init
python scripts/demo.py up --build
python scripts/demo.py smoke
cd frontend && npx playwright test   # incluye axe en release2-contract
python scripts/demo.py down --volumes --yes
```

CI no lo ejecuta; solo garantiza que las specs listan y que el contrato
OpenAPI es estable. No certificar arquitecturas no ejecutadas: documentado
amd64/arm64, certificado solo lo ejecutado (ver commit de verificación).
