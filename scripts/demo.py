#!/usr/bin/env python3
"""CLI portable de la demo Tools4Milk (Release 3).

Único punto de entrada multiplataforma (Windows / Linux / macOS) para la
demo reproducible. Solo usa la biblioteca estándar: no necesita Bash, Make,
PowerShell ni OpenSSL.

Uso:
    python scripts/demo.py init [--force]
    python scripts/demo.py up [--build] [--timeout N]
    python scripts/demo.py status
    python scripts/demo.py smoke [--timeout N]
    python scripts/demo.py reset [--yes]
    python scripts/demo.py down [--volumes] [--yes]

Proyecto Compose canónico y aislado: ``tfm_r3_demo``. Ningún comando toca
recursos de otros proyectos.

Secretos: `init` genera `.env` local con valores aleatorios (módulo
``secrets``) y es idempotente: no sobrescribe un `.env` existente sin
``--force``. Ningún comando imprime secretos en stdout/logs.
"""

from __future__ import annotations

import argparse
import http.cookiejar
import json
import os
import secrets
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

COMPOSE_PROJECT = "tfm_r3_demo"
COMPOSE_FILE = "docker-compose.yml"
ENV_EXAMPLE = ".env.example"
ENV_FILE = ".env"

BACKEND_URL = "http://127.0.0.1:8000"
NGINX_URL = "http://127.0.0.1:80"
FRONTEND_URL = "http://127.0.0.1:3000"

# Puertos que la demo necesita libres en el host.
REQUIRED_PORTS = (80, 3000, 5432, 8000)

# Valores que `init` debe regenerar siempre (placeholders del ejemplo).
REGENERATE_KEYS = {
    "POSTGRES_PASSWORD",
    "SECRET_KEY",
    "INITIAL_DEMO_PASSWORD",
    "DATABASE_URL",
}

MIN_PYTHON = (3, 12)


def repo_root() -> Path:
    """Raíz del repo. Testeable: respeta TFM_DEMO_ROOT si está definida."""
    override = os.environ.get("TFM_DEMO_ROOT")
    if override:
        return Path(override)
    return Path(__file__).resolve().parent.parent


def run(
    cmd: list[str],
    cwd: Path,
    dry_run: bool = False,
    capture: bool = False,
    timeout: int = 120,
) -> subprocess.CompletedProcess[str]:
    if dry_run:
        print("[dry-run] " + " ".join(cmd))
        return subprocess.CompletedProcess(cmd, 0, stdout="", stderr="")
    return subprocess.run(
        cmd, cwd=cwd, capture_output=capture, text=True, timeout=timeout
    )


def check_python() -> list[str]:
    problems: list[str] = []
    if sys.version_info < MIN_PYTHON:
        problems.append(
            f"Python {sys.version_info.major}.{sys.version_info.minor} detectado; "
            f"la demo requiere Python {MIN_PYTHON[0]}.{MIN_PYTHON[1]}+ "
            "(descárgalo en python.org y reintenta)."
        )
    return problems


def check_docker(cwd: Path, dry_run: bool = False) -> list[str]:
    problems: list[str] = []
    if shutil.which("docker") is None:
        return ["Docker no encontrado en el PATH. Instala Docker Desktop y reintenta."]
    if dry_run:
        return problems
    try:
        proc = subprocess.run(
            ["docker", "info"], capture_output=True, text=True, timeout=30
        )
    except (OSError, subprocess.SubprocessError):
        return ["Docker está instalado pero no responde. ¿Está arrancado Docker Desktop?"]
    if proc.returncode != 0:
        problems.append(
            "El daemon de Docker no responde (`docker info` falló). "
            "Arranca Docker Desktop y reintenta."
        )
        return problems
    proc = subprocess.run(
        ["docker", "compose", "version"], capture_output=True, text=True, timeout=30
    )
    if proc.returncode != 0:
        problems.append(
            "`docker compose` v2 no disponible. Actualiza Docker Desktop "
            "(la demo usa `docker compose`, no `docker-compose` v1)."
        )
    return problems


def check_ports() -> list[str]:
    busy: list[str] = []
    for port in REQUIRED_PORTS:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.settimeout(0.5)
            if sock.connect_ex(("127.0.0.1", port)) == 0:
                busy.append(str(port))
    if busy:
        return [
            "Puertos ocupados en el host: "
            + ", ".join(busy)
            + ". Libéralos o para el stack anterior (`down`) y reintenta."
        ]
    return busy


def check_config(root: Path) -> list[str]:
    if not (root / ENV_FILE).exists():
        return [
            f"No existe `{ENV_FILE}`. Ejecuta primero: python scripts/demo.py init"
        ]
    return []


