# Release 1 — baseline sintética

## Alcance entregado

Release 1 consolida una demo reproducible de Tools4Milk para explorar flujos
de gestión productiva y operativa. La demo se ejecuta con PostgreSQL, FastAPI,
Next.js y Docker Compose. El backend expone la API versionada en `/api/v1` y
el frontend consume esa API con autenticación basada en cookies HttpOnly.

La entrega cubre:

- Dashboard, animales, lactaciones, alertas, incidencias, tratamientos,
  maquinaria, pedidos, zonas, tareas y turnos.
- LeanFarming con catálogo de tareas, planificación semanal, carga de trabajo,
  asignaciones y vistas adaptadas a zona/tablet.
- Turnos de mañana y tarde, relevos y pantalla TV de solo lectura.
- Scheduler sintético idempotente para materializar recurrencias y reportar
  creados, omitidos, errores y estado de la última ejecución.
- Contratos OpenAPI y comprobaciones de accesibilidad/responsive para los
  flujos principales.

## Datos y reproducibilidad

Los datos generados por Release 1 son exclusivamente sintéticos. Cada registro
lleva provenance `synthetic/generated` y el manifiesto conserva versión del
generador, escenario, seed, instante de generación e instante simulado.

Perfiles disponibles:

- `small`: 8 animales, útil para comprobaciones rápidas.
- `demo`: 200 animales, 30 días y turnos mañana/tarde.
- `load`: 1.000 animales para comprobar volumen del artefacto, no capacidad
  productiva ni rendimiento de producción.

Escenarios disponibles: `normal`, `delayed_tasks`, `critical_machinery`,
`health_alert`, `seasonal_variation`, `degraded_quality`, `aemet_failure`,
`degraded_connectivity` e `incomplete_data`.

La combinación de versión del generador, seed y escenario reproduce las claves
lógicas del dataset. `generated_at` puede cambiar sin cambiar esas claves.
Las distribuciones son ilustrativas y no están validadas científicamente.

```bash
cd backend
python -m venv .venv
# Linux/macOS: source .venv/bin/activate
# Windows:    .venv\\Scripts\\activate
python -m pip install -r requirements.txt
python scripts/generate_synthetic.py --profile demo --scenario normal --seed 20260602 --check
python scripts/generate_synthetic.py --reset --output artifacts/synthetic-dataset.json
```

## Verificación realizada

Los gates de la integración local incluyen:

- Backend: suite pytest ejecutada en un entorno Python aislado desde
  `backend/requirements.txt`.
- Frontend: `npm ci`, typecheck, lint y build usando
  `frontend/package-lock.json`.
- Contratos: pruebas OpenAPI, contratos frontend y smoke de API.
- Compose: validación de las configuraciones normal y de verificación.
- E2E/accesibilidad: flujos de Dashboard, Kanban y TV en viewports desktop,
  tablet, móvil y TV, con comprobaciones axe.

Los comandos exactos y las limitaciones conocidas se mantienen en
`OPERATIONS.md`. La suite no demuestra SLA, seguridad operativa, validación en
campo ni aptitud para una explotación real.

## Límites explícitos

- No hay proveedores externos obligatorios; AEMET es una integración opt-in y
  el fallback de la demo es sintético.
- No se incluyen Redis, Celery, ML ni evaluación offline.
- Las predicciones son heurísticas experimentales y no recomendaciones
  clínicas, veterinarias o productivas.
- La demo no usa datos reales y no hace claims de producción.
- Las operaciones de datos sintéticos están deshabilitadas en
  `ENVIRONMENT=production`; los ejemplos locales de esta documentación no son
  una certificación de despliegue productivo.

## Recuperación y reset

Para reconstruir el esquema y los datos de la demo desde cero:

```bash
docker compose down -v
docker compose up -d --build
docker compose exec backend python scripts/run_synthetic_scheduler.py --once --profile small --seed 20260602
```

El `-v` elimina únicamente el volumen PostgreSQL definido por este Compose.
Para resetear solo filas sintéticas sin destruir el esquema, usa el endpoint de
reset documentado en `OPERATIONS.md` y vuelve a ejecutar el scheduler con la
misma versión, seed y escenario.
