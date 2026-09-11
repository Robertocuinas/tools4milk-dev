# TOOLS4MILK — R5: manual de demostración y presentación

Estado R5: `IN_PROGRESS`. Manual operativo y académico en español. No es
certificación: el gate E2E R5 cerró `NOT_READY` (`t_712c60bc`: 4 passed /
1 failed / 3 no ejecutados por contraste TaskCard, §7). Este manual
distingue **pasos disponibles** (recorrido ejecutable) de **afirmaciones
de prueba** (solo lo verificado). Cubre `R5-RF-06` (ver
`docs/R5_REQUIREMENTS_TRACEABILITY.md`, `docs/RELEASE5.md` y el capítulo
de limitaciones `docs/R5_LIMITATIONS_VALIDITY_REPRODUCIBILITY.md`).

Tiempo orientativo: 30–40 min (10 preparación + 20 recorrido + 5–10
preguntas). Público: evaluador académico. Todo dato es sintético y
ficticio.

## 1. Preparación local (flujo oficial)

Requisitos: Python 3.12+, Docker Desktop corriendo, 4 GB RAM libres,
puertos 80/3000/5432/8000 libres, repo en rama/commit declarado con
`git status` limpio.

```bash
git clone https://github.com/Robertocuinas/tools4milk-dev.git
cd tools4milk-dev
python scripts/demo.py init     # genera .env local con secretos aleatorios; idempotente
python scripts/demo.py status   # confirma estado antes de levantar
```

Referencias: `scripts/demo.py` (`init|up|status|smoke|reset|down`,
`--dry-run` global), `OPERATIONS.md` §1, `.env.example` (solo
placeholders `CAMBIAME-…`, nunca valores reales). `init` no sobrescribe
un `.env` existente sin `--force` y ningún comando imprime secretos.
Para consultar las credenciales demo, abrir el `.env` local en el
editor; no pegarlas en logs, issues, chat ni CI. Ensayo sin Docker:

```bash
python scripts/demo.py up --dry-run
python scripts/demo.py smoke --dry-run
```

## 2. Arranque aislado `tfm_r5_demo`

El proyecto Compose canónico del script en este árbol es `tfm_r3_demo`
(`scripts/demo.py`, `COMPOSE_PROJECT`; `.env.example`,
`COMPOSE_PROJECT_NAME`; `OPERATIONS.md`). La serie R5 aislada usa el
proyecto `tfm_r5_demo` (parametrización `--project-name` de `t_8d8f9f9e`,
integración `29306df`, levantado `t_4f08f2a5`). Ningún comando toca
recursos de otros proyectos. Verificar el flag disponible en el árbol
usado (`python scripts/demo.py up --help`) y, si no existe, aislar con
Compose explícito:

```bash
python scripts/demo.py up                  # levanta el stack demo (5 servicios)
python scripts/demo.py status              # db/backend/frontend/nginx/scheduler Up healthy
curl http://127.0.0.1:8000/health          # {"status":"ok"} (backend directo, preflight)
curl http://127.0.0.1:80/health            # 200 vía Nginx (puerta del gate)
```

Preflight esperado (evidencia `t_4f08f2a5`): 5/5 servicios healthy y
`/` 200, `/tv` 200, `/leanfarming` 307 (redirección a login sin sesión)
vía Nginx. Importante: el frontend usa API same-origin y **solo
resuelve vía Nginx (`http://127.0.0.1:80`)**; el acceso directo a
`http://127.0.0.1:3000` devuelve login 404 + «Sistema desconectado» y
no es ruta soportada (sonda inválida documentada en `t_712c60bc`).
Toda la demo se navega por `:80`.

## 3. Credenciales demo: inyección efímera y redactada

