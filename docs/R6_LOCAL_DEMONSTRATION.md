# TOOLS4MILK — R6: contrato de demostración local efímera y diferimiento Azure

Estado: `READY_FOR_LOCAL_DEMO` (contrato versionado, sin despliegue ejecutado).
Base: `7dab7a3` (main local integrado). Proyecto aislado: `tfm_r6_demo`.
Alcance R6 actual: **solo local, efímero y restringido a loopback**. Azure queda
explícitamente **diferida** (§9). Datos exclusivamente sintéticos/ficticios.

Este documento es el contrato que la certificación posterior debe ejecutar y
evidenciar. No levanta Docker por sí mismo; describe el flujo oficial, los
gates y el teardown. No contiene secretos ni PII.

## 1. Alcance y exclusiones

Incluye:

- Definición versionada de la demo local efímera R6 sobre el árbol base.
- Secuencia oficial `init/up/status/smoke/reset/down` con
  `--project-name tfm_r6_demo` (§4).
- Arquitectura local real verificada por lectura (§2), healthchecks (§5),
  datos sintéticos (§6), RBAC de demostración (§7) y manejo de secretos (§8).
- Gates de certificación posterior y evidencia esperada (§10–§11).
- Teardown oficial sin afectar recursos Docker ajenos (§12).
- Diferimiento Azure documentado por separado, sin diseñar ni implementar
  nada Azure (§9).

Excluye explícitamente:

- Levantar Docker, desplegar, crear infraestructura o exponer puertos públicos.
- Cualquier recurso, manifiesto, cuenta, secreto, pipeline o configuración Azure.
- `.env` real, credenciales reales o valores de producción versionados.
- Push, tag, PR, merge en `main` o cualquier acción remota (`remote_actions:none`).
- Cambios fuera de este documento (`docs/R6_LOCAL_DEMONSTRATION.md` único fichero).
- Claims clínicos, datos productivos o PII.

## 2. Arquitectura local real (verificada por lectura)

Fuente: `docker-compose.yml` (5 servicios), `nginx/nginx.conf`,
`scripts/demo.py`, `.env.example`, `backend/app/main.py`, `.gitignore`.

| Servicio | Imagen/build | Bind | Healthcheck |
|---|---|---|---|
| `db` | `postgres:15-alpine`, volumen `postgres_data`, `./database/init.sql` | `127.0.0.1:5432:5432` | `pg_isready -U postgres -d tools4milk` |
| `backend` | `build: ./backend`, `uvicorn app.main:app --host 0.0.0.0 --port 8000` | `127.0.0.1:8000:8000` | `GET http://127.0.0.1:8000/health` |
| `scheduler` | `build: ./backend`, `run_synthetic_scheduler.py` | sin puertos | heartbeat `/tmp/tools4milk-scheduler-alive` (fresco < 2×intervalo+600 s) |
| `frontend` | `build: ./frontend`, `NEXT_PUBLIC_API_URL=""`, `PORT 3000` | `127.0.0.1:3000:3000` | `wget --spider http://127.0.0.1:3000/` |
| `nginx` | `nginx:alpine`, `./nginx/nginx.conf:ro` | `127.0.0.1:80:80` | `wget --spider http://127.0.0.1/health` |

Proxy Nginx same-origin (`nginx/nginx.conf`): `/api/`, `/health`, `/docs`,
`/redoc`, `/openapi.json` → `backend:8000`; `/` → `frontend:3000`.
Todo el stack escucha solo en loopback; no hay despliegue público.
Dependencias: `backend` espera `db` sana; `scheduler` espera `db` + `backend`
sanas; `nginx` espera `backend` + `frontend` sanos.

## 3. Requisitos de Docker y loopback

- Docker Desktop/Engine corriendo, Compose v2 (`docker compose`).
- Python 3.12+ (stdlib) para `scripts/demo.py`.
- Puertos libres en loopback: `80`, `3000`, `5432`, `8000` (todos bindeados a
  `127.0.0.1` en `docker-compose.yml`).
- 4 GB RAM libres orientativos.
- Repo en commit base declarado con `git status` limpio.
- Sin TLS: la demo es HTTP local; cualquier exposición pública futura exigiría
  dominio + TLS y queda fuera de R6 local (§9).

## 4. Secuencia oficial (proyecto `tfm_r6_demo`)

