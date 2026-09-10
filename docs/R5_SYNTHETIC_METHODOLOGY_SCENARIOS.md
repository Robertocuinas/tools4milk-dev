# TOOLS4MILK — R5: metodología sintética y catálogo de escenarios

Estado: capítulo R5 (R5-RF-03). Metodología vigente descrita desde el código
real; la evidencia histórica R4 se cita como contexto y los gates R5 quedan
como reejecutables pendientes. Documentación en español, grafía TOOLS4MILK.

- Requisito: `docs/R5_REQUIREMENTS_TRACEABILITY.md` (R5-RF-03, no editado aquí).
- Insumos reutilizados y contrastados: `docs/SYNTHETIC_DATA.md`,
  `docs/RELEASE4-R4-5-matriz-e2e.md` (histórico),
  `backend/app/synthetic_data.py`, `backend/scripts/generate_synthetic.py`,
  `backend/scripts/seed_realistic_data.py`, `backend/app/synthetic_loader.py`,
  `backend/app/services/aemet_client.py`, `backend/app/contracts.py`,
  `backend/tests/test_r4_scenario_matrix.py`,
  `frontend/playwright/release4-scenario-matrix.spec.ts`.
- Alcance de esta tarjeta: solo documenta, consolida y enlaza. No modifica el
  generador, tests, Compose ni CI. No se ejecutó Docker ni se generaron datos.

Todo lo descrito es sintético con provenance `synthetic/generated`,
identidades ficticias y distribuciones ilustrativas sin validación científica,
clínica, causal, productiva ni representatividad externa. Las predicciones son
heurística aritmética (`heuristic_arithmetic`, `validated=False`), no ML.

## 1. Flujo real del generador

Generador canónico: `backend/app/synthetic_data.py`.

- Versión: `GENERATOR_VERSION = "1.0.0"` (línea 15). Origen canónico:
  `SOURCE = "synthetic/generated"` (línea 16). Ambos quedan registrados en el
  `manifest` del dataset y en la `provenance` de cada registro (función
  `_record`, líneas 53-63): `source`, `generator_version`, `scenario_id`,
  `random_seed`, `generated_at`, `simulation_time`.
- Perfiles: `PROFILES = {"small": 8, "demo": 200, "load": 1000}` (línea 17):
  número de animales. `load` es volumen ilustrativo, no capacidad productiva.
  Cada animal genera 30 lecturas de robot (`milk_readings`, una por día
  simulado, líneas 89-108) con producción y células somáticas ilustrativas.
  Los 30 días simulados generan 60 turnos (`manana`/`tarde`, líneas 109-113).
  Zonas fijas (`barn`/`nursery`/`care`), empleados (3-12 según perfil),
  una máquina (`robot-1`), tareas (6-40 según perfil), una incidencia,
  una alerta, 30 registros meteo y una predicción.
- Seeds y valores por defecto: `GenerationRequest` fija
  `seed = 20260602`, `simulation_time = "2026-06-01T12:00:00+00:00"` y
  `generated_at` idéntico (líneas 31-37). El CLI
  (`backend/scripts/generate_synthetic.py`, líneas 29-34) usa los mismos
  valores por defecto. La matriz R4 histórica usó en cambio
  `profile=small`, `seed=20260910`,
  `simulation_time=2026-09-10T12:00:00+00:00`
  (`backend/tests/test_r4_scenario_matrix.py`, líneas 30-33;
  `docs/RELEASE4-R4-5-matriz-e2e.md`, líneas 3-8). Seed distinto implica
  dataset lógico distinto: la reproducibilidad exige fijar los cuatro
  parámetros (perfil, seed, escenario, `simulation_time`).
- Determinismo (alcance honesto): `backend/app/synthetic_data.py` no usa el
  módulo `random`; los valores derivan de fórmulas aritméticas sobre
  `seed + i + offset` (p. ej. líneas 91-92) y los UUID son UUID5 de
  `tools4milk:{versión}:{seed}:{escenario}:{entidad}:{clave}` con
  `uuid.NAMESPACE_URL` (función `_id`, líneas 48-50). La misma
  versión+seed+escenario+perfil+`simulation_time` reproduce el mismo dataset
  lógico aunque cambie `generated_at`: `logical_dataset` excluye
  deliberadamente `generated_at` de la comparación y `dataset_digest`
  (sha256 del `repr` canónico, líneas 210-228) lo demuestra; el test R4
  lo verifica regenerando dos veces (`test_matriz_es_reproducible_y_con_provenance`,
  líneas 55-69). No se declara determinismo total más allá de esto: un
  `simulation_time` distinto desplaza todas las series temporales.
