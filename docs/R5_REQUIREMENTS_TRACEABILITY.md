# TOOLS4MILK — R5: matriz de requisitos y trazabilidad

Estado global R5: `READY_LOCAL_FOR_INDEPENDENT_AUDIT` (ver
`docs/RELEASE5.md` §7–§8). Ensamblaje local `r5-final-assembly-local`:
base `1821920` (`t_0b8bfd17`) + merges `--no-ff` de `6aabd81` (código
certificado), `1817954` (evidencia, `t_619a5398`) y `ebc2298`
(limitaciones/manual, `t_353377d3`). Cada requisito abajo indica su estado
verificado con evidencia real; el gate E2E vigente es `t_ca2dc8bf` (READY
8/8 x2, Axe 0/0, sobre `6aabd81`); `t_712c60bc` queda como antecedente
histórico NOT_READY. Limpieza `tfm_r5_demo` verificada (`t_67896b8b`
CLEAN).

Convención evidencial usada en todo el documento:

- **Histórico**: resultado o documento ya publicado en el historial (p. ej.
  verificación R4-5 del 2026-09-10) que se cita como contexto pero **no** se
  reclama como evidencia R5.
- **Reejecutable**: comando, test o revisión que debe ejecutarse de nuevo en
  fase R5 posterior y cuyo resultado quedará registrado entonces.

## R5-RF-01 — Matriz de trazabilidad requisito → implementación → pruebas

- Descripción verificable: existe este documento con un ID estable por
  requisito, cada uno con descripción, estado inicial, referencias a
  archivos/endpoints/tests actuales, trabajo pendiente, criterio de aceptación
  y gate de verificación previsto.
- Estado inicial: no existía matriz de requisitos; solo la matriz E2E de
  escenarios DSS `docs/RELEASE4-R4-5-matriz-e2e.md` (histórico: traza
  escenario → recorrido UI → huella, no requisito → implementación → prueba).
- Referencias actuales: `docs/RELEASE5.md`, este fichero; insumos
  `docs/RELEASE4-R4-5-matriz-e2e.md`, `docs/SYNTHETIC_DATA.md`.
- Trabajo pendiente: completar filas de `R5-RF-02` a `R5-RNF-02` a medida que
  se creen los documentos/gates posteriores; mantener los IDs estables.
- Criterio de aceptación: los dos documentos R5 existen en español con la
  grafía TOOLS4MILK, la matriz cubre trazabilidad, arquitectura,
  metodología/escenarios, evidencia, limitaciones, manual de demo y los tres
  P2 como corrección pendiente, sin marcar realizado lo inexistente.
- Gate previsto: revisión documental (enlaces Markdown internos válidos,
  rutas referenciadas existentes, `git diff --check` limpio).
- Estado R5: **verificado**. Evidencia de ensamblaje: ambos documentos
  existen en español con grafía TOOLS4MILK; 123 enlaces/rutas revisados
  (resuelven), `git diff --check` limpio, 4 `.mmd` con cabecera válida.

## R5-RF-02 — Diagramas de arquitectura versionados

- Descripción verificable: existen como ficheros versionados en el
  repositorio cuatro vistas (contexto, contenedores, API/seguridad, datos
  sintéticos) coherentes con la prosa existente.
- Estado inicial: pendiente. La arquitectura solo está descrita en prosa
  (`README.md`, `docs/RELEASE3.md` con 5 servicios `tfm_r3_demo`); hay cero
  ficheros de diagramas (`drawio`/`puml`/`mmd`) en el repositorio (histórico:
  encabezado conceptual, no diagramas).
- Referencias actuales: `README.md` (líneas ~128-131),
  `docs/RELEASE3.md`, `docs/LEANFARMING_CONTRACT.md`,
  `docs/RELEASE2_RESILIENCE_CONTRACT.md`.
- Trabajo pendiente: crear los cuatro diagramas como código/ficheros,
  revisarlos contra el código real y referenciarlos desde esta matriz.
- Criterio de aceptación: cada vista existe versionada y cada elemento del
  diagrama traza a un fichero/endpoint/contrato real citado.