El script canónico es `scripts/demo.py` con subcomandos
`init|up|status|smoke|reset|down`, flags globales `--dry-run` y
`--project-name`. El proyecto por defecto del árbol es `tfm_r3_demo`; la serie
R6 usa exactamente `tfm_r6_demo` (validado: `validate_project_name` acepta
`[a-z0-9_-]+`, dry-run verificado §13).

```bash
python scripts/demo.py --project-name tfm_r6_demo --dry-run init    # ensayo sin cambios
python scripts/demo.py --project-name tfm_r6_demo init              # genera .env local (no versionado)
python scripts/demo.py --project-name tfm_r6_demo up                # docker compose -p tfm_r6_demo up -d --build
python scripts/demo.py --project-name tfm_r6_demo status            # compose ps + /health
python scripts/demo.py --project-name tfm_r6_demo smoke             # verificación reproducible
python scripts/demo.py --project-name tfm_r6_demo reset             # solo filas sintéticas
python scripts/demo.py --project-name tfm_r6_demo down              # apaga solo tfm_r6_demo
```

Equivalencias Compose verificadas por dry-run:

- `up` → `docker compose -p tfm_r6_demo -f docker-compose.yml up -d --build`
- `status` → `docker compose -p tfm_r6_demo -f docker-compose.yml ps`
- `down` → `docker compose -p tfm_r6_demo -f docker-compose.yml down`

Ningún comando toca recursos de otros proyectos cuando se pasa
`--project-name tfm_r6_demo`. No usar `down --volumes` salvo reset total
acordado; `reset` es el path de limpieza de datos sintéticos.

## 5. Healthchecks y sondas

| Sonda | Qué prueba | Gate |
|---|---|---|
| `curl http://127.0.0.1:8000/health` | backend directo `{"status":"ok"}` | preflight |
| `curl http://127.0.0.1:80/health` | Nginx → backend (puerta del gate) | obligatorio |
| `docker compose -p tfm_r6_demo ps` | 5 servicios `Up (healthy)` | obligatorio |
| `python scripts/demo.py --project-name tfm_r6_demo status` | wrapper oficial del anterior + `/health` | obligatorio |
| heartbeat scheduler | worker sintético vivo | informativo |
| `GET /api/v1/health/db` (solo admin) | BD accesible tras login | certificación |

## 6. Datos sintéticos

Exclusivamente sintéticos/ficticios; sin PII ni claims clínicos/productivos.
Orígenes: scheduler (`SYNTHETIC_INTERVAL_SECONDS`, `SYNTHETIC_PROFILE=small`,
`SYNTHETIC_SEED`, `SYNTHETIC_SCENARIO=normal` en `.env.example`) y endpoints
sintéticos del backend. AEMET es opt-in vacío por defecto (`AEMET_API_KEY=`
vacía → fallback sintético). `reset` limpia solo filas sintéticas sin tocar
esquema ni volumen. En `production` los endpoints sintéticos deben estar
deshabilitados (gate heredado del parent `t_9a777780`).

## 7. RBAC de demostración (solo dev/demo/test)

El backend crea 5 cuentas demo solo si `INITIAL_DEMO_PASSWORD` no está vacía
(`backend/app/main.py`): `admin`, `roberto.castro`, `operario.zona`,
`laura.fernandez`, `dr.mendez` (dominios `…@tools4milk.local`, ficticios).
Roles: `admin` (admin, roberto.castro), `operario`, `alimentacion`,
`veterinario`. En `production` `INITIAL_DEMO_PASSWORD` debe quedar vacía (el
backend rechaza arrancar con valor) — la demo R6 nunca usa `production`.
Credenciales demo: solo en `.env` local efímero, nunca versionadas, nunca en
logs/issues/CI; consultarlas abriendo `.env` en el editor.

## 8. Secretos (redacted)

- `.env.example` contiene solo placeholders `CAMBIAME-…`; la demo no arranca
  con ellos tal cual.
- `demo.py init` genera `POSTGRES_PASSWORD`, `SECRET_KEY` (token_urlsafe) e
  `INITIAL_DEMO_PASSWORD` aleatorios en `.env` local; idempotente (no
  sobrescribe sin `--force`); ningún comando imprime secretos.
- `.gitignore` excluye `.env`, `.env.local`, `.env.*.local`, `.env.production`.
- Este contrato no incluye ningún valor secreto; toda referencia es `redacted`.
- Producción futura (diferida, §9): `SECRET_KEY>=32` único,
  `POSTGRES_PASSWORD`/`DATABASE_URL` sin credenciales demo.

