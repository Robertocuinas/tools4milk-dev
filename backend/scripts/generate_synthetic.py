"""CLI para generar, validar y resetear artefactos sintéticos.

Ejemplos:
  python scripts/generate_synthetic.py --profile demo --scenario normal --output artifacts/demo.json
  python scripts/generate_synthetic.py --profile small --check
  python scripts/generate_synthetic.py --reset --output artifacts/demo.json
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.synthetic_data import (  # noqa: E402
    GenerationRequest,
    SCENARIOS,
    generate_dataset,
    quality_report,
)


def main() -> int:
    parser = argparse.ArgumentParser(description="Generador sintético determinista de Tools4Milk")
    parser.add_argument("--profile", choices=("small", "demo", "load"), default="demo")
    parser.add_argument("--scenario", choices=sorted(SCENARIOS), default="normal")
    parser.add_argument("--seed", type=int, default=20260602)
    parser.add_argument("--simulation-time", default="2026-06-01T12:00:00+00:00")
    parser.add_argument("--generated-at", default="2026-06-01T12:00:00+00:00")
    parser.add_argument("--output", type=Path, default=Path("artifacts/synthetic-dataset.json"))
    parser.add_argument("--check", action="store_true", help="falla si los controles DQ no pasan")
    parser.add_argument("--reset", action="store_true", help="elimina el artefacto indicado y no genera datos")
    args = parser.parse_args()
    if args.reset:
        if args.output.exists():
            args.output.unlink()
        print(f"reset: {args.output}")
        return 0
    dataset = generate_dataset(GenerationRequest(args.profile, args.seed, args.scenario, args.simulation_time, args.generated_at))
    report = quality_report(dataset)
    if args.check and not report["ok"]:
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 1
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(dataset, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"generated: {args.output} ({args.profile}/{args.scenario})")
    print(f"dq: {'ok' if report['ok'] else 'failed'}; errors={len(report['errors'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
