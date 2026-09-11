# TOOLS4MILK — R5: limitaciones, amenazas a la validez y reproducibilidad

Estado R5: `IN_PROGRESS`. Este capítulo es documental y académico. No es
certificación de despliegue, ni validación clínica/científica/productiva, ni
evidencia de datos reales. Cubre `R5-RF-05` (ver
`docs/R5_REQUIREMENTS_TRACEABILITY.md` y `docs/RELEASE5.md`).

Resultado del gate E2E que condiciona este capítulo: `NOT_READY` según
`t_712c60bc` (smoke portable contra demo aislada `tfm_r5_demo` en la
integración `29306df`: 4 passed / 1 failed / 3 no ejecutados; gate
estático 4/4 passed). Nada de lo declarado como pendiente se presenta
aquí como verificado.

## 1. Datos: 100 % sintéticos, identidades ficticias

- Todo dato visible en la demo es sintético y ficticio. Origen canónico
  `synthetic/generated` (ver `docs/SYNTHETIC_DATA.md`,
  `backend/app/synthetic_data.py` con `GENERATOR_VERSION=1.0.0`,
  `backend/scripts/generate_synthetic.py`,
  `backend/scripts/seed_realistic_data.py` idempotente con RNG fija).
- Perfiles: `small` (8 animales), `demo` (200 animales, 30 días, turnos
  `manana`/`tarde`), `load` (1000 animales, volumen ilustrativo, no
  capacidad productiva). Cada perfil incluye lecturas de robot con UUID5,
  seed y provenance reproducibles.
- Escenarios sintéticos (`normal`, `delayed_tasks`, `critical_machinery`,
  `health_alert`, `seasonal_variation`, `degraded_quality`,
  `aemet_failure`, `degraded_connectivity`, `incomplete_data`): las
  distribuciones son ilustrativas y no están validadas científicamente.
  `incomplete_data` introduce ausencias intencionadas para probar que el
  control de calidad las detecta; el resto pasa DQ.
- Usuarios demo sembrados solo en entorno `development`/`demo`/`test`
  (ver `backend/app/main.py`, función `seed_demo_user`): `admin`,
  `roberto.castro` (admin), `operario.zona` (operario),
  `laura.fernandez` (alimentacion), `dr.mendez` (veterinario), con
  correos `@tools4milk.local`. Son identidades ficticias. La contraseña
  demo común se genera con `python scripts/demo.py init` en el `.env`
  local (no commiteado) y nunca se transcribe en documentos, logs,
  issues ni CI. En producción `INITIAL_DEMO_PASSWORD` debe quedar vacía
  (el backend rechaza arrancar si tiene valor).
- Sin PII, sin explotaciones reales, sin credenciales en el repositorio
  (`.env.example` contiene solo placeholders `CAMBIAME-…`).

## 2. Heurísticas y predicciones: no clínicas, no causales, no productivas

- Las predicciones son heurística aritmética (`method:
  heuristic_arithmetic`, `validated: false`), no machine learning (ver
  `backend/app/services/predictions_service.py`,
  `backend/app/contracts.py` con `PREDICTION_LIMITATIONS`, y
  `backend/app/openapi.py`).
- La estimación deriva de la lactación activa y penalizaciones por
  tratamientos/alertas; los índices de confianza son constantes
  orientativas y la composición es placeholder (se devuelve 0), no un
  cálculo real.
- Ningún indicador, predicción o asociación autoriza decisiones
  clínicas, veterinarias, productivas o comerciales.
- La lectura meteorológica es descriptiva y sintética:
  `GET /api/v1/weather/current` devuelve `impacto_productivo: null` con
  el aviso «Lectura descriptiva sintetica; no indica impacto
  productivo» (ver `backend/app/routers/weather.py`). La correlación
  meteo-productiva es descriptiva sobre la muestra incluida (Pearson con
  soporte `sufficient`/`insufficient_data`); no implica causalidad ni
  validez predictiva. Las vistas llevan banner experimental.
- Contraste honesto con la visión de `README.md` (modelos predictivos,
  «leche a la carta»): es visión de producto, no capacidad verificada.
  La realidad implementada es heurística + placeholder + sintético.

## 3. Cobertura demostrada vs pendiente (a fecha de este capítulo)

Demostrado históricamente (contexto, no evidencia R5):

- Verificación R4-5 del 2026-09-10 (`docs/RELEASE4-R4-5-matriz-e2e.md`):
  backend 182 passed, CLI 8 passed, typecheck+lint+build ok,
  `npm audit` 0 high, OpenAPI determinista, demo 5/5, Playwright 25/25,
  axe cero `serious`/`critical` en 6 recorridos. Es histórico R4, no se
  reclama como evidencia R5.

