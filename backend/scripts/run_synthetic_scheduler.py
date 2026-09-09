"""Ejecutor manual/programado del scheduler sintético.

Uso local:
  python scripts/run_synthetic_scheduler.py --once --profile small
  python scripts/run_synthetic_scheduler.py --interval-seconds 3600
"""
from __future__ import annotations

import argparse
import logging
import time
import sys

ROOT = __import__("pathlib").Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.database import SessionLocal  # noqa: E402
from app.synthetic_scheduler import SchedulerRequest, run_once  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Scheduler reproducible de la demo sintética")
    parser.add_argument("--once", action="store_true", help="ejecutar una vez y salir")
    parser.add_argument("--interval-seconds", type=int, default=3600, help="intervalo entre ejecuciones")
    parser.add_argument("--profile", choices=("small", "demo", "load"), default="small")
    parser.add_argument("--scenario", default="normal")
    parser.add_argument("--seed", type=int, default=20260602)
    parser.add_argument("--horizon-days", type=int, default=7)
    args = parser.parse_args()
    if args.interval_seconds < 1 or not 1 <= args.horizon_days <= 365:
        parser.error("interval-seconds debe ser >= 1 y horizon-days debe estar entre 1 y 365")
    request = SchedulerRequest(args.profile, args.seed, args.scenario, horizon_days=args.horizon_days)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
    while True:
        with SessionLocal() as db:
            result = run_once(db, request)
            print(result, flush=True)
        if args.once:
            return 0 if result.get("status") in {"ok", "paused"} else 1
        time.sleep(args.interval_seconds)


if __name__ == "__main__":
    raise SystemExit(main())