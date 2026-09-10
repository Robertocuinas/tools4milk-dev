# TOOLS4MILK — R5: arquitectura versionada (R5-RF-02)

Estado R5: `IN_PROGRESS` (ver `docs/RELEASE5.md`). Este documento solo
describe la arquitectura efectivamente implementada sobre `main` en
`3741c18` (base R5-0 `68132c2`); no introduce componentes ni certifica
despliegue productivo. Requisito: `docs/R5_REQUIREMENTS_TRACEABILITY.md`
(R5-RF-02, no editado).

## 1. Vistas (cuatro ficheros versionados)

| Vista | Fichero | Qué muestra |
|---|---|---|
| Contexto | `docs/diagrams/r5-context.mmd` | Frontera de TOOLS4MILK, actores, navegador/TV, CLI `scripts/demo.py`, AEMET opcional |
| Contenedores | `docs/diagrams/r5-containers.mmd` | Cinco servicios Compose `tfm_r3_demo`, puertos, Nginx, volúmenes, dependencias healthy |
| API y seguridad | `docs/diagrams/r5-api-security.mmd` | JWT en cookies, excepción pública `/health`, dominio autenticado, RBAC por rol, scheduler/admin solo admin |
| Datos sintéticos | `docs/diagrams/r5-synthetic-data.mmd` | Generador determinista, carga idempotente, provenance `synthetic/generated`, reset seguro, consumo honesto |

## 2. Cómo se renderizan (sin servicio externo)

- Cada vista es un fichero Mermaid autocontenido (`flowchart`), versionado
  junto a este índice. No depende de ningún servicio externo ni de
  exportación previa: cualquier visor compatible con Markdown+Mermaid
  (GitHub, GitLab, VS Code con extensión Mermaid) los renderiza al abrir
  el `.mmd` o al incrustarlo en Markdown.
- Para previsualizar en local basta con abrir el fichero en el visor
  Mermaid de su editor; no se requiere Docker, red ni credenciales.
- Convención de flechas: `-- "etiqueta" -->` indica relación dirigida con
  su tipo (`usa`, `enruta`, `llama API`, `lee y escribe`, `opera`,
  `sincroniza opt-in`, `sirve`, `valida`, etc.). Las líneas `-.->`
  indican dependencia de arranque/healthy, no tráfico. Las notas
  `synthetic/generated` y `prototipo académico` aparecen como nodos
  explícitos, no como estilo.

## 3. Leyenda

- Rectángulos: actores, servicios, endpoints, scripts.
- `[(...)]`: solo PostgreSQL (almacenamiento).
- Etiqueta sobre flecha: tipo de relación + protocolo o contrato
  (`HTTP`, `SQL`, `Cookie`, `proxy HTTP`, `UUID5`, `provenance`).
- `solo admin` / `AdminOnly`: `backend/app/routers/deps.py` +
  `backend/app/security.py` (`require_roles("admin")`).
- `WeatherReader`, `PredictionReader`, etc.: alias de `deps.py` con su
  lista exacta de roles (ver §5).
- `synthetic/generated`: origen canónico de todo dato
  (`backend/app/synthetic_data.py`, `SOURCE`); `aemet_real` solo aparece
  como modo opt-in de `POST /api/v1/weather/sync`.

## 4. Límites académicos (aplican a las cuatro vistas)

- Prototipo académico del TFM; la demo no es producción ni recibe datos
  reales (`docs/RELEASE3.md`, `README.md` líneas ~70-76).
- Datos exclusivamente sintéticos/ficticios con provenance
  `synthetic/generated`; sin PII ni validez científica, clínica o
  productiva (`docs/SYNTHETIC_DATA.md`).
- Predicciones = heurística aritmética, no ML; correlación meteo =
  Pearson descriptivo, no causal (`backend/app/services/`,
  `backend/app/routers/weather.py`, `backend/app/routers/predictions.py`).
- TV por zona es solo lectura; la escritura de zonas es solo admin
  (`backend/app/routers/zones.py`, frontend `/tv`).
- Operación sintética (`seed`, `scheduler`, `reset`) deshabilitada en
  producción (`backend/app/routers/admin.py`,
  `backend/app/routers/synthetic_scheduler.py`).

## 5. Trazabilidad fuente ↔ diagrama

Cada elemento traza a un fichero, endpoint o contrato real citado.
Nada se infiere.

