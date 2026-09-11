# TOOLS4MILK — R6: evidencia local reejecutable y saneada

Estado: `READY_FOR_TEARDOWN` (demo certificada, evidencia versionada, teardown pendiente).
Alcance R6 actual: **solo local, efímero y restringido a loopback**. Azure queda
**diferida** (ver `docs/R6_LOCAL_DEMONSTRATION.md` §9). Datos exclusivamente
sintéticos/ficticios. Sin secretos ni PII en este documento.

La demo `tfm_r6_demo` permanece **ACTIVA** al cierre de esta tarjeta; el
teardown oficial es tarea posterior dependiente (R6-L4) y no se ejecuta aquí.

## 1. Commits exactos y parentesco (verificado por lectura)

| Rol | Hash completo | Descripción |
|---|---|---|
| Base producto (`main` local) | `7dab7a37badd4e95c3788d424894f06028cf7b9f` | merge --no-ff del ensamblaje R5 auditado (`94b7749`) en `main` |
| Contrato R6-L1 | `061bd0f6c053a6b421a14044b42dfc07572c7443` | `docs/R6_LOCAL_DEMONSTRATION.md` (demo solo local/efímera/loopback, proyecto `tfm_r6_demo`, Azure diferida) |
| Integración R6-L2 | `920a323be2689ea3bf7b6201a900178a131a91d1` | merge --no-ff de `061bd0f` sobre `7dab7a3` |

Parentesco verificado por lectura (sin modificar ramas):

- `7dab7a3` es ancestro de `920a323` (primer padre del merge).
- `061bd0f` es ancestro de `920a323` (segundo padre del merge).
- `git log --pretty='%H %P %s' 920a323` muestra ambos padres en el mensaje
  `merge(r6-local): incorporar contrato demo local efimera 061bd0f (t_4fef6cf1)
  sobre base 7dab7a3 (t_11278696)`.

Esta tarjeta no crea ramas nuevas: el worktree propio avanza por fast-forward
de `7dab7a3` a `920a323` y versiona únicamente este documento.

## 2. Proyecto y preflight (handoff R6-L2, solo conteos saneados)

- Proyecto Compose aislado: `tfm_r6_demo` (ningún otro proyecto tocado).
- Preflight: **5/5 `Up (healthy)`** — `db`, `backend`, `frontend`, `nginx`,
  `scheduler` (`docker compose -p tfm_r6_demo ps`).
- Sondas: `/health` **200** en backend directo (`http://127.0.0.1:8000/health`)
  y vía Nginx (`http://127.0.0.1:80/health`).
- Todo el stack escucha solo en loopback (`127.0.0.1`); sin exposición pública.

## 3. Gates locales (handoff R6-L2, solo conteos saneados)

| Gate | Resultado |
|---|---|
| Backend completa | **205 passed** |
| Frontend `tsc` | exit 0 |
| Frontend `eslint` | exit 0 |
| Gate estático portable | **4/4 passed** |
| Smoke oficial (`scripts/demo.py smoke`) | **5/5** |
| `git diff --check` tras gates | limpio; árbol limpio |
| Total pruebas ejecutadas | **221** (205 backend + 8 + 8 portable) |

Credenciales demo: inyectadas en proceso temporal durante la certificación,
**no persistidas** (`secrets_persisted:false`). Toda referencia a valores es
`[REDACTED]`.

## 4. Corridas Playwright portable + Axe (handoff R6-L2)

Condiciones comunes: serie (`workers=1`), base `http://127.0.0.1:80`,
datos sintéticos locales, asserts AxeBuilder inline en 4 viewports + workflow
+ superficie de lectura.

| Corrida | Resultado | Notas |
|---|---|---|
| `run_1` | **8 passed / 0 failed / 0 skipped** (~1.5 min) | Sin skips; Axe **0 serious / 0 critical** |
| `run_2` | **8 passed / 0 failed / 0 skipped** (~1.3 min) | Mismas condiciones tras pausa de 75 s por cuota de login (5/min); Axe **0 serious / 0 critical** |

Contexto operativo (sin datos sensibles): el pool de transiciones consumió
2 PUT válidos durante las corridas (12 candidatas iniciales); la cuota de
login exige pacing entre corridas adyacentes. Resultados válidos solo sobre
datos sintéticos locales.

## 5. Comandos de repetición (solo lectura salvo demo propia)

