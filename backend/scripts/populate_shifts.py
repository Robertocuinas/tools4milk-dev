#!/usr/bin/env python3
"""Pobla turnos y asignaciones vía la API REST.

Uso:
    python scripts/populate_shifts.py [--base-url URL] [--days N]

Por defecto apunta a ``http://localhost`` (proxy Nginx en docker-compose);
en desarrollo directo contra uvicorn usar ``--base-url http://localhost:8000``.
El token de admin se obtiene con las credenciales de la variable
``ADMIN_USERNAME`` / ``ADMIN_PASSWORD`` (con los mismos valores por defecto que
arranque el backend en dev: ``admin`` / ``testpass123``).
"""
from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timedelta

import requests

DEFAULT_BASE_URL = os.environ.get("TOOLS4MILK_BASE_URL", "http://localhost")
DEFAULT_USERNAME = os.environ.get("ADMIN_USERNAME", "admin")
DEFAULT_PASSWORD = os.environ.get("ADMIN_PASSWORD", "testpass123")
DEFAULT_DAYS = 7


def get_auth_token(base_url: str, username: str, password: str) -> str | None:
    response = requests.post(
        f"{base_url}/api/v1/auth/login",
        json={"username": username, "password": password},
        timeout=10,
    )
    if response.status_code == 200:
        return response.json()["token"]["access_token"]
    print(f"Error getting token: {response.status_code} {response.text[:120]}")
    return None


def _unwrap_list(response: requests.Response, key: str) -> list[dict]:
    data = response.json()
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        return data.get(key) or []
    return []


def get_employees(base_url: str, headers: dict) -> list[dict]:
    response = requests.get(f"{base_url}/api/v1/employees", headers=headers, timeout=10)
    if response.status_code == 200:
        return _unwrap_list(response, "empleados")
    print(f"Error getting employees: {response.status_code}")
    return []


def get_zones(base_url: str, headers: dict) -> list[dict]:
    response = requests.get(f"{base_url}/api/v1/zones", headers=headers, timeout=10)
    if response.status_code == 200:
        return _unwrap_list(response, "zonas")
    print(f"Error getting zones: {response.status_code}")
    return []


def create_shift(base_url: str, headers: dict, fecha: str, tipo_turno: str,
                 hora_inicio: str, hora_fin: str) -> dict:
    response = requests.post(
        f"{base_url}/api/v1/turnos",
        json={
            "fecha": fecha,
            "tipo_turno": tipo_turno,
            "hora_inicio": hora_inicio,
            "hora_fin": hora_fin,
            "notas": "Turno automático",
        },
        headers=headers,
        timeout=10,
    )
    if response.status_code == 200:
        return response.json()
    # 409 = ya existe; re-leemos y devolvemos el existente para mantener idempotencia.
    if response.status_code == 409:
        existing = requests.get(
            f"{base_url}/api/v1/turnos",
            params={"fecha": fecha, "tipo_turno": tipo_turno},
            headers=headers,
            timeout=10,
        )
        if existing.status_code == 200:
            turnos = _unwrap_list(existing, "turnos")
            if turnos:
                return turnos[0]
    print(f"Error creating shift {fecha} {tipo_turno}: {response.status_code} {response.text[:120]}")
    return {}


def assign_employee_to_shift(base_url: str, headers: dict, turno_id: str,
                             empleado_id: str, zona_id: str | None = None) -> bool:
    payload: dict = {"turno_id": turno_id, "empleado_id": empleado_id}
    if zona_id:
        payload["zona_id"] = zona_id
    response = requests.post(
        f"{base_url}/api/v1/asignaciones-turno",
        json=payload,
        headers=headers,
        timeout=10,
    )
    # 200 / 409 (duplicate) son ambos resultados válidos para la operación idempotente.
    return response.status_code in (200, 409)


def populate_shifts(base_url: str, username: str, password: str, days: int) -> tuple[int, int]:
    token = get_auth_token(base_url, username, password)
    if not token:
        print("Failed to get authentication token")
        return 0, 0

    headers = {"Authorization": f"Bearer {token}"}
    employees = get_employees(base_url, headers)
    zones = get_zones(base_url, headers)

    if not employees:
        print("No employees found — crea al menos un empleado antes de poblar turnos.")
        return 0, 0

    print(f"Found {len(employees)} employees, {len(zones)} zones")

    start_date = datetime.now()
    shifts_created = 0
    assignments_created = 0

    for day_offset in range(days):
        fecha = (start_date + timedelta(days=day_offset)).strftime("%Y-%m-%d")

        morning = create_shift(base_url, headers, fecha, "manana", "06:00", "14:00")
        if morning.get("id"):
            shifts_created += 1
            for emp in employees[:3]:
                if assign_employee_to_shift(base_url, headers, morning["id"], emp["id"]):
                    assignments_created += 1
                    print(f"  + {emp['nombre']} → mañana {fecha}")

        afternoon = create_shift(base_url, headers, fecha, "tarde", "16:00", "00:00")
        if afternoon.get("id"):
            shifts_created += 1
            for emp in employees[1:4]:
                if assign_employee_to_shift(base_url, headers, afternoon["id"], emp["id"]):
                    assignments_created += 1
                    print(f"  + {emp['nombre']} → tarde {fecha}")

    return shifts_created, assignments_created


def main() -> int:
    parser = argparse.ArgumentParser(description="Poblar turnos vía la API REST.")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL,
                        help=f"URL base del backend (default: {DEFAULT_BASE_URL})")
    parser.add_argument("--username", default=DEFAULT_USERNAME,
                        help=f"Usuario admin (default: {DEFAULT_USERNAME})")
    parser.add_argument("--password", default=DEFAULT_PASSWORD,
                        help="Password admin (default: oculto; usar ADMIN_PASSWORD env var en CI)")
    parser.add_argument("--days", type=int, default=DEFAULT_DAYS,
                        help=f"Días a poblar a partir de hoy (default: {DEFAULT_DAYS})")
    args = parser.parse_args()

    print(f"Target: {args.base_url}  days={args.days}")
    shifts, assignments = populate_shifts(args.base_url, args.username, args.password, args.days)
    print(f"\nCreated {shifts} shifts and {assignments} assignments")
    return 0 if shifts > 0 else 1


if __name__ == "__main__":
    sys.exit(main())