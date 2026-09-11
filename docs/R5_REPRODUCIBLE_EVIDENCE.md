# R5 — Evidencia reproducible y saneada (TOOLS4MILK)

> Alcance: documentar el resultado real del gate E2E R5 para reejecución
> independiente. Solo datos sintéticos/ficticios. Nada de lo aquí descrito
> afirma validez clínica, científica, productiva ni que los datos representen
> una explotación real. No hay credenciales, tokens, cookies, URLs sensibles
> ni logs completos en este documento; los valores sensibles se representan
> como `[REDACTED]`.

Documentos relacionados (existen en este árbol):

- [RELEASE5](RELEASE5.md)
- [Matriz de requisitos y trazabilidad](R5_REQUIREMENTS_TRACEABILITY.md)
- [Contrato sintético](SYNTHETIC_DATA.md)
- Script oficial de demo: `scripts/demo.py`
- Spec legacy conservado: `e2e/release1-smoke.mjs`

## 1. Identidad reproducible

| Campo | Valor |
|---|---|
| Commit de integración R5 evaluado | `29306dfaa56863df3532ea72bc43ab2111b47920` |
| Base de integración | `1821920a6c728ff101e4de71027899bdb051c28b` + parámetro `--project-name` (`scripts/demo.py`) |
| Fecha de ejecución del gate fuente | 2026-09-11 (sesión `20260911_103826_629fc3`, cierre `t_712c60bc` 2026-09-11 10:45) |
| Fuente única de resultados | Handoff de `t_712c60bc` (ver tabla §3). Este documento no reejecuta nada |
| Proyecto Compose aislado | `tfm_r5_demo` (el canónico `tfm_r3_demo` queda intacto) |
| Base URL del gate | `http://127.0.0.1:80` vía Nginx (origen loopback; el acceso directo a `http://127.0.0.1:3000` es sonda inválida, ver §3) |
| Disciplina de ejecución | Serie obligatoria: `mode: "serial"` interno + `--workers=1` |
| Gates cubiertos | Preflight de salud, gate estático portable, spec portable completo (8 pruebas), Axe serious/critical, legado intacto |
| Estado final certificado | `NOT_READY` (defecto real de producto, ver §3). No hay doble 8/8 |

Límites de validez:

- Los resultados solo valen para el commit exacto, el proyecto `tfm_r5_demo`
  y el entorno local donde se ejecutó el gate. Cambiar código, dependencias,
  proyecto Compose o datos invalida la reproducción.
- Los conteos y hashes de la integración base (p. ej. backend 205 passed,
  OpenAPI, typecheck/lint de `t_0b8bfd17`) son **históricos**: prueban la base,
  no sustituyen la ejecución R5 actual documentada en §3.
- No usar ningún hash ni conteo de este documento como si fuera una ejecución
  nueva. Reejecutar con §2 para obtener resultados actuales.

## 2. Precondiciones y comandos oficiales reejecutables

### 2.1. Precondiciones

- Checkout exacto del commit evaluado (la rama actual de este worktree es
  anterior a R5; el replay exige este checkout):

```bash
git rev-parse HEAD
# esperado: 29306dfaa56863df3532ea72bc43ab2111b47920
```

- Docker + Compose, Python 3 (para `scripts/demo.py`), Node 24 + Playwright
  con Chromium (para los gates frontend). Sin servicios externos, sin CDN.
- Fichero `.env` local efímero y gitignorado, generado solo con el flujo
  oficial (`init`). Nunca versionarlo, copiarlo ni pegar su contenido.
- Credenciales demo solo en memoria, inyectadas como variables de entorno en
  el proceso del runner. Nunca en ficheros, logs, metadata ni en este documento.

Contrato de variables de entorno del spec portable (fuente: gate estático,
`REQUIRED_ENV_VARS`; nombres, nunca valores):

- `PLAYWRIGHT_BASE_URL` — origen demo (p. ej. valor loopback vía Nginx).
- `DEMO_ADMIN_USER` — usuario demo inyectado → `[REDACTED]`.
- `DEMO_PASSWORD` — contraseña demo inyectada → `[REDACTED]`.
- `E2E_WORKFLOW_PATH` — ruta absoluta de la superficie de turnos/tareas.
- `E2E_TV_PATH` — ruta absoluta de la superficie de solo lectura.

Nota de nomenclatura: el helper `frontend/playwright/demo-credentials.ts`
menciona `TFM_DEMO_PASSWORD` / `INITIAL_DEMO_PASSWORD` como origen en memoria
del runner temporal; el spec portable consume `DEMO_PASSWORD`. Son dos caras
del mismo flujo (origen en memoria → variable consumida), no dos secretos
distintos que copiar.

### 2.2. Demo aislada `tfm_r5_demo` (flujo oficial)

Comandos verificados por lectura en el árbol `29306df` (`git show
29306df:scripts/demo.py` expone `up/status/reset/down` con `--project-name`
validado `[a-z0-9_-]+`; el árbol actual anterior a R5 aún no tiene ese flag,
por eso el replay exige el checkout de §2.1):

