"""Tests unitarios de la CLI portable (scripts/demo.py). Sin red ni Docker."""

import importlib.util
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
DEMO_PY = REPO_ROOT / "scripts" / "demo.py"


def load_demo(monkeypatch, tmp_path):
    """Carga demo.py con TFM_DEMO_ROOT apuntando a un tmp dir con .env.example."""
    target_example = tmp_path / ".env.example"
    target_example.write_text(
        (REPO_ROOT / ".env.example").read_text(encoding="utf-8"), encoding="utf-8"
    )
    monkeypatch.setenv("TFM_DEMO_ROOT", str(tmp_path))
    spec = importlib.util.spec_from_file_location("tfm_demo_cli", DEMO_PY)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_env_example_sin_secretos_reales():
    text = (REPO_ROOT / ".env.example").read_text(encoding="utf-8")
    assert "testpass123" not in text
    for key in ("SECRET_KEY=", "INITIAL_DEMO_PASSWORD=", "POSTGRES_PASSWORD="):
        line = next(l for l in text.splitlines() if l.startswith(key))
        assert "CAMBIAME" in line, f"{key} debe ser un placeholder inequívoco"


def test_render_regenera_secretos_aleatorios(monkeypatch, tmp_path):
    demo = load_demo(monkeypatch, tmp_path)
    template = (tmp_path / ".env.example").read_text(encoding="utf-8")
    first, meta_first = demo.render_env_template(template)
    second, _ = demo.render_env_template(template)
    assert meta_first["regenerated"] == [
        "INITIAL_DEMO_PASSWORD",
        "POSTGRES_PASSWORD",
        "SECRET_KEY",
    ]
    assert "CAMBIAME" not in first
    assert "testpass123" not in first
    assert first != second  # aleatoriedad real entre ejecuciones
    env = demo.parse_env_file(tmp_path / ".env.example")
    assert env  # el parser no revienta con comentarios


def test_init_idempotente_y_force(monkeypatch, tmp_path, capsys):
    demo = load_demo(monkeypatch, tmp_path)
    assert demo.main(["init"]) == 0
    env_file = tmp_path / ".env"
    assert env_file.exists()
    first_content = env_file.read_text(encoding="utf-8")

    capsys.readouterr()
    assert demo.main(["init"]) == 0  # idempotente: no sobrescribe
    assert env_file.read_text(encoding="utf-8") == first_content

    assert demo.main(["init", "--force"]) == 0
    assert env_file.read_text(encoding="utf-8") != first_content


def test_init_no_imprime_secretos(monkeypatch, tmp_path, capsys):
    demo = load_demo(monkeypatch, tmp_path)
    assert demo.main(["init"]) == 0
    out = capsys.readouterr().out
    env = demo.parse_env_file(tmp_path / ".env")
    for key in ("SECRET_KEY", "POSTGRES_PASSWORD", "INITIAL_DEMO_PASSWORD"):
        assert env[key] not in out, f"{key} filtrado en stdout"


def test_compose_limitado_al_proyecto_propio(monkeypatch, tmp_path, capsys):
    demo = load_demo(monkeypatch, tmp_path)
    assert demo.compose_base() == [
        "docker",
        "compose",
        "-p",
        "tfm_r3_demo",
        "-f",
        "docker-compose.yml",
    ]
    assert demo.main(["--dry-run", "up"]) == 0
    assert demo.main(["down", "--volumes", "--dry-run"]) == 0
    out = capsys.readouterr().out
    assert "tfm_r3_demo" in out
    assert "tfm_release1" not in out
    assert "tfm_ca0" not in out


def test_contrato_cli_seis_subcomandos(monkeypatch, tmp_path):
    demo = load_demo(monkeypatch, tmp_path)
    parser = demo.build_parser()
    assert parser.parse_args(["init"]).command == "init"
    assert parser.parse_args(["up"]).command == "up"
    assert parser.parse_args(["status"]).command == "status"
    assert parser.parse_args(["smoke"]).command == "smoke"
    assert parser.parse_args(["reset", "--yes"]).command == "reset"
    assert parser.parse_args(["down", "--volumes"]).command == "down"
    with pytest.raises(SystemExit):
        parser.parse_args([])


def test_smoke_y_reset_dry_run_sin_red(monkeypatch, tmp_path, capsys):
    demo = load_demo(monkeypatch, tmp_path)
    assert demo.main(["smoke", "--dry-run"]) == 0
    assert demo.main(["reset", "--yes", "--dry-run"]) == 0
    assert demo.main(["status", "--dry-run"]) == 0
    out = capsys.readouterr().out
    assert "tfm_r3_demo" in out or "comprobaría" in out


def test_project_name_parametrizable_y_validado(monkeypatch, tmp_path, capsys):
    demo = load_demo(monkeypatch, tmp_path)
    # Retrocompatibilidad: sin flag el proyecto sigue siendo tfm_r3_demo.
    assert demo.compose_base() == [
        "docker",
        "compose",
        "-p",
        "tfm_r3_demo",
        "-f",
        "docker-compose.yml",
    ]
    assert demo.compose_base("tfm_r5_demo")[3] == "tfm_r5_demo"
    assert demo.validate_project_name("tfm_r5_demo") == "tfm_r5_demo"

    capsys.readouterr()
    assert demo.main(["up", "--dry-run"]) == 0
    out_default = capsys.readouterr().out
    assert "-p tfm_r3_demo" in out_default

    assert demo.main(["up", "--dry-run", "--project-name", "tfm_r5_demo"]) == 0
    out_r5 = capsys.readouterr().out
    assert "-p tfm_r5_demo" in out_r5
    assert "-p tfm_r3_demo" not in out_r5

    assert (
        demo.main(["status", "--dry-run", "--project-name", "tfm_r5_demo"]) == 0
    )
    assert "-p tfm_r5_demo" in capsys.readouterr().out

    for bad in ("", "bad name", "a;b", "x$(y)", "../escape", "MAYUS"):
        with pytest.raises(ValueError):
            demo.validate_project_name(bad)
        assert demo.main(["up", "--dry-run", "--project-name", bad]) == 2
        capsys.readouterr()

    parser = demo.build_parser()
    assert "--project-name" in parser.format_help()
    assert (
        parser.parse_args(["up", "--project-name", "tfm_r5_demo"]).project_name
        == "tfm_r5_demo"
    )
    assert (
        parser.parse_args(["up"]).project_name == demo.DEFAULT_COMPOSE_PROJECT
    )


def test_demo_py_solo_biblioteca_estandar():
    tree = DEMO_PY.read_text(encoding="utf-8")
    assert "import requests" not in tree
    assert "import docker" not in tree
    assert "subprocess" in tree  # orquesta `docker compose` sin dependencias
    proc = subprocess.run(
        ["git", "check-ignore", "-q", ".env"],
        cwd=REPO_ROOT,
        capture_output=True,
        timeout=30,
    )
    assert proc.returncode == 0, ".env debe estar ignorado por git"