- Idempotencia: el generador no conoce la base de datos (docstring, líneas
  1-6); produce un documento JSON portable. La idempotencia de carga vive en
  los adaptadores: `backend/app/synthetic_loader.py` declara escrituras
  idempotentes por ID y exige `provenance` sintético (líneas 7-9, 47-60).
  El seed ORM histórico `backend/scripts/seed_realistic_data.py` es
  idempotente por diseño distinto: solo siembra si la tabla está vacía y no
  toca datos preexistentes (líneas 13-14); es manual, no se ejecuta en el
  arranque ni en el Dockerfile (líneas 15-16). Atención: ese seed usa
  `RNG = random.Random(20260602)` (línea 70, valores deterministas) pero
  identificadores `uuid4` (línea 37), por lo que sus IDs no son
  reproducibles entre siembras: no confundir con el generador canónico UUID5.
- Validación de calidad: `quality_report` (líneas 152-207) comprueba
  manifiesto completo, `provenance.source == synthetic/generated` en cada
  fila, unicidad de IDs, integridad referencial (animales→zonas,
  tareas→empleados/zonas, lactaciones→animales, lecturas→animal/lactación/robot,
  alertas→animales) y rangos (`daily_kg` y `production_kg` en 0-100,
  `scc` en 0-1000000, temperatura meteo no nula). Devuelve
  `{"ok", "errors", "checks"}` con
  `checks = ["provenance", "uniqueness", "referential_integrity", "ranges", "manifest"]`.
  El CLI propaga el resultado: con `--check` devuelve código 1 si falla
  (líneas 44-47). `incomplete_data` está diseñado para fallar DQ de forma
  honesta (ver catálogo).
- Limitaciones de regeneración: regenerar exige el mismo `GENERATOR_VERSION`
  (cambiar la versión cambia todos los UUID5), el mismo seed, escenario,
  perfil y `simulation_time`. `generated_at` es metadato operativo y no afecta
  al contenido lógico. El seed ORM (`seed_realistic_data.py`) respeta
  `DATABASE_URL` y no debe ejecutarse contra producción sin intención
  (línea 26).

## 2. Catálogo único de escenarios (nueve)

Fuente de verdad de la huella diferencial: `backend/app/synthetic_data.py`,
líneas 78-79, 115, 118-129, 146-148. Cobertura citada solo cuando existe en
`backend/tests/test_r4_scenario_matrix.py` o
`frontend/playwright/release4-scenario-matrix.spec.ts`; en caso contrario se
marca explícitamente como pendiente/no demostrada y no se inventa.