### Contexto (`r5-context.mmd`)

| Elemento del diagrama | Fuente real |
|---|---|
| Arquitectura monolítica modular, Next.js+React/Zustand/TanStack/Tailwind, FastAPI+Pydantic, PostgreSQL JSONB | `README.md` (líneas ~128-131) |
| Cinco servicios demo, proyecto `tfm_r3_demo`, sin Redis/Celery/TimescaleDB/S3/ML, AEMET opt-in con fallback | `docs/RELEASE3.md` (arquitectura demo, seguridad y datos) |
| CLI `init\|up\|status\|smoke\|reset\|down`, solo biblioteca estándar | `scripts/demo.py` |
| App FastAPI + routers `/api/v1`, `/health` público | `backend/app/main.py` |
| Sync meteo con modo `aemet_real` o `generated` | `backend/app/services/aemet_client.py`, `backend/app/routers/weather.py` (`POST /sync`) |

### Contenedores (`r5-containers.mmd`)

| Elemento del diagrama | Fuente real |
|---|---|
| `db` postgres:15-alpine, `tools4milk`, `init.sql`, volumen `postgres_data`, healthcheck `pg_isready` | `docker-compose.yml` (servicio `db`) |
| `backend` imagen `./backend`, `apply_migrations.py` + `uvicorn app.main:app --port 8000`, `DATABASE_URL` host `db`, healthcheck `/health` | `docker-compose.yml` (servicio `backend`) |
| `scheduler` misma imagen, `run_synthetic_scheduler.py --interval-seconds --profile --scenario`, heartbeat `/tmp/tools4milk-scheduler-alive`, healthcheck de frescura | `docker-compose.yml` (servicio `scheduler`) |
| `frontend` Next.js Node 24, puerto 3000, healthcheck `/` | `docker-compose.yml` (servicio `frontend`), `docs/RELEASE3.md` (gates CI Node 24) |
| `nginx` alpine, `nginx/nginx.conf`, `:80`, `/api/ /health /docs /redoc /openapi.json → backend`, `/ → frontend`, `depends_on healthy` | `docker-compose.yml` (servicio `nginx`), `nginx/nginx.conf` |
| Puertos base `80/3000/5432/8000` en `127.0.0.1`, proyecto `tfm_r3_demo` | `OPERATIONS.md` (§ URLs), `.env.example` (`COMPOSE_PROJECT_NAME`) |
| Backend y scheduler como usuario no-root `appuser` | `backend/Dockerfile`, `docs/RELEASE3.md` |
| Variables `POSTGRES_*`, `DATABASE_URL`, `SECRET_KEY`, `INITIAL_DEMO_PASSWORD`, `AEMET_API_KEY` vacía, `SYNTHETIC_*` | `.env.example` |

### API y seguridad (`r5-api-security.mmd`)

| Elemento del diagrama | Fuente real |
|---|---|
| Cookies `t4m_token` HttpOnly SameSite=Lax 8 h (480 min), `t4m_refresh` Strict 30 d, tabla `refresh_tokens`, rotación + reuse detection, rate-limit login 429 | `backend/app/security.py`, `backend/app/routers/auth.py`, `docs/RELEASE3.md`, `.env.example` (`ACCESS_TOKEN_EXPIRE_MINUTES=480`, `REFRESH_TOKEN_*`) |
| `GET /health` público (liveness), excepción sin auth | `backend/app/main.py` (`@app.get("/health")`) |
| `GET /api/v1/health/db` solo admin: 401 sin credencial, 403 otro rol, diagnóstico sin secretos | `backend/app/routers/health.py`, `docs/RELEASE3.md` |
| Alias RBAC (`AdminOnly`, `WeatherReader`, `PredictionReader`, `QualityReader`, `TaskManager`, etc.) | `backend/app/routers/deps.py` |
| `GET /api/v1/weather/current\|readings\|historical\|correlation/impact` → `WeatherReader` = admin, veterinario, operario, alimentación; aviso descriptivo no causal | `backend/app/routers/weather.py`, `backend/app/routers/deps.py` |
| `POST /api/v1/weather/sync` → `AdminOnly`; AEMET opt-in o fallback sintético | `backend/app/routers/weather.py` (`weather_sync`), `backend/app/services/aemet_client.py` |
| `GET /api/v1/predictions/*` → admin, veterinario, alimentación | `backend/app/routers/predictions.py` |
| `GET /api/v1/zones`, `/boxes-recria` autenticado; `POST|PUT /api/v1/zones/*` solo admin; TV solo lectura | `backend/app/routers/zones.py`, `README.md` (LeanFarming/TV), frontend `/tv` |
| `/api/v1/admin/synthetic/*` (scheduler run/pause/resume, reset) y `POST /api/v1/admin/seed-data` → solo admin, prohibidos en producción | `backend/app/routers/synthetic_scheduler.py`, `backend/app/routers/admin.py` |
| Usuarios demo: `admin`, `roberto.castro` (admin), `operario.zona` (operario), `laura.fernandez` (alimentación), `dr.mendez` (veterinario); solo si `INITIAL_DEMO_PASSWORD` no vacía y entorno demo | `backend/app/main.py` (`seed_demo_user`), `.env.example` |

