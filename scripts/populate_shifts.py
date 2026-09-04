#!/usr/bin/env python3
"""
Script para poblar turnos y asignaciones automáticamente
"""
import requests
import json
from datetime import datetime, timedelta
from typing import List, Dict

BASE_URL = "http://localhost"
API_URL = f"{BASE_URL}/api/v1"

# Get auth token
def get_auth_token() -> str:
    """Get authentication token"""
    response = requests.post(f"{API_URL}/auth/login", json={
        "username": "admin",
        "password": "testpass123"
    })
    if response.status_code == 200:
        return response.json()["token"]["access_token"]
    print(f"Error getting token: {response.status_code}")
    return ""

HEADERS = {"Authorization": ""}

def get_employees() -> List[Dict]:
    """Get all employees"""
    response = requests.get(f"{API_URL}/employees", headers=HEADERS)
    if response.status_code == 200:
        data = response.json()
        # Handle both formats: list or dict with "empleados" key
        if isinstance(data, list):
            return data
        return data.get("empleados", [])
    print(f"Error getting employees: {response.status_code}")
    return []

def get_zones() -> List[Dict]:
    """Get all zones"""
    response = requests.get(f"{API_URL}/zones", headers=HEADERS)
    if response.status_code == 200:
        data = response.json()
        # Handle both formats: list or dict with "zonas" key
        if isinstance(data, list):
            return data
        return data.get("zonas", [])
    print(f"Error getting zones: {response.status_code}")
    return []

def create_shift(fecha: str, tipo_turno: str, hora_inicio: str, hora_fin: str) -> Dict:
    """Create a new shift"""
    payload = {
        "fecha": fecha,
        "tipo_turno": tipo_turno,
        "hora_inicio": hora_inicio,
        "hora_fin": hora_fin,
        "notas": "Turno automático"
    }
    response = requests.post(f"{API_URL}/turnos", json=payload, headers=HEADERS)
    if response.status_code == 200:
        return response.json()
    print(f"Error creating shift: {response.status_code} - {response.text}")
    return {}

def assign_employee_to_shift(turno_id: str, empleado_id: str, zona_id: str = None) -> bool:
    """Assign employee to shift"""
    payload = {
        "turno_id": turno_id,
        "empleado_id": empleado_id,
        "zona_id": zona_id
    }
    response = requests.post(f"{API_URL}/asignaciones-turno", json=payload, headers=HEADERS)
    if response.status_code == 200:
        return True
    # If 409 (conflict), it means the assignment already exists, which is fine
    if response.status_code == 409:
        return True
    print(f"Error assigning employee: {response.status_code} - {response.text}")
    return False

def populate_shifts():
    """Main function to populate shifts"""
    global HEADERS
    token = get_auth_token()
    if not token:
        print("Failed to get authentication token")
        return
    HEADERS = {"Authorization": f"Bearer {token}"}

    employees = get_employees()
    zones = get_zones()

    if not employees:
        print("No employees found")
        return

    print(f"Found {len(employees)} employees")
    print(f"Found {len(zones)} zones")

    # Create shifts for the next 7 days
    start_date = datetime.now()

    total_shifts_created = 0
    total_assignments_created = 0

    for day_offset in range(7):
        current_date = start_date + timedelta(days=day_offset)
        fecha = current_date.strftime("%Y-%m-%d")

        # Morning shift 06:00-14:00
        morning_shift = create_shift(fecha, "manana", "06:00", "14:00")
        if morning_shift.get("id"):
            total_shifts_created += 1
            # Assign first 2-3 employees to morning shift
            for emp in employees[:3]:
                if assign_employee_to_shift(morning_shift["id"], emp["id"]):
                    total_assignments_created += 1
                    print(f"✓ Assigned {emp['nombre']} to morning shift on {fecha}")

        # Afternoon shift 16:00-00:00
        afternoon_shift = create_shift(fecha, "tarde", "16:00", "00:00")
        if afternoon_shift.get("id"):
            total_shifts_created += 1
            # Assign different set of employees to afternoon shift
            for emp in employees[1:4]:  # Skip first, take next 3
                if assign_employee_to_shift(afternoon_shift["id"], emp["id"]):
                    total_assignments_created += 1
                    print(f"✓ Assigned {emp['nombre']} to afternoon shift on {fecha}")

    print(f"\n✓ Created {total_shifts_created} shifts")
    print(f"✓ Created {total_assignments_created} shift assignments")

if __name__ == "__main__":
    populate_shifts()