- Gate previsto: revisión documental cruzada contra código + `git diff
  --check`.
- Estado R5: **verificado**. Evidencia: `74f6037` integrado en `1821920`
  (`t_0b8bfd17`); 4 vistas en `docs/diagrams/r5-*.mmd` con cabecera
  `graph`/`flowchart`, elementos trazados a ficheros/contratos reales.
  Residual: sin render ejecutable de Mermaid.

## R5-RF-03 — Metodología del generador y catálogo académico unificado

- Descripción verificable: existe un capítulo metodológico versionado que
  describe generador (versión, seed, escenario, UUID5, reglas de calidad,
  perfiles) y un catálogo académico unificado de los escenarios sintéticos.
- Estado inicial: parcialmente implementado (histórico, reutilizable como
  insumo): `docs/SYNTHETIC_DATA.md`,
  `backend/app/synthetic_data.py` (`GENERATOR_VERSION=1.0.0`),
  `backend/scripts/generate_synthetic.py`,
  `backend/scripts/seed_realistic_data.py` (idempotente, RNG fija). Los
  escenarios existen pero sin catálogo académico unificado.
- Referencias actuales: los cuatro ficheros anteriores más
  `backend/tests/test_r4_scenario_matrix.py` y
  `frontend/playwright/release4-scenario-matrix.spec.ts` (histórico).
- Trabajo pendiente: redactar el capítulo R5 y el catálogo unificado sin
  afirmaciones clínicas/productivas; fijar versión y seeds.
- Criterio de aceptación: cualquier lector puede regenerar los datos
  sintéticos con el procedimiento documentado y obtener el mismo catálogo de
  escenarios.
- Gate previsto (reejecutable): `python backend/scripts/generate_synthetic.py
  --help` y `python -m pytest backend/tests/test_r4_scenario_matrix.py -q`
  con resultados registrados como evidencia R5.
- Estado R5: **verificado**. Evidencia: `88b0e18` integrado en `1821920`;
  capítulo `docs/R5_SYNTHETIC_METHODOLOGY_SCENARIOS.md` con catálogo de 9
  escenarios; reejecutado en ensamblaje: `--help` OK (9 escenarios
  listados), `test_r4_scenario_matrix.py` **10 passed**.

## R5-RF-04 — Evidencia versionada reejecutable

- Descripción verificable: existe un registro versionado de evidencias
  reejecutadas en fase R5 (resultados de tests, hash OpenAPI, logs de demo),
  separado de las citas históricas.
- Estado inicial: pendiente. Evidencia histórica disponible como contexto
  pero no reclamable como R5: verificación R4-5 del 2026-09-10
  (`docs/RELEASE4-R4-5-matriz-e2e.md`, líneas ~68-89: backend 182 passed, CLI
  8 passed, typecheck+lint+build ok, `npm audit` 0 high, OpenAPI sha
  `fea4835f…`, demo 5/5 scheduler small 42, Playwright 25/25, axe cero
  serious/critical).
- Referencias actuales: `docs/RELEASE4-R4-5-matriz-e2e.md`,
  `backend/tests/`, `frontend/playwright/`, `scripts/demo.py`.
- Trabajo pendiente: ejecutar y registrar la batería R5 (pytest backend, CLI,
  typecheck+lint+build frontend, `npm audit`, demo, Playwright,
  `git diff --check`).
- Criterio de aceptación: cada evidencia cita comando exacto, salida
  resumida, hash donde aplique y fecha; ninguna evidencia es solo histórica.
- Gate previsto (reejecutable): la propia batería citada en
  `R5-RNF-02`, con salidas archivadas en el documento de evidencias R5.
- Estado R5: **verificado**. Evidencia: `docs/R5_REPRODUCIBLE_EVIDENCE.md`
  (`1817954`, `t_619a5398`); gate vigente `t_ca2dc8bf` READY (run_1 8/8,
  run_2 8/8, Axe 0/0, sobre `6aabd81`); `t_712c60bc` citado solo como
  antecedente NOT_READY.

## R5-RF-05 — Capítulo consolidado de limitaciones y reproducibilidad

