# R4-4 — Panel operativo seguro (scheduler, reset y weather sync)

## Ubicación elegida: `/integration`

El panel vive en la página existente `/integration`, ya restringida a la capability
`view_integration` (solo `admin`). No se crea navegación duplicada ni capabilities nuevas:
los roles no autorizados ven `AccessDenied` (oculto, sin acciones ejecutables).
Alternativa descartada: `/settings` mezcla preferencias locales de TV/tablet con
operación de backend; `/integration` ya agrupa estado del backend + AEMET y es el lugar
natural para operar el scheduler sintético y el sync meteorológico.

Componente: `frontend/src/components/operational/operational-panel.tsx`.
Cliente tipado: `api.syntheticSchedulerStatus / pauseSyntheticScheduler /
resumeSyntheticScheduler / resetSynthetic / weatherSync` en `frontend/src/lib/api.ts`
(tipos en `frontend/src/lib/types.ts`).

## Operaciones (solo endpoints existentes, solo `admin`)

| UI | Método | Endpoint | Efecto |
|----|--------|----------|--------|
| Estado + Pausar/Reanudar | GET / POST | `/api/v1/admin/synthetic/scheduler`, `…/pause`, `…/resume` | Pausa la materialización demo; no edita cron |
| Reiniciar datos sintéticos | POST | `/api/v1/admin/synthetic/reset` | Borra solo filas `synthetic/generated` (tareas, recurrencias, provenance, dedupe ligado) |
| Sincronizar meteorología | POST | `/api/v1/weather/sync` | AEMET si hay clave; si no, 7 días sintéticos (`modo: generated`) |

RBAC verificado a nivel HTTP (`backend/tests/test_operational_panel.py`):
sin sesión → 401; rol no admin → 403; admin → 200. Sin cambios de permisos.

## Confirmaciones y seguridad

- Reset destructivo: doble confirmación explícita (armar → `role="alertdialog"` →
  ejecutar/cancelar), texto que indica que solo afecta al dataset sintético, botón
  deshabilitado durante la mutación (sin doble envío) y resultado con conteos en
  región `aria-live`.
- Anti-doble-envío en dos capas: estado pendiente explícito local (`pendingAction`,
  síncrono al clic, deshabilita botones y cambia etiquetas a "Pausando…" etc.) más
  guardia `singleFlight` por acción que absorbe clics concurrentes; verificado en E2E
  (doble clic → 1 petición).
- Weather sync opcional: si AEMET no está configurado muestra estado degradado
  (`AEMET no configurado · datos sintéticos`); si el proveedor falla, mensaje de error
  honesto. El backend redacta la clave (`redact_configured_secret`); la UI nunca
  renderiza claves ni configuración sensible.
- Nunca se resetea infraestructura ni volúmenes desde HTTP/UI (el endpoint solo borra
  filas sintéticas; ver `reset_synthetic`).
- JWT sigue en cookie HttpOnly (`credentials: "include"`); sin tokens en estado ni
  `localStorage`. TV permanece solo lectura (sin cambios).
- Auditoría: resultados en línea tras cada operación + enlace a `/audit-log` para
  tablas de dominio auditadas.

## Relación CLI / UI

La CLI segura de R3 (`tools4milk-cli`) sigue disponible para operación por terminal y
el proyecto Compose aislado no cambia. El panel no sustituye la CLI: es la misma
operación manual de demo/staging expuesta con mínimo privilegio para el admin que
prefiere UI. En `production` los endpoints sintéticos responden 403 (`_guard_demo`).

## Accesibilidad / responsive

Sección con `aria-labelledby`, resultados en `aria-live="polite"`, diálogo de
confirmación con `role="alertdialog"`, botones con nombre accesible y layout que
apila en móvil (`flex-col` → `sm:flex-row`, grid `md:grid-cols-2`).

## Tests

- Backend: `backend/tests/test_operational_panel.py` (6 tests: 200 admin, 403 no-admin,
  401 anónimo, conteos de reset, modo generado sin secretos).
- E2E: `frontend/playwright/release4-operational-panel.spec.ts` (4 tests: flujo admin
  completo, error de proveedor, operario sin panel, doble clic = 1 petición).