```bash
python3 scripts/demo.py init
python3 scripts/demo.py up --project-name tfm_r5_demo
python3 scripts/demo.py status --project-name tfm_r5_demo
```

Preflight observado por el gate (criterio de salud antes de Playwright;
repetir con el flujo oficial, no inventar endpoints):

- `tfm_r5_demo` con 5/5 servicios `Up (healthy)`: `db`, `backend`,
  `frontend`, `nginx`, `scheduler`.
- Salud 200 en backend `/health` y en Nginx `/health`; app `/` 200, `/tv`
  200, `/leanfarming` 307 vía Nginx.

### 2.3. Gate estático portable (sin demo, sin Docker)

```bash
cd frontend
npx playwright test playwright/release1-smoke-portable.static.spec.ts --workers=1
```

Qué demuestra (4 pruebas, verificado en `29306df` por `git show` de ambos
specs): el sustituto no contiene los literales prohibidos
(`host.docker.internal`, `testpass123`, `cdnjs`, `/tmp/`), declara el contrato
de entorno de §2.1, usa `AxeBuilder` local (sin `addScriptTag` = sin red
externa), no registra secretos (`console.log` ausente) y el legado
`e2e/release1-smoke.mjs` sigue versionado.

### 2.4. Spec portable completo (contra la demo, serie estricta)

Solo si el preflight (§2.2) es verde. Variables solo en memoria (`[REDACTED]`
nunca se imprime):

```bash
cd frontend
PLAYWRIGHT_BASE_URL="[REDACTED-origen-demo]" \
DEMO_ADMIN_USER="[REDACTED]" \
DEMO_PASSWORD="[REDACTED]" \
E2E_WORKFLOW_PATH="[REDACTED-ruta-absoluta]" \
E2E_TV_PATH="[REDACTED-ruta-absoluta]" \
npx playwright test playwright/release1-smoke-portable.spec.ts --workers=1
```

Composición de las 8 pruebas (serie, `timeout` 180 s por bloque):

1. –4. Viewports `mobile / tablet / desktop / tv`: login, marcador sintético y Axe.
2. Workflow: filtros de turno, detalle kanban y marcador sintético.
3. Transiciones de tarea: válida aceptada (`X-Operation-Id` + `expected_version`) e inválida rechazada.
4. Scheduler: escenarios sintéticos aceptados.
5. Superficie de lectura: sin mutaciones de red y Axe limpio.

Criterio `READY` (no alcanzado, ver §3): dos corridas consecutivas completas
**8 passed / 0 failed / 0 skipped** con Axe sin `serious` ni `critical`, sin
cambios de código entre ambas. Cualquier otro resultado es `NOT_READY` y la
segunda corrida no procede si la primera no es 8/8.

### 2.5. Limpieza: solo `tfm_r5_demo`

La demo queda activa tras el gate para recogida de evidencia/teardown por la
tarea dedicada. Cuando proceda, desmontar exclusivamente el proyecto aislado
(nunca tocar `tfm_r3_demo` ni otros proyectos):

```bash
python3 scripts/demo.py down --project-name tfm_r5_demo
# Solo si se exige descarte explícito de datos sintéticos del volumen demo:
# python3 scripts/demo.py down --project-name tfm_r5_demo --volumes
python3 scripts/demo.py status --project-name tfm_r5_demo
```

## 3. Tabla de evidencia por gate (resultado exacto del handoff `t_712c60bc`)

Leyenda: `READY` = gate verde; `NOT_READY` = gate rojo o no ejecutado por
corte justificado. La columna «Fuente» indica dónde auditar, no duplica logs.