- Descripción verificable: existe un capítulo versionado que consolida
  limitaciones conocidas, amenazas a la validez y procedimiento de
  reproducción.
- Estado inicial: pendiente como capítulo; fragmentos dispersos existentes
  (histórico): `docs/RELEASE4.md` (R4-3: composición placeholder),
  `docs/RELEASE1.md` (línea ~80: no es certificación de despliegue),
  `docs/RELEASE4-R4-5-matriz-e2e.md` (línea ~93: sin Redis/Celery/etc.),
  honestidad weather de la consolidación post-R4.
- Referencias actuales: los documentos anteriores; `README.md` (líneas ~3-5,
  30-32, 68: visión con modelos predictivos y leche a la carta) como
  contraste a explicitar: las predicciones son heurística aritmética no-ML.
- Trabajo pendiente: redactar el capítulo; explicitar que README-visión vs
  realidad (heurística, composición placeholder, datos sintéticos) es
  limitación, no supuesto resuelto.
- Criterio de aceptación: toda afirmación de capacidad de TOOLS4MILK enlaza a
  su limitación correspondiente; el procedimiento de reproducción es
  ejecutable paso a paso.
- Gate previsto: revisión documental + reproducción mínima
  (`git diff --check` y, donde aplique, comandos de `R5-RNF-02`).
- Estado R5: **verificado**. Evidencia:
  `docs/R5_LIMITATIONS_VALIDITY_REPRODUCIBILITY.md` (`ebc2298`,
  `t_353377d3`); cubre sintéticos, heurística no causal, cobertura
  READY recertificada, AEMET opt-in, E2E+accesibilidad, amenazas y
  repetición; revisión documental OK en ensamblaje.

## R5-RF-06 — Manual de demostración

- Descripción verificable: existe un manual/guion de demo versionado
  (preparación, recorrido, tiempos, respuestas a preguntas frecuentes con sus
  limitaciones) ejecutable sin secretos ni infraestructura nueva.
- Estado inicial: pendiente. Insumos existentes (histórico):
  `scripts/demo.py` (`init|up|smoke|down`, proyecto `tfm_r3_demo`),
  `OPERATIONS.md`, `CHANGELOG.md`.
- Referencias actuales: `scripts/demo.py`, `OPERATIONS.md`.
- Trabajo pendiente: redactar el manual usando solo comandos y datos
  sintéticos existentes; sin credenciales reales (usar `[REDACTED]` si un
  ejemplo necesitase una).
- Criterio de aceptación: un tercero sigue el manual sobre `main` limpio y
  completa la demo sin improvisar pasos ni usar secretos.
- Gate previsto: recorrido manual del guion + `git diff --check`.
- Estado R5: **verificado**. Evidencia:
  `docs/R5_DEMONSTRATION_MANUAL.md` (`ebc2298`, `t_353377d3`); 9 secciones
  (preparación, arranque `tfm_r5_demo`, credenciales efímeras, RBAC,
  sintéticos, secuencia 20 min, observable vs no afirmar, gate sin
  secretos, teardown); comandos contrastados contra el repo en el handoff;
  sin secretos.

## R5-RF-07 — Corrección P2-1: contrato coherente de alertas por animal

- Descripción verificable: `GET /api/v1/alerts/{animal_id}` distingue
  inexistencia de identificador inválido y de animal existente sin alertas.
- Estado inicial (auditado sobre el código real, pendiente de corrección):
  - `backend/app/routers/alerts.py` (líneas ~145-154, `animal_alerts`): no
    valida el animal; delega en `count_by_animal`/`get_by_animal` y responde
    `200` con lista vacía tanto para animal inexistente como para
    identificador no-UUID.
  - `backend/app/repositories/alerts_repository.py` (líneas ~57-74):
    `get_by_animal`/`count_by_animal` capturan `ValueError`/`AttributeError`
    de `uuid.UUID()` y devuelven `[]`/`0` sin señalar invalidez.
  - Contraste: `POST /api/v1/alerts/generate/{animal_id}`
    (`backend/app/routers/alerts.py`, líneas ~157-162) sí consulta
    `animals_repository.get_by_id` y responde `404` si el animal no existe.
    Nótese que `animals_repository.get_by_id`
    (`backend/app/repositories/animals_repository.py`, líneas ~22-27)
    devuelve `None` tanto para UUID válido inexistente como para
    identificador no-UUID, por lo que `generate` hoy responde `404` en ambos
    casos sin distinción `422`.
  - Tests actuales (histórico): `backend/tests/test_consolidacion_post_r4.py`
    (`test_by_animal_pagination`, líneas ~62-79) usa UUIDs aleatorios sin
    animal creado y afirma `200`; ese comportamiento es precisamente la
    incoherencia a corregir, no su validación.
