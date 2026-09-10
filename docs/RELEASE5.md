# TOOLS4MILK — Release 5 (R5): documentación versionada y reproducible

Estado: `IN_PROGRESS` (no READY, sin certificación).

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

- `docs/RELEASE5.md` (este fichero): propósito, límites, alcance y exclusiones.
- `docs/R5_REQUIREMENTS_TRACEABILITY.md`: matriz de requisitos con IDs
  estables y gates de verificación.
- Pendientes de crear en fases posteriores: diagramas, evidencia reejecutada,
  capítulo de limitaciones, manual de demo.

## 7. Verificación prevista

Cada requisito de la matriz define su propio gate (tests, comandos o revisión
documental). A nivel de esta fase: enlaces Markdown internos válidos,
referencias a rutas existentes y `git diff --check` limpio. No se afirma
certificación ni estado READY.