| Gate | Resultado exacto | Criterio | Fuente / reporte | Clasificación |
|---|---|---|---|---|
| Preflight `tfm_r5_demo` | 5/5 `Up (healthy)` (`db/backend/frontend/nginx/scheduler`); `/health` 200 en backend y Nginx; `/` 200, `/tv` 200, `/leanfarming` 307 vía Nginx | Salud verde antes de Playwright | `status` oficial + `curl` de salud (handoff `t_712c60bc`, campo `preflight`) | `READY` |
| Gate estático portable | `4/4 passed` (`release1-smoke-portable.static.spec.ts`, `workers=1`) | 4/4 sin literales prohibidos ni secretos | Reporte Playwright del gate estático (handoff, campo `static_gate`) | `READY` |
| Corrida 1 portable | `4 passed / 1 failed / 3 did not run` (serie, `workers=1`, base `http://127.0.0.1:80`): viewports 4/4 OK; workflow FALLA por Axe `serious`; transiciones/scheduler/lectura no ejecutados por corte serial | 8/8 para `READY` | Reporte Playwright `frontend/test-results` preservado en la máquina del gate (handoff, campo `run_1`); este documento no copia el log | `NOT_READY` |
| Corrida 2 portable | `not_executed` (el criterio exige primera corrida 8/8 para repetir) | Segunda 8/8 consecutiva | Ausencia justificada de reporte (handoff, campo `run_2`) | `NOT_READY` (no procede) |
| Axe accesibilidad | `serious > 0` en superficie workflow: `color-contrast` 4.48 (fg `#5c7268` `text-app-dim` sobre bg `#e9effd` `bg-state-info/10`) en tarjetas `programada`; `0 critical`; viewports 4/4 Axe limpio | Cero `serious`/`critical` | Violaciones Axe del reporte de la corrida 1 (handoff, campo `axe`) | `NOT_READY` |
| Defecto | Producto, reproducible y determinista: `TaskCard.tsx` líneas 55/66/87 usan `text-app-dim` sobre fondos tintados (`bg-state-info/10` en `programada`), contraste 4.48 < 4.5. El fix AA `00c02b4` cambió el cuerpo a `text-state-info-ink` pero no estos sub-elementos (línea Zona, bloque fecha, etiqueta estado). Requiere fix de producto, no del spec | Clasificar producto/spec/entorno sin atribuir datos reales | Lectura del fichero en `29306df` + handoff (campos `defect_class`, `defect_detail`) | `NOT_READY` (bloqueante) |
| Legado | Intacto (`legacy_intact:true`) | No modificar `e2e/release1-smoke.mjs` | `git diff` vacío del legado (handoff) | `READY` |
| Sonda inválida previa | Login 404 + «Sistema desconectado» contra `http://127.0.0.1:3000` directo (el frontend usa API same-origin, solo resuelve vía Nginx); entorno, no producto; descartada, no cuenta como intento | Solo vale la base vía Nginx | Handoff (campo `invalid_probe`); se registra para evitar reintentos erróneos | Informativa (no gate) |
| Secretos / cambios | `secrets_persisted:false`, `code_changes:none`, `docker_actions:smoke_traffic_only`, `remote_actions:none` | Sin persistencia de secretos ni cambios laterales | Handoff (campos homónimos) | `READY` (higiene) |

Doble 8/8: **no se declara**. El handoff prueba `4/1/3+no-ejecutada`, por lo
que afirmar dos corridas 8/8 sería falso. El estado R5 tras este gate es
`NOT_READY` por defecto real de contraste; la corrección y una nueva
certificación quedan fuera del alcance de este documento.

## 4. Integridad y portabilidad

- Legado conservado: `e2e/release1-smoke.mjs` sin modificar (ver §3). El
  sustituto portable no lo reemplaza salvo criterio `READY` futuro.
- Contrato de entorno: solo las 5 variables de §2.1, lectura fail-fast dentro
  de cada prueba (así `--list` y el análisis estático funcionan sin demo).
  Sin literales de credencial en specs ni docs (verificado por el gate
  estático 4/4).
- Sin red externa ni rutas hardcodeadas: Axe local (sin `addScriptTag`), sin
  `cdnjs`, sin `host.docker.internal`, sin `/tmp/`, sin origen literal en el
  spec (todo origen via `PLAYWRIGHT_BASE_URL`), rutas de superficie via
  `E2E_WORKFLOW_PATH` / `E2E_TV_PATH`, artefactos solo via facilities de
  Playwright (traza/video/captura ante fallo + JSON del informe).
- Aislamiento Compose: proyecto `tfm_r5_demo` parametrizado con
  `--project-name` validado; por defecto el script conserva `tfm_r3_demo`.
  Limpieza exclusivamente con `down --project-name tfm_r5_demo` (§2.5).
- `.env` demo: local, efímero y gitignorado (`init`); el runner temporal solo
  contiene nombres de variable en memoria, ningún valor. Este documento no
  incluye ningún valor.
- Trazabilidad pendiente: la actualización de `RELEASE5.md` y de la matriz
  con este `NOT_READY` corresponde a la tarea de ensamblaje final, no a este
  documento.

## 5. Límites y riesgos residuales

- Resultados dependientes del entorno local y de datos exclusivamente
  sintéticos. No extrapolar a producción, a datos reales ni a validez
  clínica/científica/causal.
- No usar hashes (p. ej. `29306df`, `1821920`) ni conteos históricos (p. ej.
  integración base, `test-results` preservados) como si fueran una ejecución
  actual: son identificadores y reportes puntuales ya cerrados.
- Riesgos residuales heredados del handoff: demo aún activa (teardown
  pendiente en tarea dedicada); pool demo con transiciones válidas
  parcialmente consumido por la corrida (transiciones no ejercitadas por el
  corte serial: scheduler + PUT de transición pendientes de nueva
  certificación tras el fix); reintento-429 con espera 65 s si hay ejecuciones
  adyacentes; Mermaid no validado con render ejecutable; mapeo legacy de
  severidad inválida a media conservado.
- Verificación de este documento (sin Docker ni rerun de tests, según
  alcance): enlaces internos comprobados contra este árbol; comandos de §2
  verificados por lectura en `29306df` (`git show` de `scripts/demo.py` y de
  ambos specs); `git diff --check` limpio antes del commit; escaneo de
  secretos por lectura (sin credenciales/tokens/cookies/URLs sensibles ni
  logs; solo `[REDACTED]` y loopback).