- Contrato esperado fijado (sin ambigüedad):
  - `404` para UUID válido sintácticamente de animal inexistente.
  - `422` para identificador que no sea UUID válido.
  - `200` con lista vacía solo para animal existente sin alertas.
- Trabajo pendiente: implementar la validación (comprobación de existencia
  vía `animals_repository` + validación de formato UUID) y actualizar los
  tests que hoy fijan el comportamiento incoherente.
- Criterio de aceptación: las tres ramas responden exactamente los códigos
  anteriores, verificadas con UUID inexistente, identificador no-UUID y
  animal existente sin alertas.
- Gate previsto (reejecutable): tests backend nuevos/actualizados
  (`python -m pytest backend/tests -q`) más revisión del diff del contrato.
- Estado R5: **verificado**. Evidencia: `231acab` integrado en `1821920`
  (`t_0b8bfd17`); suite `backend/tests/test_alerts_r5_p2.py` incluida en
  los **205 passed** reejecutados en ensamblaje (contrato 404/422/200).

## R5-RF-08 — Corrección P2-2: estadísticas de alertas calculadas

- Descripción verificable: el objeto `estadisticas` de `AlertsResponse`
  contiene valores calculados desde los datos reales del repositorio con el
  mismo alcance de filtro de la consulta, no constantes.
- Estado inicial (auditado sobre el código real, pendiente de corrección):
  - `backend/app/routers/alerts.py` (líneas ~17-38, `_alerts_response`):
    `total_alertas = total` (real), `pendientes = len(pending)` sobre los
    ítems de la página (cálculo parcial, no sobre el total filtrado),
    `alertas_ultimos_30_dias = total` (placeholder: copia el total sin filtro
    temporal), `tasa_resolucion_pct = 0` (placeholder constante),
    `severidad_promedio = "media"` (placeholder constante).
  - Contrato: `backend/app/schemas/api.py` (líneas ~64-70, `AlertsResponse`):
    `estadisticas: dict[str, Any] | None` sin validación de contenido.
  - Frontend espejo: `frontend/src/lib/types.ts` (líneas ~68-81,
    `AlertsResponse`): declara los cinco campos como tipos planos sin
    semántica de cálculo.
  - Campos del modelo disponibles para el cálculo real (sin inventar
    ninguno): `Alerta.ts_generacion`, `Alerta.ts_resolucion`,
    `Alerta.activa`, `Alerta.nivel` (`backend/app/models/tools4milk.py`,
    líneas ~316-338); niveles posibles `baja|media|alta`
    (`backend/app/enums.py`, líneas ~78-82, `NivelAlerta`).
  - Test actual (histórico): `backend/tests/test_consolidacion_post_r4.py`
    (línea ~35) solo afirma `estadisticas.total_alertas == total`.
- Resultado deseado verificable:
  - `total_alertas`: recuento con el mismo filtro de la consulta (ya real;
    conservar).
  - `alertas_ultimos_30_dias`: recuento con el mismo filtro más
    `ts_generacion >= ahora - 30 días`.
  - `tasa_resolucion_pct`: `100 * resueltas / total` del mismo alcance,
    donde resuelta = `ts_resolucion IS NOT NULL` (0 si total es 0).
  - `pendientes`: recuento con el mismo filtro de `activa AND
    ts_resolucion IS NULL` (no solo ítems de la página).
  - `severidad_promedio`: **decisión técnica pendiente** — el código actual
    devuelve la constante `"media"` y el repositorio no define ninguna
    correspondencia numérica de `NivelAlerta` (`baja|media|alta`, sin valor
    `critica` en el enum pese a que el frontend declara `"critica"` en
    `AlertSeverity`). Fijar media numérica (p. ej. baja=1/media=2/alta=3)
    sería inventar semántica; debe decidirse y registrarse antes de
    implementar. Evidencia exacta: `backend/app/routers/alerts.py:36`,
    `backend/app/enums.py:78-82`, `frontend/src/lib/types.ts:41,79`.
