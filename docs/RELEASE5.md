# TOOLS4MILK — Release 5 (R5): documentación versionada y reproducible

Estado: `READY_LOCAL_FOR_INDEPENDENT_AUDIT` (ensamblaje local verificado,
pendiente de auditoría independiente en `t_e5c6c288`). No es despliegue
productivo ni validación clínica/científica.

Ensamblaje: rama local `r5-final-assembly-local` sobre el
`integration_commit` `1821920` (`t_0b8bfd17`), con merges completos
trazables `--no-ff` de `6aabd81` (código certificado: `29306df` demo
`--project-name` + fix AA TaskCard), `1817954` (evidencia, `t_619a5398`) y
`ebc2298` (limitaciones/manual, `t_353377d3`). Sin cherry-pick, reset,
squash ni push/tag/PR/deploy. Commit de ensamblaje: ver historial de la
rama (merge de actualización de este fichero y la matriz).

## 1. Propósito

R5 fija la base documental versionada de TOOLS4MILK dentro del repositorio, en
Markdown: requisitos con IDs estables, trazabilidad
requisito → implementación → pruebas, diagramas versionados, metodología del
generador sintético con catálogo unificado de escenarios, evidencia versionada
reejecutable, capítulo consolidado de limitaciones/reproducibilidad y manual de
demostración.

R5 no es un "paquete TFM" externo: no requiere PDF ni exportación CSV/JSON ni
otros formatos fuera del repositorio.

## 2. Límites y naturaleza académica

- R5 es exclusivamente académica, sintética, reproducible y no causal.
- No se hacen afirmaciones clínicas, científicas, productivas ni de datos
  reales: las predicciones son heurística aritmética (no ML), parte de la
  composición es placeholder y los datos son 100 % sintéticos salvo la
  integración opcional y explícita de AEMET.
- La deuda P2 heredada se **intenta corregir** como parte del alcance de R5
  (requisitos `R5-RF-07`, `R5-RF-08`, `R5-RF-09`); no se presenta solo como
  limitación.
- Sin nuevas dependencias, proveedores, migraciones, Redis, Celery,
  TimescaleDB, S3, ML, WebSocket/SSE ni cambios de despliegue.

## 3. Punto de partida auditado

Base: `main` publicada en `3741c18` (merge de la consolidación post-R4
certificada `1e6b5eb` sobre la Release 4 `8a90835`).

Ya publicado y reutilizable como insumo (histórico, no reejecutado en R5):

- Metodología sintética: `docs/SYNTHETIC_DATA.md`,
  `backend/app/synthetic_data.py`, `backend/scripts/generate_synthetic.py`,
  `backend/scripts/seed_realistic_data.py`.
- Escenarios sintéticos existentes (requieren catálogo académico unificado).
- Matriz E2E de escenarios DSS `docs/RELEASE4-R4-5-matriz-e2e.md`
  (traza escenario → recorrido UI → huella; no es matriz de requisitos).

Pendiente al inicio de R5 (alcance a construir y verificar después):

- Matriz requisito → implementación → pruebas.
- Diagramas de arquitectura versionados como ficheros.
- Evidencia versionada reejecutable.
- Capítulo consolidado de limitaciones/reproducibilidad.
- Manual de demostración.
- Corrección verificada de la deuda P2 (P2-1, P2-2, P2-3).

## 4. Alcance R5

| ID | Requisito | Tipo |
|----|-----------|------|
| `R5-RF-01` | Matriz de trazabilidad requisito → implementación → pruebas | Trazabilidad |
| `R5-RF-02` | Diagramas de arquitectura versionados (contexto, contenedores, API/seguridad, datos sintéticos) | Arquitectura |
| `R5-RF-03` | Metodología del generador + catálogo académico unificado de escenarios | Metodología |
| `R5-RF-04` | Evidencia versionada reejecutable | Evidencia |
| `R5-RF-05` | Capítulo consolidado de limitaciones/reproducibilidad | Limitaciones |
| `R5-RF-06` | Manual de demostración | Demo |
| `R5-RF-07` | Corrección P2-1: contrato coherente de alertas por animal (404/422/200) | Corrección P2 |
| `R5-RF-08` | Corrección P2-2: estadísticas de alertas calculadas desde datos reales | Corrección P2 |
| `R5-RF-09` | Corrección P2-3: spec E2E portable y seguro en sustitución del legacy | Corrección P2 |
| `R5-RNF-01` | Restricciones transversales (stack congelado, Markdown, español, grafía TOOLS4MILK) | No funcional |
| `R5-RNF-02` | Honestidad evidencial: distinción histórico vs reejecutable, sin afirmaciones no verificadas | No funcional |

Definición completa, estados iniciales y criterios de aceptación en
`docs/R5_REQUIREMENTS_TRACEABILITY.md`.

## 5. Exclusiones: R6 fuera de alcance