Demostrado en fase R5 (reejecutable previo al gate E2E):

- Integración `1821920` (`t_0b8bfd17`): backend 205 passed, OpenAPI
  determinista (doble dump idéntico), typecheck/lint ok, gate estático
  portable 4/4 (`release1-smoke-portable.static.spec.ts`).
- Demo aislada `tfm_r5_demo` levantada desde `29306df` vía flujo oficial
  con 5/5 servicios healthy y `/health` 200 en backend y Nginx
  (`t_4f08f2a5`).

Gate E2E R5 — resultado real `NOT_READY` (`t_712c60bc`):

- Corrida 1 (serial, `workers=1`, base `http://127.0.0.1:80` vía Nginx):
  4 passed / 1 failed / 3 no ejecutados. Viewports
  móvil/tablet/escritorio/TV: axe limpio (4/4). Recorrido workflow:
  FALLO por Axe `serious` real de producto.
- Defecto de producto, reproducible y determinista: contraste 4.48
  (fg `#5c7268` `text-app-dim` sobre bg `#e9effd`
  `bg-state-info/10`) en tarjetas `programada` del kanban, en
  `frontend/src/components/leanfarming/TaskCard.tsx` líneas 55 (línea
  Zona), 66 (bloque fecha) y 87 (etiqueta estado). El fix AA `00c02b4`
  cambió el cuerpo a `text-state-info-ink` pero no estos tres
  sub-elementos. Requiere fix de producto, no del spec. 0 `critical`.
- Corrida 2 no ejecutada: el criterio exige primera corrida 8/8 para
  repetir; no se cumple. Transiciones de tareas, scheduler y lectura
  `/tv` no ejercitados por corte serial tras el fallo.
- Sonda inválida descartada (no cuenta como intento): corrida directa
  contra `http://127.0.0.1:3000` con login 404 + «Sistema
  desconectado». El frontend usa API same-origin y solo resuelve vía
  Nginx (`:80`). Es entorno, no producto.

Pendiente (no afirmado):

- Segunda corrida 8/8 sin skips ni Axe `serious`/`critical`, tras fix
  del contraste TaskCard.
- Transiciones de tareas, scheduler y solo-lectura `/tv` bajo gate
  portable (no ejecutados en la corrida 1).
- Cualquier declaración `READY` de R5.

## 4. AEMET opcional; fallos de red/entorno no son regresiones

- AEMET es integración externa opt-in (`backend/app/services/aemet_client.py`,
  estación `villalba_lugo`, «Villalba, Lugo»). Sin `AEMET_API_KEY` o ante
  fallo de red, el cliente usa fallback sintético explícito (`modo:
  generated`, escenario `aemet_failure`). La app funciona sin
  dependencias externas.
- Un fallo de red, puerto ocupado, Docker no disponible o API key
  ausente es condición de entorno, no regresión de producto, y debe
  registrarse como tal (ver procedimiento de repetición, §7).
- La sonda directa a `:3000` (fuera de Nginx) no es ruta soportada para
  el gate: el resultado 404/desconectado es esperado por arquitectura
  (`nginx/nginx.conf`: `/api/`, `/health`, `/docs`, `/redoc`,
  `/openapi.json` → backend; `/` → frontend).

## 5. Limitaciones del E2E portable y de accesibilidad (evidencia real)

- Spec portable `frontend/playwright/release1-smoke-portable.spec.ts`
  (+ gate estático `release1-smoke-portable.static.spec.ts` 4/4,
  verificado en la integración `1821920`): parametrizado por entorno
  (`PLAYWRIGHT_BASE_URL`, `TFM_DEMO_PASSWORD`), sin credenciales
  literales (ver `frontend/playwright/demo-credentials.ts`, presente en
  este árbol), sin CDN externo para axe, rutas de captura
  configurables. Nota de trazabilidad: el spec portable se creó en la
  serie R5 (commit `14d7950`, integrado en `1821920`/`29306df`) y llega
  al árbol final vía merge en `t_eee38bc3`; no existe aún en este HEAD
  `68132c2`, por lo que su ruta se cita como referencia de la serie R5
  verificada en `t_712c60bc`, no como fichero de este árbol. El legacy
  `e2e/release1-smoke.mjs` queda intacto hasta sustitución equivalente
  demostrada.
