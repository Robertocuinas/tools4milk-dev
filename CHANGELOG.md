# Changelog

## Release 1 — baseline sintética

### Añadido

- Demo reproducible con API `/api/v1`, contratos OpenAPI y frontend responsive.
- Generador de datos sintéticos con perfiles, escenarios, provenance,
  controles de calidad y recuperación determinista por versión + seed +
  escenario.
- LeanFarming para tareas, incidencias, pedidos, turnos mañana/tarde,
  asignaciones, zonas y vistas de tablet.
- Scheduler sintético idempotente con ejecución manual y periódica.
- Pantalla TV de solo lectura.
- Gates de backend, frontend, contratos, Compose, E2E y accesibilidad.

### Límites

- Esta Release 1 es una demo académica reproducible; no es una afirmación de
  preparación para producción.
- Los datasets son exclusivamente sintéticos. No se incluyen datos reales ni
  validación científica de las distribuciones o predicciones.
- No se introducen Redis, Celery, ML ni proveedores externos obligatorios.

### Seguridad y dependencias

- El gate `npm audit --omit=dev --audit-level=high` no presenta vulnerabilidades
  high/critical en dependencias de producción en la integración.
- Se fija `baseline-browser-mapping` en `2.11.21` mediante `overrides`,
  eliminando el advisory moderado transitivo `GHSA-w5vr-8v7q-w6rv` sin una
  migración mayor.
- No se ejecuta `npm audit fix --force`.