| Escenario | Propósito descriptivo (académico, sin claims) | Condiciones / huella observable documentada | Cobertura existente | Límites explícitos |
|---|---|---|---|---|
| `normal` | Línea base descriptiva: comportamiento nominal del generador para comparar el resto de huellas. | Tareas `pendiente`; alerta `media`; incidencia `baja` sin `animal_id`; `quality_report.ok == True` (test, líneas 71-77). | Demostrada: `test_normal_es_linea_base` + Playwright `/quality` (serie + provenance). | No representa ninguna explotación real; valores ilustrativos. |
| `delayed_tasks` | Describir el estado "tareas retrasadas" como huella de planificación sintética. | Todas las tareas `retrasada`; resto de huella idéntico a `normal` (alerta `media`, DQ ok; test, líneas 79-84). | Demostrada: `test_delayed_tasks_marca_retrasadas` + Playwright `/tasks` (pestaña Retrasadas). | No mide causas ni tiempos reales de trabajo; solo etiqueta de estado. |
| `critical_machinery` | Describir una avería sintética del robot y su reflejo en incidencia/alerta. | Maquinaria `robot-1` con `status = "averiada"` (línea 78-79); incidencia `alta` ligada a `machinery_id`; alerta `alta` (líneas 118-119). DQ pasa. | Parcial / no demostrada como huella diferencial: implementada en el generador; el smoke legacy `e2e/release1-smoke.mjs` (líneas 81-92) ejercita `scheduler/run?scenario=critical_machinery` como disponibilidad, sin aserción de huella. Sin test dedicado en `test_r4_scenario_matrix.py` ni recorrido Playwright R4-5. | Pendiente de aserción dedicada; no autoriza decisiones de mantenimiento. |
| `health_alert` | Describir una alerta sanitaria sintética ligada a un animal y su reflejo en células somáticas ilustrativas. | Animal 0 con `scc + 260000` los últimos 7 días (línea 93-94); alerta `alta`; incidencia `alta` ligada a `animal_id` del animal 0 (líneas 118-119); DQ pasa. | Demostrada: `test_health_alert_eleva_scc_y_liga_incidente` (líneas 86-95) + Playwright `/incidents`. | Valores de `scc` ilustrativos; sin validez clínica ni veterinaria. |
| `seasonal_variation` | Describir variación estacional sintética de temperatura. | `temperature_c + 10.0` en los 30 registros meteo (líneas 124-125). Resto idéntico a `normal`. | Pendiente / no demostrada: implementada en el generador; sin test dedicado ni recorrido E2E que la aserte. | Desplazamiento aritmético fijo, no serie climática real ni calibrada. |
| `degraded_quality` | Describir degradación sintética de calidad de leche y su reflejo en predicción heurística. | Últimos 7 días: `production_kg × 0.72` y `scc + 220000` (líneas 95-97); predicción `18.0` (líneas 128-129); alerta `alta`; DQ pasa (test, líneas 97-105). | Demostrada: `test_degraded_quality_cae_produccion_y_prediccion` + Playwright `/predictions` + asociación meteo con soporte. | Heurística aritmética (`method = "heuristic_arithmetic"`, `validated = False`); no implica causalidad ni validez predictiva, clínica o productiva. |
| `aemet_failure` | Describir el comportamiento ante fallo de la integración meteorológica externa. | Sin huella diferencial en el generador: el dataset es idéntico a `normal` salvo `scenario_id`/`provenance`. El comportamiento de fallo vive en `AemetClient.sincronizar_datos` (`backend/app/services/aemet_client.py`, líneas 46-62): sin `AEMET_API_KEY` devuelve modo `generated` (fallback sintético de 7 registros); con clave y fallo de red devuelve `status = "error"`, `modo = "aemet_real"`, cero registros y mensaje con secreto redactado. | Parcial / no demostrada como escenario: `docs/SYNTHETIC_DATA.md` (línea 12) declara el fallback; el smoke legacy ejercita `scheduler/run?scenario=aemet_failure` como disponibilidad (`e2e/release1-smoke.mjs`, línea 87); `test_operational_panel.py` (líneas 56-67) verifica el modo `generated` sin secretos. Sin test que aserte la huella del escenario `aemet_failure` del generador. | No promete red ni datos externos; `aemet_failure` del generador no simula por sí mismo el fallo de red. |
| `degraded_connectivity` | Describir operación con conectividad degradada (patrón offline). | Sin huella diferencial en el generador: dataset idéntico a `normal` salvo `scenario_id`/`provenance`. El patrón offline vive en el contrato de resiliencia: `docs/RELEASE2_RESILIENCE_CONTRACT.md` (líneas 59-73) usa `scenario_id = "degraded_connectivity"` como ejemplo de `synthetic_provenance` en respuestas con `version` monotónica y `X-Operation-Id`/`expected_version` (líneas 79-104). | Pendiente / no demostrada en el generador: sin test ni recorrido E2E que aserte huella diferencial de este escenario. El contrato R2 asociado tiene su propia cobertura de resiliencia, no vinculada a este `scenario_id`. | Etiqueta sin efecto en el dataset; no demuestra sincronización real ni resolución de conflictos. |
| `incomplete_data` | Describir ausencias intencionales para verificar que la calidad de datos las detecta sin confundirlas con cero. | `animals[0].zone_id = None` y `weather[0].temperature_c = None` (líneas 146-148); `quality_report.ok == False` con errores `animal missing required zone` y `weather missing required temperature` (test, líneas 107-114). | Demostrada: `test_incomplete_data_es_dq_honesto_no_cero` + Playwright `/quality` y `/predictions` meteo con estado `Sin datos suficientes` / correlación `insufficient_data`. | Las ausencias son intencionales y puntuales; no representan patrones reales de missingness. |

Resumen de cobertura honesta: cinco escenarios con huella diferencial
demostrada por tests dedicados (`normal`, `delayed_tasks`, `health_alert`,
`degraded_quality`, `incomplete_data`); cuatro con implementación en el
generador pero sin aserción dedicada de su huella (`critical_machinery`,
`seasonal_variation`, `aemet_failure`, `degraded_connectivity`), de los cuales
los dos últimos además carecen de huella diferencial en el generador por
diseño (su comportamiento real vive en el cliente AEMET y en el contrato de
resiliencia, respectivamente).

## 3. Metodología vigente, evidencia histórica y gates R5

- Metodología vigente (este capítulo): lo descrito en las secciones 1-2 y 4,
  trazable línea a línea al código citado.