- Origen: `.env` local, clave `INITIAL_DEMO_PASSWORD` (generada por
  `init`). Usuarios sembrados (ficticios, ver `backend/app/main.py`,
  `seed_demo_user`): `admin`, `roberto.castro` (admin),
  `operario.zona` (operario), `laura.fernandez` (alimentacion),
  `dr.mendez` (veterinario).
- Regla: la contraseña vive **solo en memoria**. Para el gate
  Playwright se inyecta por entorno (`TFM_DEMO_PASSWORD`, ver
  `frontend/playwright/demo-credentials.ts`: el spec aborta si falta;
  jamás lleva literal). En este documento y en cualquier captura se
  escribe `[REDACTED]`.
- Ejemplo de lectura redactada (no contiene valor):

```bash
grep INITIAL_DEMO_PASSWORD .env   # muestra que existe; no pegar el valor
# TFM_DEMO_PASSWORD=[REDACTED] PLAYWRIGHT_BASE_URL=http://127.0.0.1:80 \
#   npx playwright test release1-smoke-portable --workers=1
```

- El smoke del script (`python scripts/demo.py smoke`: `/health`,
  login demo, `/auth/me`, scheduler, reset sintético) usa cookies solo
  en memoria (`CookieJar`, `jar.clear()` al final) y no deja archivos
  residuales.

## 4. Recorrido de roles y RBAC permitido

Roles del sistema (autoritativos, del JWT/`/auth/me`; ver
`frontend/src/lib/role-capabilities.ts`): `admin` (todo),
`veterinario`, `operario`, `alimentacion`. Recorrido permitido en esta
demo:

| Rol demo | Usuario ficticio | Qué mostrar | Qué NO puede |
|---|---|---|---|
| admin | `admin` | Todo: `/dashboard`, `/leanfarming`, `/integration` (panel operativo, reset con doble confirmación solo-sintético), `/audit-log`, `/management`, `/settings` | — |
| veterinario | `dr.mendez` | `/animals`, tratamientos, lactaciones, `/quality`, `/predictions` (banner experimental), alertas y resolución, incidencias | Panel `/integration`, gestión de usuarios |
| alimentación | `laura.fernandez` | Animales, lactaciones, calidad, tareas, pedidos (`/orders`), maquinaria, zonas | Panel `/integration`, tratamientos |
| TV solo lectura | sin login, `/tv` | `TvShell` + KPIs + paneles por zona; actualiza por consultas, sin mutaciones ni controles de escritura; muestra origen sintético y estado de actualización | Cualquier escritura (no existe en `/tv`) |

Notas honestas: `operario` (`operario.zona`) existe pero queda fuera
del guion corto (tareas, incidencias, maquinaria, handover); roles
desconocidos degradan a acceso mínimo equivalente a `operario`
(`normalizeRole`). Sin `capability`, el backend responde 403 en español
(p. ej. `operario` ante resolución de alertas o predicciones).

## 5. Datos sintéticos de la sesión

Perfil y escenarios visibles: generador `1.0.0` (`backend/app/synthetic_data.py`),
perfiles `small`/`demo`/`load`, escenarios `normal`, `delayed_tasks`,
`critical_machinery`, `health_alert`, `seasonal_variation`,
`degraded_quality`, `aemet_failure`, `degraded_connectivity`,
`incomplete_data` (ver `docs/SYNTHETIC_DATA.md`). Cada pantalla con
datos lleva `SyntheticMarker` (origen sintético persistente).
`incomplete_data` se muestra como estado vacío/DQ honesto, nunca como
cero. La meteorología es descriptiva (`impacto_productivo: null`,
ubicación «Villalba, Lugo»); las predicciones llevan banner
experimental con «no implica causalidad ni validez predictiva, clínica
o productiva».

## 6. Secuencia de demostración (guion, ~20 min)

1. (2 min) `/dashboard` como `admin` (vía `:80`): KPIs sintéticos,
   `SyntheticMarker` visible. Decir: datos ficticios, nada productivo.