### Datos sintéticos (`r5-synthetic-data.mmd`)

| Elemento del diagrama | Fuente real |
|---|---|
| `GENERATOR_VERSION=1.0.0`, `SOURCE=synthetic/generated`, perfiles `small` 8 / `demo` 200 / `load` 1000, 9 escenarios, UUID5, provenance por registro | `backend/app/synthetic_data.py`, `docs/SYNTHETIC_DATA.md` |
| `generate_synthetic.py --profile --scenario --seed --check`; `quality_report` (manifiesto, provenance, unicidad, referencias, rangos), salida 1 si falla | `backend/scripts/generate_synthetic.py`, `docs/SYNTHETIC_DATA.md` |
| `seed_realistic_data.py` idempotente, RNG fija, vía `POST /api/v1/admin/seed-data` | `backend/scripts/seed_realistic_data.py`, `backend/app/routers/admin.py` |
| `run_synthetic_scheduler.py --once/--interval --profile --scenario`; repetición = `omitidos`, sin duplicar; heartbeat | `backend/scripts/run_synthetic_scheduler.py`, `backend/app/synthetic_scheduler.py`, `docker-compose.yml`, `OPERATIONS.md` |
| `reset` solo filas `synthetic/generated`, sin destruir esquema | `backend/app/routers/synthetic_scheduler.py` (`reset_synthetic`), `OPERATIONS.md`, `scripts/demo.py` |
| Respuestas con `provenance` + aviso (ilustrativo, no clínico); `aemet_failure` = fallback sintético | `backend/app/routers/weather.py`, `backend/app/contracts.py` (`provenance`, `canonical_source`) |
| Pantallas `/quality`, `/tasks`, `/incidents`, `/predictions`, `/tv` con etiquetas honestas | `docs/RELEASE4.md`, `docs/RELEASE4-R4-5-matriz-e2e.md`, frontend |

## 6. No representado deliberadamente (no es arquitectura prevista)

- Redis, Celery, TimescaleDB, S3, modelos ML, WebSocket/SSE, nuevos
  proveedores meteo, datos reales o despliegue R6/productivo: no existen
  en `docker-compose.yml`, `backend/app/main.py` ni `OPERATIONS.md` y por
  eso no se dibujan. La mención a Redis en `backend/app/security.py`
  (`LoginRateLimiter`) es un comentario de escalado futuro, no un
  componente implementado.
- `ACCESS_TOKEN_EXPIRE_MINUTES` en `.env.example` es claridad demo; el
  contrato canónico 8 h vive en `backend/app/config.py`
  (`access_token_expire_minutes = 480`, ver `docs/RELEASE3.md`).
- Overrides históricos (`docker-compose.task.yml`,
  `docker-compose.verification.yml` en `OPERATIONS.md`) no se dibujan:
  la vista de contenedores refleja solo la base `tfm_r3_demo`.
- P2 pendiente (contrato `GET alerts por animal` 404/422/200 y
  `estadisticas` calculadas, ver matriz R5-RF-07/R5-RF-08) no altera la
  arquitectura dibujada; se corregirá en su fase sin añadir servicios.

## 7. Verificación

- Enlaces internos y rutas referenciadas comprobadas contra el árbol en
  la base indicada; `git diff --check` limpio antes del commit.
- Cuatro vistas exactas bajo `docs/diagrams/`; ningún componente
  inexistente; ninguna afirmación productiva.