- Evidencia histórica R4 (contexto, no evidencia R5):
  `docs/RELEASE4-R4-5-matriz-e2e.md`, sección "Verificación R4-5
  (2026-09-10)": backend 182 passed (incluye `test_r4_scenario_matrix.py`
  10/10), CLI 8 passed, typecheck+lint+build ok, `npm audit` 0 high, OpenAPI
  sha `fea4835f…`, demo 5/5, Playwright 25/25, axe cero serious/critical.
  Matriz mínima de 5 escenarios con semilla `20260910` (sección "Matriz
  mínima"). Se cita, no se reclama.
- Gates R5 aún no ejecutados (reejecutables, ver R5-RF-03):
  `python backend/scripts/generate_synthetic.py --help` y
  `python -m pytest backend/tests/test_r4_scenario_matrix.py -q`, con
  resultados a registrar como evidencia R5 en la fase correspondiente
  (R5-RF-04). Esta tarjeta no los ejecuta por alcance explícito.

## 4. AEMET como integración opcional

- Variables: `aemet_api_key` (vacío por defecto), `aemet_municipio_id`
  (`27065`), `aemet_estacion_id` (`backend/app/config.py`, líneas 41-43).
- Comportamiento (`backend/app/services/aemet_client.py`,
  `backend/app/routers/weather.py`, líneas 142-149): `POST /weather/sync`
  (solo `admin`) sincroniza pronóstico real solo si hay clave válida;
  sin clave usa fallback sintético (`modo = "generated"`); ante fallo con
  clave devuelve error honesto (`modo = "aemet_real"`, cero registros,
  secreto redactado). Los tests fijan `AEMET_API_KEY = ""`
  (`backend/tests/conftest.py`, línea 16) y verifican el modo generado sin
  exponer claves (`backend/tests/test_operational_panel.py`, líneas 56-67).
- Provenance: el contrato admite `source ∈ {"generated", "aemet_real"}`
  (`backend/app/contracts.py`, líneas 6-13; `backend/app/schemas/api.py`;
  `backend/app/openapi.py`, línea 34). El generador sintético solo emite
  `synthetic/generated`; `aemet_real` queda reservado a la integración
  externa opt-in (`docs/SYNTHETIC_DATA.md`, líneas 11-12).
- Límites: no se promete disponibilidad de red, frescura ni exactitud de
  datos externos; la demo funciona sin AEMET.

## 5. Procedimiento reproducible (reejecutable, sin secretos)

No ejecutado en esta tarjeta por alcance; comandos existentes, sin valores
sensibles. Ejecutar desde la raíz del repositorio salvo indicación.

```bash
# 1. Ayuda del CLI (gate R5-RF-03, parte 1)
python backend/scripts/generate_synthetic.py --help

# 2. Generar y validar un dataset por escenario (ejemplos de docs/SYNTHETIC_DATA.md)
python backend/scripts/generate_synthetic.py --profile demo --scenario normal --output artifacts/demo.json --check
python backend/scripts/generate_synthetic.py --profile small --scenario health_alert --seed 7 --check

# 3. Barrido de los nueve escenarios (misma forma, distinto --scenario)
for s in normal delayed_tasks critical_machinery health_alert seasonal_variation degraded_quality aemet_failure degraded_connectivity incomplete_data; do
  python backend/scripts/generate_synthetic.py --profile small --scenario "$s" --output "artifacts/synthetic-$s.json" --check || echo "DQ falla (esperado solo en incomplete_data): $s";
done

# 4. Matriz R4 como referencia histórica reproducible (gate R5-RF-03, parte 2)
python -m pytest backend/tests/test_r4_scenario_matrix.py -q

# 5. Limpieza de artefactos (no genera datos, solo elimina el indicado)
python backend/scripts/generate_synthetic.py --reset --output artifacts/demo.json

# 6. Higiene del árbol
git diff --check
```

Notas: `--check` devuelve código 1 si DQ falla (esperado solo en
`incomplete_data`); `--reset` no toca la base de datos. El seed ORM es un
procedimiento aparte y manual (`python scripts/seed_realistic_data.py`,
`--status` para solo mostrar recuentos) y respeta `DATABASE_URL`: no
ejecutarlo contra producción sin intención. La semilla R4 (`seed=20260910`,
`simulation_time=2026-09-10T12:00:00+00:00`, `profile=small`) reproduce la
matriz histórica; los valores por defecto del CLI (`seed=20260602`,
`simulation_time=2026-06-01T12:00:00+00:00`) reproducen el dataset canónico
actual.

## 6. Verificación de esta tarjeta y riesgos

- Verificación realizada: rutas y líneas citadas existen en el worktree;
  `git diff --check` limpio (ver metadata del commit).
- Preguntas abiertas: (1) si `critical_machinery` y `seasonal_variation`
  merecen tests dedicados de huella en fase posterior; (2) si `aemet_failure`
  y `degraded_connectivity` deben ganar huella diferencial en el generador o
  documentarse permanentemente como etiquetas cuyo comportamiento vive fuera
  de él; (3) semilla canónica a fijar para R5 (`20260602` por defecto del CLI
  frente a `20260910` histórica de R4).
- Riesgo residual: un lector puede interpretar los nueve escenarios como
  igualmente validados; este capítulo lo previene marcando cuatro como
  pendientes/no demostrados, pero la mitigación completa exige los tests o la
  decisión explícita de no añadirlos.
- Acciones remotas: ninguna.