Secuencia oficial con `--project-name tfm_r6_demo` (canónico:
`scripts/demo.py`, subcomandos `init|up|status|smoke|reset|down`):

```bash
python scripts/demo.py --project-name tfm_r6_demo --dry-run init    # ensayo sin cambios
python scripts/demo.py --project-name tfm_r6_demo init              # genera .env local (no versionado)
python scripts/demo.py --project-name tfm_r6_demo up                # docker compose -p tfm_r6_demo up -d --build
python scripts/demo.py --project-name tfm_r6_demo status            # compose ps + /health
python scripts/demo.py --project-name tfm_r6_demo smoke             # verificación reproducible
python scripts/demo.py --project-name tfm_r6_demo reset             # solo filas sintéticas
python scripts/demo.py --project-name tfm_r6_demo down              # apaga solo tfm_r6_demo (tarea R6-L4, NO ejecutar aquí)
```

`reset` limpia solo filas sintéticas sin tocar esquema ni volumen. Prohibido
`docker system prune`, `down --volumes` global o tocar recursos de otros
proyectos. El `down` corresponde exclusivamente a la tarjeta R6-L4 posterior.

## 6. Enlaces y rutas (verificadas por lectura en `920a323`)

- `docs/R6_LOCAL_DEMONSTRATION.md` — contrato R6-L1 (base de esta evidencia).
- `docker-compose.yml` — 5 servicios, binds solo `127.0.0.1`.
- `nginx/nginx.conf` — proxy same-origin (`/api/`, `/health`, `/docs`,
  `/redoc`, `/openapi.json` → `backend:8000`; `/` → `frontend:3000`).
- `scripts/demo.py` — script canónico (`init|up|status|smoke|reset|down`,
  `--project-name`, `--dry-run`).
- `.env.example` — solo placeholders; la demo nunca arranca con ellos tal cual.
- `backend/app/main.py` — 5 cuentas demo solo dev/demo/test, dominios
  ficticios `…@tools4milk.local`; en `production` las cuentas demo quedan
  deshabilitadas.
- `.gitignore` — excluye `.env`, `.env.local`, `.env.*.local`,
  `.env.production`.

Todas las rutas existen en el árbol y son relativas al repo. Este documento no
contiene enlaces externos.

## 7. Verificación documental de esta tarjeta (sin Docker)

- `git diff --check`: limpio (ver §8).
- Rutas Markdown citadas (§6): existentes, verificadas por lectura.
- Búsqueda de secretos/PII sobre el documento: sin `SECRET_KEY=[REDACTED]`,
  sin passwords, sin tokens, sin emails reales (solo patrón ficticio
  `…@tools4milk.local` descriptivo de RBAC), sin valores `CAMBIAME` copiados.
  Todo valor sensible figura como `[REDACTED]`.
- Sin Docker levantado/desmontado, sin `.env` creado, sin `down`, sin push,
  tag, PR, deploy ni acciones Azure/remotas (`remote_actions:none`,
  `azure_actions:none`).
- Base de redacción: handoff R6-L2 (`READY_FOR_R6_EVIDENCE` sobre `920a323`);
  no se inventa ninguna corrida: los conteos reproducen exactamente el handoff.

## 8. Trazabilidad del commit de evidencia

- Commit de evidencia: sobre `920a323`, único fichero nuevo
  `docs/R6_LOCAL_EVIDENCE.md`, árbol limpio tras commit.
- No integrado en `main`, no push, no tag, no PR.
- Comando de comprobación: `git diff --check` y `git status --short`.

## 9. Riesgos residuales

- Bajo: demo efímera `tfm_r6_demo` queda **activa** pendiente del teardown
  oficial en la tarjeta dependiente R6-L4.
- Pool de transiciones con 2 PUT válidos consumidos (12 candidatas iniciales);
  futuras recertificaciones deben asumir regeneración sintética vía `reset` o
  repoblación del scheduler.
- Cuota de login (5/min) exige pacing entre corridas adyacentes.
- Resultados válidos solo sobre datos sintéticos locales en loopback; sin
  claims clínicos/productivos ni validez fuera de ese entorno.
- Azure sigue diferida: sin suscripción, dominio/TLS, Key Vault, red pública,
  Postgres gestionado, observabilidad pública, rollback público ni
  certificación pública (ver contrato §9).