2. (4 min) `/leanfarming` (kanban por zonas): tarjetas `programada`,
   `retrasada`, `ejecutada`; vistas zonas/lista, carga, catálogo.
   Transición de una tarea y reasignación. Observar: cambio de estado
   inmediato, trazabilidad de zona y asignado.
3. (3 min) `/tasks` pestaña Retrasadas + `/incidents`: escenario
   `delayed_tasks`/`health_alert` ligado a animal.
4. (4 min) `/quality` + `/predictions` + asociación meteo: serie con
   lecturas y provenance, granulares, Pearson con soporte; banner
   experimental; composición en 0 (placeholder declarado).
5. (3 min) `/tv` sin login: paneles por zona (Recria/Nave), KPIs,
   estado de actualización. Observar: solo lectura, sin botones de
   escritura.
6. (2 min) Como `dr.mendez`: tratamiento y resolución de alerta.
   Como `laura.fernandez`: pedido y lectura de calidad. Mostrar un 403
   honesto (p. ej. `operario` ante `/predictions`) si se pregunta por
   permisos.
7. (2 min) `/integration` como `admin`: estado del scheduler
   (`paused`, creados/omitidos), `weather sync` sin secretos, reset
   sintético con doble confirmación (alcance solo
   `synthetic/generated`).

## 7. Qué debe observarse y qué NO afirmar

Observar: navegación por `:80`, login por rol, `SyntheticMarker` y
provenance (`source: generated`, `mode: synthetic`), transiciones de
tareas, scheduler materializando recurrencias cada hora (repetir solo
incrementa `omitidos`, nunca duplica), reset limitado a sintético,
`/tv` sin mutaciones, 403 en español sin capability.

NO afirmar (pendiente, gate `NOT_READY`): que el smoke portable pasa
8/8 (real: 4 passed / 1 failed / 3 no ejecutados), que accesibilidad
está certificada (real: 1 Axe `serious` pendiente — contraste 4.48 de
`text-app-dim` sobre `bg-state-info/10` en tarjetas `programada`,
`TaskCard.tsx:55/66/87` —; 0 `critical`), que transiciones/scheduler/
lectura fueron ejercitados en la corrida 1 (no ejecutados por corte
serial; segunda corrida pendiente), ni nada productivo/clínico/causal.

## 8. Cómo ejecutar el gate sin revelar secretos

```bash
python scripts/demo.py status
# Correr el gate portable con secretos solo en memoria (no se escribe el valor):
#   TFM_DEMO_PASSWORD=[REDACTED] (leer de .env local en el momento)
#   PLAYWRIGHT_BASE_URL=http://127.0.0.1:80 npx playwright test \
#     release1-smoke-portable --workers=1
# (El spec portable pertenece a la serie R5 —commit 14d7950, integrado
# en 1821920/29306df— y se ejecuta sobre ese árbol, no sobre este HEAD
# documental 68132c2; ver nota de trazabilidad en
# docs/R5_LIMITATIONS_VALIDITY_REPRODUCIBILITY.md §5.)
# Gate estático previo (sin secretos, 4/4 en la integración 1821920):
#   npx playwright test release1-smoke-portable.static --workers=1
```

Controles: `workers=1` serial, base `:80` (nunca `:3000` directo),
`reset` sintético antes de corrida certificante, registrar resultado
con traza Axe. Fallos de red/puertos/Docker = entorno, no regresión.

## 9. Teardown limitado a `tfm_r5_demo`

```bash
python scripts/demo.py down            # apaga SOLO el proyecto demo usado
# Con volúmenes (borra datos demo) solo si se declara: --volumes --yes
git diff --check                       # limpio antes de cerrar
```

Prohibido: tocar otros proyectos Compose, contenedores o volúmenes
ajenos; `down` con `--volumes` sin confirmación explícita; dejar
`.env` con valores reales fuera del local; publicar capturas con
secretos o PII (no hay PII: todo es ficticio).