- Trabajo pendiente: resolver la decisión de `severidad_promedio`,
  implementar los cuatro cálculos con alcance de filtro coherente y tipar el
  contrato si se considera necesario.
- Criterio de aceptación: ningún campo de `estadisticas` es constante ante
  datos distintos; cada valor coincide con una consulta independiente sobre
  el repositorio con el mismo alcance.
- Gate previsto (reejecutable): tests backend con datos sembrados que
  afirmen cada campo por separado (`python -m pytest backend/tests -q`).
- Estado R5: **verificado**. Evidencia: `231acab` integrado en `1821920`
  (agregación SQL pre-paginación); campos afirmados por tests dedicados
  dentro de los **205 passed** reejecutados en ensamblaje.

## R5-RF-09 — Corrección P2-3: spec E2E portable en sustitución del legacy

- Descripción verificable: existe una prueba E2E portable y segura que cubre
  de forma equivalente el recorrido del spec legacy, sin URL, ruta ni
  credencial hardcodeada; el legacy no se elimina sin esa sustitución
  equivalente.
- Estado inicial (auditado sobre el código real, pendiente de corrección):
  `e2e/release1-smoke.mjs` contiene valores fijos legacy —
  `BASE_URL` por defecto `http://host.docker.internal:18080` (línea ~3),
  credenciales `admin` / `testpass123` (líneas ~17-18),
  capturas en `/tmp/release1-*.png` y `/tmp/release1-tv.png` (líneas
  ~32, 100), script CDN externo
  `https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.11.0/axe.min.js`
  (línea ~30), rutas `/leanfarming`, `/tv`, `/dashboard` (líneas ~48, 93,
  20). No se ha verificado si el spec sigue ejecutándose en CI actual; se
  documenta como deuda, no como gate vigente.
- Resultado deseado verificable: spec que obtiene baseURL, credenciales y
  rutas de salida de variables de entorno (o config inyectada), sin
  credencial literal en el fichero, sin dependencia de red externa para axe
  y con rutas de captura configurables; cubre viewports, login, workflow
  leanfarming, transiciones de tareas, escenarios del scheduler y
  solo-lectura de `/tv` de forma equivalente al legacy.
- Trabajo pendiente: escribir el spec portable, parametrizar todo valor
  fijo y mantener el legacy hasta que el sustituto demuestre cobertura
  equivalente.
- Criterio de aceptación: el spec portable pasa con valores inyectados
  distintos de los legacy por defecto y ningún secreto ni ruta fija queda en
  el fichero.
- Gate previsto (reejecutable): ejecución del nuevo spec en entorno de
  demostración local más `grep` de ausencia de literales
  (`host.docker.internal`, `testpass123`, `/tmp/`, `cdnjs`) en el nuevo
  fichero. Sin Docker ni acciones remotas en esta fase documental.
- Estado R5: **verificado, gate integrado listo**. Evidencia: spec
  `frontend/playwright/release1-smoke-portable.spec.ts` (`14d7950`,
  serial/pacing/contrato mutación) integrado en `1821920`; gate estático
  **4/4** reejecutado en ensamblaje; gate vigente `t_ca2dc8bf` READY
  (run_1 8/8, run_2 8/8, 0 skips, Axe 0/0 sobre `6aabd81`); legacy
  `e2e/release1-smoke.mjs` conservado intacto (último cambio `d4e97bf`).

## R5-RNF-01 — Restricciones transversales