## 9. Diferimiento Azure (requisitos pendientes, sin diseño ni implementación)

Azure queda explícitamente diferida: en R6 local no se crea ni se diseña
ningún recurso, manifiesto, cuenta, secreto, pipeline o configuración Azure
(`azure_actions:none`). Lo siguiente sigue pendiente para una futura fase
pública y se lista solo como requisito, sin solución:

- Suscripción/propiedad: proveedor, cuenta/proyecto/región y responsable
  declarados por escrito.
- Dominio/TLS: nombre público + certificado válido; `APP_URL` https y CORS
  solo https (validados por `validate_production_config`).
- Key Vault o equivalente: custodia de `SECRET_KEY`, `POSTGRES_PASSWORD`,
  `DATABASE_URL` fuera del repo.
- Red: puertos internos no expuestos; solo 80/443 públicos vía proxy
  same-origin; firewall y reglas de exposición.
- Postgres gestionado: aprovisionamiento, backup/restore probado o exclusión
  firmada para demo efímera, cadena de conexión https/postgres sin demo.
- Observabilidad: `/health` público + `/api/v1/health/db` solo admin, logs,
  métricas, uptime y alertas en destino.
- Rollback: imágenes pineadas (`postgres:15-alpine`, `nginx:alpine`,
  `node:24`, `python:3.12`) y procedimiento redeploy/down documentado.
- Certificación pública: smoke + Playwright portable + Axe re-ejecutados
  contra URL pública y evidenciados.

## 10. Gates de certificación posterior

La fase que ejecute este contrato debe superar, como mínimo:

1. `status` con 5 servicios `healthy` en `tfm_r6_demo`.
2. `GET :80/health` 200 vía Nginx.
3. `smoke` del script oficial sin errores.
4. Login demo + `/auth/me` + RBAC verificado (admin vs no-admin).
5. Scheduler con heartbeat fresco.
6. `reset` solo-sintético verificado (datos regenerables, esquema intacto).
7. Playwright portable + Axe (0 serious/0 critical) si el gate académico lo
   exige, sobre loopback.
8. `down` oficial deja estado vacío (0 contenedores del proyecto, sin red
   huérfana) sin tocar recursos ajenos.

## 11. Evidencia esperada

- Salidas de `status`, `smoke`, `curl :80/health` y `compose ps`.
- Capturas/log de login demo y RBAC (con password redacted).
- Evidencia de `reset` (antes/después sintético).
- Evidencia de `down` (estado vacío del proyecto).
- Report Playwright/Axe si aplica.
- Todo con commit base, fecha y proyecto `tfm_r6_demo` identificables.

## 12. Teardown oficial

```bash
python scripts/demo.py --project-name tfm_r6_demo down
docker compose -p tfm_r6_demo -f docker-compose.yml ps   # vacío esperado
curl http://127.0.0.1:80/health || true                  # sin respuesta esperado
```

Solo el flujo oficial. Prohibido `docker system prune`, `down --volumes`
global o eliminar recursos de otros proyectos. El volumen `postgres_data` del
proyecto puede conservarse o eliminarse con `down --volumes -p tfm_r6_demo`
solo si se acuerda un reset total.

## 13. Verificación documental de este contrato (sin Docker levantado)

- `scripts/demo.py --help` y `--dry-run init/up/status/smoke/reset/down` con
  `--project-name tfm_r6_demo`: comandos citados existen y admiten el nombre
  (dry-run muestra `docker compose -p tfm_r6_demo …`, `POST
  /api/v1/admin/synthetic/reset`, comprobaciones `/health`, login,
  `/auth/me`, scheduler, reset).
- Paths citados verificados por lectura: `docker-compose.yml`,
  `nginx/nginx.conf`, `scripts/demo.py`, `.env.example`, `backend/app/main.py`,
  `.gitignore`.
- `git diff --check`: limpio.
- Búsqueda de secretos/PII sobre el documento: sin `SECRET_KEY=`, sin
  passwords, sin tokens, sin emails reales (solo `…@tools4milk.local`
  ficticios descriptivos de RBAC), sin `CAMBIAME` copiado como valor.
- Enlaces/rutas Markdown: todas relativas al repo y existentes.
- Sin Docker levantado, sin `.env` creado, sin acciones remotas ni Azure.