R6 permanece fuera de alcance hasta una decisión explícita de destino. En
particular, quedan excluidos de R5: destino de despliegue productivo, TLS,
dominio, y cualquier infraestructura asociada (Redis, Celery, TimescaleDB, S3,
WebSocket/SSE). La advertencia histórica de `docs/RELEASE1.md` (R5/R6 no son
certificación de despliegue productivo) sigue vigente.

## 6. Documentos R5

- `docs/RELEASE5.md` (este fichero): propósito, límites, alcance, estado de
  ensamblaje y exclusiones.
- `docs/R5_REQUIREMENTS_TRACEABILITY.md`: matriz de requisitos con IDs
  estables, estados verificados y gates de verificación.
- `docs/R5_ARCHITECTURE.md` + `docs/diagrams/r5-*.mmd` (4 vistas Mermaid:
  contexto, contenedores, API/seguridad, datos sintéticos).
- `docs/R5_SYNTHETIC_METHODOLOGY_SCENARIOS.md`: metodología del generador +
  catálogo unificado de nueve escenarios.
- `docs/R5_REPRODUCIBLE_EVIDENCE.md`: evidencia reejecutable (gate vigente
  `t_ca2dc8bf` READY 8/8 x2 + Axe 0/0 sobre `6aabd81`; antecedente histórico
  `t_712c60bc` NOT_READY 4/1/3).
- `docs/R5_LIMITATIONS_VALIDITY_REPRODUCIBILITY.md`: limitaciones, amenazas
  a la validez y reproducibilidad.
- `docs/R5_DEMONSTRATION_MANUAL.md`: manual de demostración (serie
  `tfm_r5_demo`).

## 7. Verificación ejecutada (árbol ensamblado, sin Docker ni repetición E2E)

Gates no-Docker reejecutados sobre este árbol (código idéntico a `6aabd81`;
solo difieren 3 ficheros `docs/` nuevos):

- Backend: `python -m pytest backend/tests -q` → **205 passed**.
- CLI demo: `python -m pytest tests/test_demo_cli.py -q` → **9 passed**.
- OpenAPI: doble dump `/openapi.json` idéntico (len 72740 x2) +
  `/docs`, `/redoc`, `/openapi.json` 200.
- Frontend: `tsc --noEmit` exit 0; `eslint .` limpio.
- Gate estático portable: `npx playwright test
  release1-smoke-portable.static.spec.ts --workers=1` → **4/4**.
- Metodología RF-03: `generate_synthetic.py --help` OK (9 escenarios) +
  `test_r4_scenario_matrix.py` → **10 passed**.
- `git diff --check` limpio; scan de secretos/PII limpio (sin valores
  reales; solo `[REDACTED]`/placeholders); legacy `e2e/release1-smoke.mjs`
  intacto (sin diff vs `68132c2`, último cambio `d4e97bf`); enlaces
  Markdown internos válidos (123 revisados; 6 falsos positivos de formato
  `fichero:línea` y relativo mismo-directorio, todos resuelven); 4 `.mmd`
  con cabecera `graph`/`flowchart`.

Evidencia E2E vigente (no reejecutada aquí por alcance; ver
`docs/R5_REPRODUCIBLE_EVIDENCE.md`): `t_ca2dc8bf` READY contra
`tfm_r5_demo` en `6aabd81` — run_1 8/8 (1.3 min), run_2 8/8 (2.9 min), 0
skips, Axe 0 serious / 0 critical, preflight 5/5 healthy, gate estático
4/4. Historial honesto: `t_712c60bc` NOT_READY (4/1/3, contraste 4.48
TaskCard) → fix `t_a9341392` (`6aabd81`) → rebuild `t_e6b7a3ed` →
recertificación.

Limpieza demo: `t_67896b8b` CLEAN — `tfm_r5_demo` desmontado vía flujo
oficial (`down --project-name tfm_r5_demo`), verificado vacío total (0
contenedores, sin red, `/health` sin respuesta); volumen
`tfm_r5_demo_postgres_data` persiste por diseño (datos sintéticos).

## 8. Riesgos residuales y notas de honestidad

- Documentos de handoff (`R5_ARCHITECTURE.md`, limitaciones, manual)
  conservan cabeceras de trabajo con `IN_PROGRESS`; el estado vigente es el
  de este fichero + la matriz. No se editaron por límite de alcance del
  ensamblaje (solo este fichero y la matriz).
- Vista de contenedores cita el proyecto `tfm_r3_demo` (nombre por defecto
  vigente); la serie R5 usa `--project-name tfm_r5_demo` (ver manual).
- Mermaid validado por estructura (cabeceras, referencias), sin render
  ejecutable.
- Pool de tareas demo parcialmente consumido por las 2 corridas (1 PUT
  válido/corrida); reintento-429 puede introducir esperas de ~65 s en
  ejecuciones adyacentes.
- Filtros de severidad inválida conservan mapeo legacy a `media`.
- Longitud del dump OpenAPI medida aquí (72740) difiere de la citada en la
  integración (78395) por formato de serialización; el código es idéntico a
  `6aabd81` y ambos dumps son byte-idénticos entre sí.
- R6 excluida. Sin dependencias, migraciones ni acciones remotas nuevas.