def parse_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        values[key.strip()] = value.strip()
    return values


def render_env_template(template: str) -> tuple[str, dict[str, str]]:
    """Rellena la plantilla con secretos aleatorios. Devuelve (texto, meta).

    `meta` solo contiene NOMBRES de claves regeneradas, nunca valores.
    """
    generated = {
        "POSTGRES_PASSWORD": secrets.token_urlsafe(24),
        "SECRET_KEY": secrets.token_urlsafe(48),
        "INITIAL_DEMO_PASSWORD": "demo-" + secrets.token_urlsafe(16),
    }
    out_lines: list[str] = []
    for line in template.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in line:
            out_lines.append(line)
            continue
        key = stripped.split("=", 1)[0].strip()
        if key == "DATABASE_URL":
            out_lines.append(
                "DATABASE_URL=postgresql+psycopg://postgres:"
                + generated["POSTGRES_PASSWORD"]
                + "@db:5432/tools4milk"
            )
        elif key in generated:
            out_lines.append(f"{key}={generated[key]}")
        else:
            out_lines.append(line)
    text = "\n".join(out_lines) + "\n"
    return text, {"regenerated": sorted(generated)}


def cmd_init(root: Path, force: bool, dry_run: bool) -> int:
    example = root / ENV_EXAMPLE
    target = root / ENV_FILE
    if not example.exists():
        print(f"ERROR: falta la plantilla `{ENV_EXAMPLE}`.", file=sys.stderr)
        return 2
    if target.exists() and not force:
        print(
            f"`{ENV_FILE}` ya existe: no se sobrescribe (idempotente). "
            "Usa `init --force` para regenerarlo o edítalo a mano."
        )
        return 0
    template = example.read_text(encoding="utf-8")
    rendered, meta = render_env_template(template)
    if dry_run:
        print(f"[dry-run] generaría `{ENV_FILE}` regenerando: {', '.join(meta['regenerated'])}")
        return 0
    # Escritura con permisos restrictivos ( POSIX; en Windows es no-op ).
    fd, tmp = tempfile.mkstemp(dir=str(root), prefix=".env.", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            fh.write(rendered)
        try:
            os.chmod(tmp, 0o600)
        except OSError:
            pass
        os.replace(tmp, target)
    finally:
        try:
            os.unlink(tmp)
        except OSError:
            pass
    print(
        f"`{ENV_FILE}` creado con secretos aleatorios "
        f"({', '.join(meta['regenerated'])}). No se muestra ningún valor. "
        "Consulta tus credenciales abriendo `.env` en tu editor "
        "(no las pegues en logs ni issues)."
    )
    return 0


def compose_base() -> list[str]:
    return ["docker", "compose", "-p", COMPOSE_PROJECT, "-f", COMPOSE_FILE]


def cmd_up(root: Path, build: bool, timeout_s: int, dry_run: bool) -> int:
    cmd = compose_base() + ["up", "-d"] + (["--build"] if build else [])
    if dry_run:
        run(cmd, cwd=root, dry_run=True)
        return 0
    for problem in check_python() + check_config(root):
        print(f"ERROR: {problem}", file=sys.stderr)
        return 2
    for problem in check_docker(root, dry_run=dry_run):
        print(f"ERROR: {problem}", file=sys.stderr)
        return 1
    warnings = check_ports()
    for warning in warnings:
        print(f"AVISO: {warning}", file=sys.stderr)
    proc = run(cmd, cwd=root, dry_run=dry_run)
    if proc.returncode != 0:
        print("ERROR: `compose up` falló. Revisa `docker compose logs`.", file=sys.stderr)
        return 1
    if not wait_for_health(timeout_s):
        print(
            "ERROR: el backend no respondió `/health` a tiempo. "
            "Diagnóstico: `python scripts/demo.py status` y "
            "`docker compose -p tfm_r3_demo logs backend`.",
            file=sys.stderr,
        )
        return 1
    print(f"Demo lista: frontend {NGINX_URL} · API {BACKEND_URL}/docs")
    return 0


def cmd_status(root: Path, dry_run: bool) -> int:
    proc = run(compose_base() + ["ps"], cwd=root, dry_run=dry_run)
    if proc.returncode != 0:
        return proc.returncode
    if dry_run:
        return 0
    try:
        health: dict[str, object] = http_get_json(BACKEND_URL + "/health", timeout=10)
        print(f"backend /health: {health.get('status', '?')}")
    except Exception as exc:
        print(f"backend /health: NO RESPONDE ({exc})", file=sys.stderr)
        return 1
    print(f"URLs: app {NGINX_URL} · frontend directo {FRONTEND_URL} · API {BACKEND_URL}")
    return 0


def http_get_json(url: str, timeout: int = 15) -> dict[str, object]:
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def cmd_smoke(root: Path, timeout_s: int, dry_run: bool) -> int:
    """Smoke reproducible sin dejar rastro (cookies solo en memoria)."""
    if dry_run:
        print("[dry-run] comprobaría: /health, login, /auth/me, scheduler, reset")
        return 0
    for problem in check_python() + check_config(root):
        print(f"ERROR: {problem}", file=sys.stderr)
        return 2
    env = parse_env_file(root / ENV_FILE)
    password = env.get("INITIAL_DEMO_PASSWORD", "")
    if not password or "CAMBIAME" in password:
        print(
            "ERROR: `.env` sin INITIAL_DEMO_PASSWORD válida. "
            "Ejecuta `python scripts/demo.py init --force`.",
            file=sys.stderr,
        )
        return 2

    deadline = time.time() + timeout_s
    # 1. /health público (con reintentos hasta el deadline).
    health: dict[str, object] | None = None
    last_err: Exception | None = None
    while time.time() < deadline:
        try:
            health = http_get_json(BACKEND_URL + "/health", timeout=10)
            break
        except Exception as exc:  # noqa: BLE001 — el smoke informa, no propaga
            last_err = exc
            time.sleep(5)
    if health is None or health.get("status") != "ok":
        print(f"ERROR: /health no OK ({last_err}). ¿Ejecutaste `up`?", file=sys.stderr)
        return 1
    print("1/5 /health OK (público)")

    # Sesión con cookies SOLO en memoria (nada en disco).
    jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    try:
        # 2. Login demo (prueba migraciones + seed de usuarios).
        payload = json.dumps({"username": "admin", "password": password}).encode()
        req = urllib.request.Request(
            BACKEND_URL + "/api/v1/auth/login",
            data=payload,
            headers={"Content-Type": "application/json"},
        )
        with opener.open(req, timeout=15) as resp:
            body = json.loads(resp.read().decode("utf-8"))
        if "user" not in body and "access_token" not in body:
            print("ERROR: login sin credenciales válidas en la respuesta.", file=sys.stderr)
            return 1
        print("2/5 login demo OK (cookie HttpOnly en memoria)")

        # 3. Endpoint autenticado.
        req = urllib.request.Request(BACKEND_URL + "/api/v1/auth/me")
        with opener.open(req, timeout=15) as resp:
            me = json.loads(resp.read().decode("utf-8"))
        assert me.get("username") == "admin", f"usuario inesperado: {me}"
        print("3/5 /auth/me OK como 'admin'")

        # 4. Estado del scheduler (prueba migraciones 0011/0012).
        req = urllib.request.Request(BACKEND_URL + "/api/v1/admin/synthetic/scheduler")
        with opener.open(req, timeout=15) as resp:
            sched_state = json.loads(resp.read().decode("utf-8"))
        print(f"4/5 scheduler OK (paused={sched_state.get('paused')})")

        # 5. Reset sintético (solo filas synthetic/generated) + estado.
        req = urllib.request.Request(
            BACKEND_URL + "/api/v1/admin/synthetic/reset",
            data=b"",
            method="POST",
        )
        with opener.open(req, timeout=60) as resp:
            reset_res = json.loads(resp.read().decode("utf-8"))
        print(f"5/5 reset sintético OK ({reset_res})")
    except urllib.error.HTTPError as exc:
        print(
            f"ERROR: smoke falló con HTTP {exc.code} en {exc.url}. "
            "Revisa `docker compose -p tfm_r3_demo logs backend`.",
            file=sys.stderr,
        )
        return 1
    except Exception as exc:  # noqa: BLE001
        print(f"ERROR: smoke falló ({exc}).", file=sys.stderr)
        return 1
    finally:
        jar.clear()  # las cookies en memoria se descartan siempre
    print("SMOKE OK: sin cookies/tokens/archivos residuales.")
    return 0


def confirm(prompt: str, assume_yes: bool) -> bool:
    if assume_yes:
        return True
    try:
        answer = input(f"{prompt} [s/N]: ").strip().lower()
    except (EOFError, KeyboardInterrupt):
        return False
    return answer in {"s", "si", "sí", "y", "yes"}


def cmd_reset(root: Path, assume_yes: bool, dry_run: bool) -> int:
    """Reset sintético vía API (no destruye volúmenes ni esquema)."""
    if dry_run:
        print("[dry-run] POST /api/v1/admin/synthetic/reset")
        return 0
    for problem in check_python() + check_config(root):
        print(f"ERROR: {problem}", file=sys.stderr)
        return 2
    if not confirm(
        "Resetear SOLO filas sintéticas del proyecto tfm_r3_demo", assume_yes
    ):
        print("Cancelado.")
        return 0
    env = parse_env_file(root / ENV_FILE)
    password = env.get("INITIAL_DEMO_PASSWORD", "")
    jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    try:
        payload = json.dumps({"username": "admin", "password": password}).encode()
        req = urllib.request.Request(
            BACKEND_URL + "/api/v1/auth/login",
            data=payload,
            headers={"Content-Type": "application/json"},
        )
        with opener.open(req, timeout=15):
            pass
        req = urllib.request.Request(
            BACKEND_URL + "/api/v1/admin/synthetic/reset", data=b"", method="POST"
        )
        with opener.open(req, timeout=60) as resp:
            print(f"Reset OK: {resp.read().decode('utf-8')}")
    except Exception as exc:  # noqa: BLE001
        print(f"ERROR: reset falló ({exc}). ¿Está el stack levantado (`up`)?", file=sys.stderr)
        return 1
    finally:
        jar.clear()
    return 0


def cmd_down(root: Path, volumes: bool, assume_yes: bool, dry_run: bool) -> int:
    if dry_run:
        run(
            compose_base() + ["down"] + (["-v"] if volumes else []),
            cwd=root,
            dry_run=True,
        )
        return 0
    if volumes and not confirm(
        "BORRAR también los volúmenes del proyecto tfm_r3_demo (datos demo)",
        assume_yes,
    ):
        print("Cancelado.")
        return 0
    cmd = compose_base() + ["down"] + (["-v"] if volumes else [])
    proc = run(cmd, cwd=root, dry_run=dry_run)
    if proc.returncode != 0:
        print("ERROR: `compose down` falló.", file=sys.stderr)
        return 1
    print("Stack tfm_r3_demo apagado" + (" (con volúmenes)" if volumes else "") + ".")
    return 0


def wait_for_health(timeout_s: int) -> bool:
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        try:
            if http_get_json(BACKEND_URL + "/health", timeout=5).get("status") == "ok":
                return True
        except Exception:  # noqa: BLE001 — reintento hasta el deadline
            pass
        time.sleep(5)
    return False


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="demo.py",
        description="CLI portable de la demo Tools4Milk (proyecto tfm_r3_demo).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Muestra lo que haría sin ejecutar cambios.",
    )
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument(
        "--dry-run",
        action="store_true",
        default=argparse.SUPPRESS,
        help="Muestra lo que haría sin ejecutar cambios.",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p_init = sub.add_parser(
        "init", parents=[common], help="Genera .env local con secretos aleatorios."
    )
    p_init.add_argument("--force", action="store_true", help="Regenera .env existente.")

    p_up = sub.add_parser("up", parents=[common], help="Levanta el stack demo.")
    p_up.add_argument("--build", action="store_true", default=True, help="Reconstruye imágenes.")
    p_up.add_argument("--no-build", action="store_false", dest="build")
    p_up.add_argument("--timeout", type=int, default=300, help="Espera de /health en segundos.")

    sub.add_parser("status", parents=[common], help="Estado del stack y /health.")

    p_smoke = sub.add_parser(
        "smoke", parents=[common], help="Verificación reproducible sin rastro."
    )
    p_smoke.add_argument("--timeout", type=int, default=300)

    p_reset = sub.add_parser(
        "reset", parents=[common], help="Reset SOLO de filas sintéticas."
    )
    p_reset.add_argument("--yes", action="store_true", help="Omite la confirmación.")

    p_down = sub.add_parser(
        "down", parents=[common], help="Apaga el stack (solo tfm_r3_demo)."
    )
    p_down.add_argument("--volumes", action="store_true", help="Borra también volúmenes.")
    p_down.add_argument("--yes", action="store_true", help="Omite la confirmación.")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    root = repo_root()
    dry_run: bool = args.dry_run
    if args.command == "init":
        return cmd_init(root, force=args.force, dry_run=dry_run)
    if args.command == "up":
        return cmd_up(root, build=args.build, timeout_s=args.timeout, dry_run=dry_run)
    if args.command == "status":
        return cmd_status(root, dry_run=dry_run)
    if args.command == "smoke":
        return cmd_smoke(root, timeout_s=args.timeout, dry_run=dry_run)
    if args.command == "reset":
        return cmd_reset(root, assume_yes=args.yes, dry_run=dry_run)
    if args.command == "down":
        return cmd_down(root, volumes=args.volumes, assume_yes=args.yes, dry_run=dry_run)
    parser.print_help()
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