- Descripción verificable: todo cambio R5 respeta simultáneamente: solo
  Markdown versionado en esta fase (sin Python/TypeScript/scripts/tests/
  Compose/CI salvo correcciones P2 posteriores ya planificadas en su
  requisito propio), español, grafía exacta TOOLS4MILK, carácter académico
  sintético no causal, y cero dependencias/proveedores/migraciones/Redis/
  Celery/TimescaleDB/S3/ML/WebSocket/SSE/cambios de despliegue.
- Estado inicial: vigente desde las decisiones globales; esta matriz y
  `docs/RELEASE5.md` son la primera aplicación.
- Criterio de aceptación: ningún diff R5 introduce lo prohibido; el nombre
  del proyecto aparece siempre como TOOLS4MILK.
- Gate previsto: `git diff --check` + revisión del diff por fichero.
- Estado R5: **verificado**. Evidencia de ensamblaje: diff acotado a
  `docs/` (+3 ficheros de merges, +2 editados); sin dependencias,
  proveedores, migraciones, Redis/Celery/TimescaleDB/S3/ML/WebSocket/SSE ni
  cambios de despliegue; español y grafía TOOLS4MILK en todo R5.

## R5-RNF-02 — Honestidad evidencial (histórico vs reejecutable)

- Descripción verificable: ningún documento R5 presenta como realizado lo
  pendiente ni como evidencia R5 lo histórico; cada afirmación de capacidad
  (heurística no-ML, composición placeholder, datos sintéticos, AEMET
  opcional) enlaza a su limitación.
- Estado inicial: riesgo registrado, no incidencia: la auditoría previa
  detectó contradicciones potenciales (visión README vs realidad, matriz E2E
  confundible con matriz de requisitos, prosa arquitectónica confundible con
  diagramas) que esta matriz corrige por construcción.
- Batería de verificación de referencia (reejecutable en fases
  posteriores, listada aquí sin ejecutarla):
  `python -m pytest backend/tests -q`,
  `python -m pytest tests/test_demo_cli.py -q`,
  `cd frontend && npm run typecheck && npm run lint && npm run build`,
  `cd frontend && npm audit --omit=dev --audit-level=high`,
  `python scripts/demo.py init|up|smoke|down`,
  `cd frontend && npx playwright test`, `git diff --check`.
- Criterio de aceptación: cada documento R5 posterior distingue lo
  histórico de lo reejecutable con comandos, salidas y fechas.
- Gate previsto: revisión documental de cada entrega contra esta regla.
- Estado R5: **verificado**. Evidencia de ensamblaje: la evidencia
  (`1817954`) rotula `t_712c60bc` como antecedente no vigente y `t_ca2dc8bf`
  como vigente; limitaciones/manual declaran historial NOT_READY→fix→
  recertificación; este fichero y `RELEASE5.md` §8 recogen riesgos
  residuales sin maquillaje; batería R5-RNF-02 reejecutada (backend 205,
  demo CLI 9, tsc/lint, static 4/4, OpenAPI determinista, diff-check).

## Dependencias

Esta matriz (`R5-RF-01`) es el prerrequisito de todo lo que sigue en R5 y no
crea tareas Kanban:

- La corrección P2 (`R5-RF-07`, `R5-RF-08`, `R5-RF-09`) depende de los
  contratos y decisiones fijados aquí; no debe implementarse contra otra
  especificación.
- Los documentos posteriores (`R5-RF-02` diagramas, `R5-RF-04` evidencia,
  `R5-RF-05` limitaciones, `R5-RF-06` manual) dependen de los IDs y criterios
  de esta matriz; cualquier cambio de IDs exige actualizarla primero.
- Los gates reejecutables (`R5-RF-04`, `R5-RNF-02`) dependen de que la
  metodología (`R5-RF-03`) y el manual (`R5-RF-06`) existan antes de
  registrar evidencia.
- Orden sugerido, sin crear tareas: `R5-RF-01` (este documento) →
  `R5-RF-07`/`R5-RF-08`/`R5-RF-09` (decisiones y correcciones P2) →
  `R5-RF-02`/`R5-RF-03`/`R5-RF-05`/`R5-RF-06` (documentos) → `R5-RF-04`
  (evidencia reejecutada) bajo `R5-RNF-01`/`R5-RNF-02`.