- Cobertura del portable (cuando pasa): viewports, login, workflow
  leanfarming, transiciones de tareas, escenarios del scheduler y
  solo-lectura `/tv`. En la corrida R5 solo viewports (4/4) quedaron
  verificados; el resto está pendiente por el corte serial (§3).
- Accesibilidad: base reutilizable en `frontend/ACCESSIBILITY.md`
  (foco visible, objetivos ≥44 px, nombres accesibles, `SyntheticMarker`,
  `/tv` solo lectura). No constituye certificación WCAG completa: la
  validación final exige revisión manual con lector de pantalla,
  contraste sobre todas las combinaciones dinámicas y navegadores
  objetivo. Evidencia R5: 1 violación `serious` real pendiente (TaskCard
  programada, §3); 0 `critical`. R4-5 histórico era cero/cero, pero no
  se hereda como estado actual.

## 6. Amenazas a la validez

- Construcción: el gate portable mide recorrido demo sintético, no uso
  productivo. El pool demo de transiciones válidas se consume
  parcialmente por corrida (scheduler + PUT); sin reset sintético entre
  corridas, reintentos adyacentes pueden encontrar datos distintos. El
  reintento-429 introduce esperas (~65 s) si hay ejecuciones adyacentes.
  Mitigación: `reset` sintético (solo filas `synthetic/generated`) antes
  de cada corrida certificante y serie aislada `tfm_r5_demo`.
- Interna: el corte serial tras el fallo deja 3 specs sin ejecutar; no
  puede inferirse su resultado. La historia de merges (`1821920`,
  `29306df`) es trazable sin squash/cherry-pick; cualquier desviación
  del flujo oficial invalida la comparación.
- Externa: resultados solo válidos para el stack Compose local
  (Postgres 15 + backend + scheduler + frontend + nginx) en puertos
  80/3000/5432/8000. Sin Redis/Celery/TimescaleDB/S3/ML/WebSocket/SSE
  (excluidos por `docs/RELEASE5.md`, R6 fuera de alcance). No
  generalizar a despliegue, TLS, dominio, backups, observabilidad
  productiva ni rollback: R6 sigue excluido.
- Conclusión: con 1 fallo Axe `serious`, la conclusión es `NOT_READY`.
  Declarar `READY` o certificar accesibilidad con este defecto sería
  conclusión no sustentada. La segunda corrida solo procede tras fix de
  producto + primera corrida 8/8.

## 7. Procedimiento de repetición con controles de entorno

Precondiciones (registrarlas junto al resultado):

- Rama/commit exacto (p. ej. `29306df`), `git status` limpio salvo lo
  declarado, Python 3.12+, Docker Desktop corriendo, puertos
  80/3000/5432/8000 libres, fecha/hora de la corrida.

Pasos (flujo oficial; en este árbol el proyecto canónico del script es
`tfm_r3_demo` — ver `scripts/demo.py`, `COMPOSE_PROJECT`, `.env.example`
`COMPOSE_PROJECT_NAME` —; la serie R5 aislada usa `tfm_r5_demo` según
`t_8d8f9f9e`/`t_4f08f2a5`):

```bash
python scripts/demo.py init        # genera .env local, idempotente; nunca imprime secretos
python scripts/demo.py up          # levanta stack aislado (5 servicios healthy)
python scripts/demo.py status      # backend /health {"status":"ok"}, Nginx /health 200
# Gate portable (credenciales SOLO en memoria, ver manual R5 §7):
# TFM_DEMO_PASSWORD=<valor del .env local> \
#   PLAYWRIGHT_BASE_URL=http://127.0.0.1:80 \
#   npx playwright test release1-smoke-portable --workers=1
python scripts/demo.py down        # apaga SOLO el proyecto demo usado
```

Controles: base siempre vía Nginx (`http://127.0.0.1:80`), nunca
directo a `:3000`; `workers=1` serial; `reset` sintético antes de
corrida certificante; registrar `4 passed / 1 failed / 3 no ejecutados`
(o el resultado obtenido) con traza Axe completa; ante fallo de
red/puertos/Docker, clasificar como entorno y repetir tras sanear, sin
contarlo como intento de producto.

## 8. Riesgo residual

- Defecto de contraste TaskCard programada pendiente de fix (Axe
  `serious`, 4.48 < 4.5). Demo `tfm_r5_demo` queda activa para recogida
  de evidencia/teardown por la tarea siguiente. Credenciales solo en
  memoria vía runner temporal fuera del repo. Resultados Playwright
  preservados en `frontend/test-results`. R6 excluido: nada de lo aquí
  descrito es apto para producción.
