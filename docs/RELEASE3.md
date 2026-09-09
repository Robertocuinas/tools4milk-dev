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
- `/health` público; `/api/v1/health/db` solo diagnóstico posterior.
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
