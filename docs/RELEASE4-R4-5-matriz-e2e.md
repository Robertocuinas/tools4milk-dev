# R4-5 — Matriz E2E de escenarios DSS sintéticos

## Semilla fijada

- profile=`small`, seed=`20260910`,
  simulation_time=`2026-09-10T12:00:00+00:00`,
  generador canónico `backend/app/synthetic_data.py`
  (`GENERATOR_VERSION=1.0.0`, provenance `synthetic/generated`).
- Sin datos manuales ad hoc: los mocks de Playwright reproducen la huella
  diferencial del generador (ver `backend/tests/test_r4_scenario_matrix.py`).
- La ausencia de datos (`incomplete_data`) se muestra como estado vacío/DQ
  honesto; nunca se confunde con valor cero ni se inventan puntos.

## Matriz mínima (5 escenarios)

| Escenario | Recorrido UI | Huella verificada |
|---|---|---|
| `normal` | `/quality` | Serie con 3 lecturas, orden cronológico, provenance visible |
| `delayed_tasks` | `/tasks` (pestaña Retrasadas) | Tareas `retrasada` visibles, resto de huella intacto |
| `health_alert` | `/incidents` | Alerta `health_alert` ligada a animal, sin lenguaje de cero |
| `degraded_quality` | `/predictions` + Asociación meteo | Vistas granulares + Pearson con soporte (`sufficient`) |
| `incomplete_data` | `/quality` + `/predictions` meteo | `Sin datos suficientes` en ambas; correlación `insufficient_data` |

Cobertura heredada intacta: R3 8/8 (release2-contract 5 + full-matrix 2 +
offline 1) más specs R4 (alert-resolution 3, quality-trend 1,
correlation 3, operational-panel 4). R4-5 añade
`release4-scenario-matrix` (6 tests: 5 escenarios + barrido axe viewports).

## Permisos y etiquetas honestas

- `operario` sin capability no ve resolución de alertas ni predicciones
  (403 con mensaje en español); TV permanece solo lectura.
- Predicciones y correlación llevan banner experimental y aviso
  «no implica causalidad ni validez predictiva, clínica o productiva».
- Panel operativo (`/integration`) solo `admin`; reset con doble
  confirmación y alcance solo-sintético; weather sync sin secretos.

## Accesibilidad

- Axe en cada recorrido R4-5 (gate: cero violaciones `serious`/`critical`).
- Barrido de viewports representativos móvil (390×844) y escritorio
  (1440×900) sobre `/quality` y `/predictions`.

## Gate reproducible (orden)

```bash
# 1. Backend completo + CLI
python -m pytest backend/tests -q
python -m pytest tests/test_demo_cli.py -q

# 2. Frontend estático + build
cd frontend && npm run typecheck && npm run lint && npm run build

# 3. Auditoría runtime (sin --force)
cd frontend && npm audit --omit=dev --audit-level=high

# 4. OpenAPI determinista (doble generación + sha256)
#    (ver backend/tests/test_openapi_docs.py)

# 5. Playwright completo (R3 sin regresión + R4)
cd frontend && npx playwright test

# 6. Limpieza
git diff --check
# teardown: detener servidores propios, sin Docker ajeno, sin acciones remotas
```

## Verificación R4-5 (2026-09-10)

- Backend: `python -m pytest backend/tests -q` → **182 passed** (incluye
  `test_r4_scenario_matrix.py` 10/10).
- CLI: `python -m pytest tests/test_demo_cli.py -q` → **8 passed**.
- Frontend: `typecheck` + `lint` + `build` sin errores.
- Audit runtime: `npm audit --omit=dev --audit-level=high` → **0 vulnerabilidades**.
- OpenAPI determinista: doble generación idéntica, sha256
  `fea4835f7d2d4830907702581dfca744b988aa355d1de2241f6bee2122ee55e1`
  (incluye `/animals/{animal_id}/readings`, `/weather/correlation/impact`,
  `/health/db`).
- Stack demo: `scripts/demo.py up/smoke` → **5/5**; scheduler `small` 42 creadas.
- Playwright **25/25**: R3 8/8 (contract 5 + full-matrix 2 + offline 1, los 3
  con login contra stack `tfm_r3_demo` en `:80`) + R4 17/17
  (alert-resolution 3, quality-trend 1, correlation 3, operational-panel 4,
  scenario-matrix 6).
- Axe: cero `serious`/`critical` en los 6 recorridos R4-5 y barrido
  móvil/escritorio. Hallazgos corregidos en esta tarjeta: texto de badges
  sobre tintes (tokens `state-*-ink` en `globals.css`) y `select` de filtro
  de incidencias sin nombre accesible (+ asociación `label`/`id` en modales
  de tareas e incidencias).

## Advertencia académica

Demo sintética y ficticia para un TFM: sin PII, sin ML, sin AEMET
obligatorio, sin Redis/Celery/TimescaleDB/S3/WebSocket. Ningún indicador,
predicción o asociación autoriza decisiones clínicas, productivas o
comerciales; la correlación es descriptiva sobre la muestra incluida.
