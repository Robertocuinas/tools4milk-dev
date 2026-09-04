"""Población de datos realistas para Tools4Milk (explotación de Villalba, Lugo).

Objetivo: dejar la aplicación visualizable como funcional (dashboard, animales,
calidad, tareas, alertas, incidencias, turnos, relevos, pedidos, recría y
meteorología) con datos coherentes y NO etiquetados como "demo".

Características:
- Idempotente: cada bloque solo siembra si su tabla está vacía. Re-ejecutarlo no
  duplica filas y NO toca datos reales existentes.
- Standalone y manual: NO se ejecuta en el arranque ni en el Dockerfile. Lo lanza
  deliberadamente quien administra la base de datos.
- Sin dependencias extra (no usa Faker): nombres y valores curados.
- Reutiliza el esquema real (app.models.tools4milk) y zonas/maquinaria/tareas_catalogo
  que ya crea la migración baseline.

Uso:
    python scripts/seed_realistic_data.py            # siembra lo que falte
    python scripts/seed_realistic_data.py --status   # solo muestra recuentos
    python scripts/seed_realistic_data.py --weather-days 14

NO ejecutar contra producción sin querer poblarla: respeta DATABASE_URL.
"""

from __future__ import annotations

import argparse
import random
import sys
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from pathlib import Path
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import func, select  # noqa: E402

from app.database import SessionLocal  # noqa: E402
from app.enums import EstadoTarea, NivelAlerta, TipoTurno  # noqa: E402
from app.models.tools4milk import (  # noqa: E402
    Alerta,
    AsignacionTurno,
    Animal,
    BoxRecria,
    Empleado,
    EventoSanitario,
    Incidencia,
    Lactacion,
    LecturaMeteo,
    Maquinaria,
    Pedido,
    ResumenRelevo,
    TareaCatalogo,
    TareaEjecucion,
    TratamientoActivo,
    Turno,
    Zona,
)
from app.time_utils import utc_now  # noqa: E402

RNG = random.Random(20260602)  # determinista para reproducibilidad
ESTACION_ID = "villalba_lugo"

NOMBRES_VACAS = [
    "Lúa", "Estrela", "Marela", "Pinta", "Galana", "Loira", "Cabana", "Rosa",
    "Vaqueira", "Moura", "Xoana", "Brava", "Donosa", "Faísca", "Lousa", "Meiga",
    "Nai", "Perla", "Quenlla", "Ruda", "Sela", "Tella", "Uxía", "Veiga",
    "Airexa", "Bican", "Centola", "Dorna", "Eira", "Fonte",
]
RAZAS = ["Frisona", "Frisona", "Frisona", "Pardo Alpina", "Cruce"]


def _count(db, model) -> int:
    return db.scalar(select(func.count()).select_from(model)) or 0


def zonas_por_nombre(db) -> dict[str, Zona]:
    return {z.nombre: z for z in db.scalars(select(Zona)).all()}


def seed_empleados(db) -> None:
    if _count(db, Empleado) > 0:
        print("SKIP empleados (ya hay datos)")
        return
    zonas = zonas_por_nombre(db)
    nave = zonas.get("Nave")
    enf = zonas.get("Enfermería")
    recria = zonas.get("Recría")
    base = [
        ("Roberto", "Castro", "encargado", nave, ["VMS", "TMR"]),
        ("Laura", "Fernández", "auxiliar", nave, ["TMR"]),
        ("Marcos", "Vázquez", "auxiliar", recria, []),
        ("Elena", "Méndez", "veterinario", enf, ["veterinaria"]),
        ("Sofía", "Rodríguez", "auxiliar", recria, []),
        ("Diego", "López", "mecanico", None, ["mecanica"]),
    ]
    for nombre, apellidos, rol, zona, cual in base:
        db.add(
            Empleado(
                id=uuid4(),
                nombre=nombre,
                apellidos=apellidos,
                rol=rol,
                zona_principal_id=zona.id if zona else None,
                cualificaciones=cual,
                activo=True,
                fecha_alta=date(2021, 1, 15),
            )
        )
    db.commit()
    print("OK empleados: 6")


def seed_animales(db, today: date) -> None:
    if _count(db, Animal) > 0:
        print("SKIP animales (ya hay datos)")
        return
    zonas = zonas_por_nombre(db)
    nave = zonas.get("Nave")
    enf = zonas.get("Enfermería")
    boxes = zonas.get("Boxes")
    recria = zonas.get("Recría")

    seq = 1

    def crotal() -> str:
        nonlocal seq
        c = f"ES{1500000000 + seq:010d}"
        seq += 1
        return c

    nombre_idx = 0

    def next_nombre() -> str:
        nonlocal nombre_idx
        n = NOMBRES_VACAS[nombre_idx % len(NOMBRES_VACAS)]
        nombre_idx += 1
        return n

    # 30 vacas en producción en la Nave
    for _ in range(30):
        edad_anios = RNG.randint(3, 7)
        db.add(
            Animal(
                id=uuid4(),
                crotal_oficial=crotal(),
                nombre=next_nombre(),
                sexo="hembra",
                fecha_nacimiento=today - timedelta(days=365 * edad_anios + RNG.randint(0, 200)),
                raza=RNG.choice(RAZAS),
                estado="produccion",
                estado_reproductivo=RNG.choice(["vacia", "inseminada", "confirmada_gestante", "parto_reciente"]),
                zona_id=nave.id if nave else None,
                fecha_entrada=today - timedelta(days=365 * edad_anios),
            )
        )
    # 4 secas / gestantes en la Nave
    for _ in range(4):
        db.add(
            Animal(
                id=uuid4(),
                crotal_oficial=crotal(),
                nombre=next_nombre(),
                sexo="hembra",
                fecha_nacimiento=today - timedelta(days=365 * RNG.randint(4, 8)),
                raza=RNG.choice(RAZAS),
                estado=RNG.choice(["seca", "gestante"]),
                estado_reproductivo="confirmada_gestante",
                zona_id=nave.id if nave else None,
                fecha_entrada=today - timedelta(days=900),
            )
        )
    # 3 en enfermería (en producción pero en tratamiento)
    for _ in range(3):
        db.add(
            Animal(
                id=uuid4(),
                crotal_oficial=crotal(),
                nombre=next_nombre(),
                sexo="hembra",
                fecha_nacimiento=today - timedelta(days=365 * RNG.randint(3, 6)),
                raza=RNG.choice(RAZAS),
                estado="produccion",
                estado_reproductivo="vacia",
                zona_id=enf.id if enf else None,
                fecha_entrada=today - timedelta(days=700),
            )
        )
    # 10 novillas de recría
    for _ in range(10):
        meses = RNG.randint(8, 20)
        db.add(
            Animal(
                id=uuid4(),
                crotal_oficial=crotal(),
                nombre=next_nombre(),
                sexo="hembra",
                fecha_nacimiento=today - timedelta(days=30 * meses),
                raza=RNG.choice(RAZAS),
                estado="recria",
                zona_id=recria.id if recria else None,
                fecha_entrada=today - timedelta(days=30 * meses),
            )
        )
    # 6 terneros en boxes
    for _ in range(6):
        dias = RNG.randint(5, 60)
        db.add(
            Animal(
                id=uuid4(),
                crotal_oficial=crotal(),
                nombre=None,
                sexo=RNG.choice(["hembra", "macho"]),
                fecha_nacimiento=today - timedelta(days=dias),
                raza=RNG.choice(RAZAS),
                estado="recria",
                zona_id=boxes.id if boxes else None,
                fecha_entrada=today - timedelta(days=dias),
            )
        )
    db.commit()
    print(f"OK animales: {_count(db, Animal)}")


def seed_lactaciones(db, today: date) -> None:
    if _count(db, Lactacion) > 0:
        print("SKIP lactaciones (ya hay datos)")
        return
    vacas = db.scalars(select(Animal).where(Animal.estado == "produccion")).all()
    n = 0
    for animal in vacas:
        numero = RNG.randint(1, 5)
        dias_en_leche = RNG.randint(30, 305)
        media_diaria = RNG.uniform(26, 42)
        db.add(
            Lactacion(
                id=uuid4(),
                animal_id=animal.id,
                numero=numero,
                fecha_parto=today - timedelta(days=dias_en_leche),
                fecha_secado=None,
                produccion_total_kg=Decimal(str(round(media_diaria * dias_en_leche, 1))),
                grasa_promedio=Decimal(str(round(RNG.uniform(3.6, 4.2), 3))),
                proteina_promedio=Decimal(str(round(RNG.uniform(3.2, 3.6), 3))),
                rcs_promedio=RNG.randint(90, 320) * 1000,
            )
        )
        n += 1
    db.commit()
    print(f"OK lactaciones: {n}")


def seed_tratamientos(db, today: date) -> None:
    if _count(db, TratamientoActivo) > 0:
        print("SKIP tratamientos (ya hay datos)")
        return
    vet = db.scalar(select(Empleado).where(Empleado.rol == "veterinario"))
    enfermos = db.scalars(select(Animal).where(Animal.estado == "produccion").limit(3)).all()
    farmacos = [
        ("Mastijet", "1 cánula/12h", "intramamaria", 4),
        ("Penethaject", "20 ml/día", "intramuscular", 3),
        ("Metacam", "15 ml/día", "subcutánea", 2),
    ]
    for animal, (farmaco, dosis, via, dias) in zip(enfermos, farmacos):
        inicio = today - timedelta(days=RNG.randint(0, 2))
        db.add(
            TratamientoActivo(
                id=uuid4(),
                animal_id=animal.id,
                farmaco=farmaco,
                dosis=dosis,
                via_administracion=via,
                dias_tratamiento=dias,
                fecha_inicio=inicio,
                fecha_fin_prevista=inicio + timedelta(days=dias),
                activo=True,
                checkboxes=[],
                prescrito_por=vet.id if vet else None,
            )
        )
    db.commit()
    print(f"OK tratamientos activos: {len(list(zip(enfermos, farmacos)))}")


def seed_eventos_sanitarios(db, today: date) -> None:
    if _count(db, EventoSanitario) > 0:
        print("SKIP eventos_sanitarios (ya hay datos)")
        return
    vet = db.scalar(select(Empleado).where(Empleado.rol == "veterinario"))
    animales = db.scalars(select(Animal).where(Animal.estado == "produccion").limit(5)).all()
    patologias = ["mastitis", "cojera", "metritis", "cetosis", "otra"]
    for animal, pat in zip(animales, patologias):
        inicio = today - timedelta(days=RNG.randint(5, 40))
        db.add(
            EventoSanitario(
                id=uuid4(),
                animal_id=animal.id,
                tipo_patologia=pat,
                fecha_inicio=inicio,
                fecha_fin=inicio + timedelta(days=RNG.randint(3, 10)),
                tratamiento="Protocolo estándar",
                resuelto=True,
                veterinario_id=vet.id if vet else None,
            )
        )
    db.commit()
    print(f"OK eventos_sanitarios: {len(list(zip(animales, patologias)))}")


def seed_incidencias(db, today: date) -> None:
    if _count(db, Incidencia) > 0:
        print("SKIP incidencias (ya hay datos)")
        return
    zonas = zonas_por_nombre(db)
    empleados = db.scalars(select(Empleado)).all()
    plantillas = [
        ("averia_maquinaria", "alta", "abierta", "Robot VMS 2 con error de vacío", "Nave"),
        ("calidad_leche", "media", "en_gestion", "RCS elevado en tanque", "Nave"),
        ("sanidad_animal", "alta", "abierta", "Cojera en revisión", "Enfermería"),
        ("infraestructura", "baja", "resuelta", "Bebedero atascado", "Recría"),
        ("alimentacion", "media", "abierta", "Desviación en ración TMR", "Nave"),
        ("pedidos", "baja", "cerrada", "Retraso en entrega de pienso", "Recría"),
    ]
    for tipo, sev, estado, titulo, zona_nombre in plantillas:
        zona = zonas.get(zona_nombre)
        emp = RNG.choice(empleados) if empleados else None
        apertura = utc_now() - timedelta(days=RNG.randint(0, 6), hours=RNG.randint(0, 12))
        db.add(
            Incidencia(
                id=uuid4(),
                tipo=tipo,
                severidad=sev,
                estado=estado,
                titulo=titulo,
                descripcion=titulo + ".",
                zona_id=zona.id if zona else None,
                reportado_por=emp.id if emp else None,
                ts_apertura=apertura,
                ts_cierre=(apertura + timedelta(hours=6)) if estado in {"resuelta", "cerrada"} else None,
                acciones=[],
            )
        )
    db.commit()
    print(f"OK incidencias: {len(plantillas)}")


def seed_alertas(db) -> None:
    if _count(db, Alerta) > 0:
        print("SKIP alertas (ya hay datos)")
        return
    zonas = zonas_por_nombre(db)
    animales = db.scalars(select(Animal).where(Animal.estado == "produccion").limit(5)).all()
    plantillas = [
        (NivelAlerta.ALTA, "RCS individual fuera de rango", "Nave"),
        (NivelAlerta.MEDIA, "Tarea de lavado de robot pendiente", "Nave"),
        (NivelAlerta.ALTA, "Tratamiento activo sin registrar", "Enfermería"),
        (NivelAlerta.BAJA, "Recordatorio de protocolo de vacunación", "Recría"),
        (NivelAlerta.MEDIA, "Desviación de ración TMR > 5%", "Nave"),
    ]
    for i, (nivel, titulo, zona_nombre) in enumerate(plantillas):
        zona = zonas.get(zona_nombre)
        animal = animales[i] if i < len(animales) else None
        db.add(
            Alerta(
                id=uuid4(),
                nivel=nivel,
                titulo=titulo,
                mensaje=titulo + ".",
                animal_id=animal.id if animal else None,
                zona_id=zona.id if zona else None,
                activa=True,
                pantalla_tv=True,
                tablet=True,
                ts_generacion=utc_now() - timedelta(hours=RNG.randint(1, 30)),
            )
        )
    db.commit()
    print(f"OK alertas: {len(plantillas)}")


def seed_tareas(db) -> None:
    if _count(db, TareaEjecucion) > 0:
        print("SKIP tareas_ejecuciones (ya hay datos)")
        return
    catalogo = db.scalars(select(TareaCatalogo)).all()
    if not catalogo:
        print("SKIP tareas_ejecuciones (no hay tareas_catalogo; aplica las migraciones)")
        return
    zonas = list(zonas_por_nombre(db).values())
    empleados = db.scalars(select(Empleado)).all()
    estados = [EstadoTarea.PENDIENTE] * 8 + [EstadoTarea.COMPLETADA] * 8 + [EstadoTarea.VENCIDA] * 3
    ahora = utc_now()
    for i in range(len(estados)):
        cat = RNG.choice(catalogo)
        estado = estados[i]
        planif = ahora + timedelta(hours=RNG.randint(-48, 48))
        emp = RNG.choice(empleados) if empleados else None
        zona = RNG.choice(zonas) if zonas else None
        ej = TareaEjecucion(
            id=uuid4(),
            catalogo_id=cat.id,
            empleado_id=emp.id if emp else None,
            zona_id=zona.id if zona else None,
            estado=estado,
            ts_planificada=planif,
            creado_en=ahora - timedelta(hours=RNG.randint(1, 72)),
        )
        if estado == EstadoTarea.COMPLETADA:
            ej.ts_inicio = planif
            ej.ts_fin = planif + timedelta(minutes=RNG.randint(15, 70))
        db.add(ej)
    db.commit()
    print(f"OK tareas_ejecuciones: {len(estados)}")


def seed_turnos(db, today: date) -> None:
    if _count(db, Turno) > 0:
        print("SKIP turnos (ya hay datos)")
        return
    empleados = db.scalars(select(Empleado)).all()
    zonas = zonas_por_nombre(db)
    turnos: list[Turno] = []
    for d in range(0, 5):
        fecha = today + timedelta(days=d)
        manana = Turno(id=uuid4(), fecha=fecha, tipo_turno=TipoTurno.MANANA, hora_inicio=time(6, 0), hora_fin=time(14, 0))
        tarde = Turno(id=uuid4(), fecha=fecha, tipo_turno=TipoTurno.TARDE, hora_inicio=time(14, 0), hora_fin=time(22, 0))
        db.add(manana)
        db.add(tarde)
        turnos.extend([manana, tarde])
    db.flush()
    nave = zonas.get("Nave")
    for turno in turnos:
        for emp in RNG.sample(empleados, k=min(len(empleados), 2)):
            db.add(
                AsignacionTurno(
                    id=uuid4(),
                    turno_id=turno.id,
                    empleado_id=emp.id,
                    zona_id=nave.id if nave else None,
                    rol=emp.rol,
                )
            )
    db.commit()
    print(f"OK turnos: {len(turnos)} (+ asignaciones)")


def seed_relevos(db) -> None:
    if _count(db, ResumenRelevo) > 0:
        print("SKIP resumenes_relevo (ya hay datos)")
        return
    turnos = db.scalars(select(Turno).order_by(Turno.fecha, Turno.hora_inicio)).all()
    if len(turnos) < 2:
        print("SKIP resumenes_relevo (faltan turnos)")
        return
    saliente, entrante = turnos[0], turnos[1]
    db.add(
        ResumenRelevo(
            id=uuid4(),
            turno_saliente_id=saliente.id,
            turno_entrante_id=entrante.id,
            ts_generacion=utc_now(),
            incidencias_abiertas=[],
            tareas_pendientes=[],
            alertas_pendientes=[],
            notas_saliente="Robot VMS 2 en revisión. Vigilar RCS del tanque.",
        )
    )
    db.commit()
    print("OK resumenes_relevo: 1")


def seed_pedidos(db) -> None:
    if _count(db, Pedido) > 0:
        print("SKIP pedidos (ya hay datos)")
        return
    emp = db.scalar(select(Empleado))
    plantillas = [
        ("Pienso de arranque terneros", Decimal("500"), "kg", "solicitado", "Nutrega"),
        ("Pajuelas de semen Frisona", Decimal("20"), "ud", "aprobado", "Xenética"),
        ("Selladores de pezones", Decimal("4"), "garrafa", "en_transito", "DeLaval"),
        ("Concentrado producción", Decimal("1000"), "kg", "recibido", "Nutrega"),
        ("Guantes de palpación", Decimal("2"), "caja", "solicitado", "Agrocenter"),
    ]
    for insumo, cantidad, unidad, estado, proveedor in plantillas:
        db.add(
            Pedido(
                id=uuid4(),
                insumo=insumo,
                cantidad=cantidad,
                unidad=unidad,
                estado=estado,
                proveedor=proveedor,
                solicitante_id=emp.id if emp else None,
                ts_solicitud=utc_now() - timedelta(days=RNG.randint(0, 10)),
            )
        )
    db.commit()
    print(f"OK pedidos: {len(plantillas)}")


def seed_boxes(db, today: date) -> None:
    if _count(db, BoxRecria) > 0:
        print("SKIP boxes_recria (ya hay datos)")
        return
    terneros = db.scalars(
        select(Animal).where(Animal.estado == "recria").order_by(Animal.fecha_nacimiento.desc()).limit(6)
    ).all()
    for n in range(1, 9):
        ternero = terneros[n - 1] if n - 1 < len(terneros) else None
        db.add(
            BoxRecria(
                id=uuid4(),
                box_numero=n,
                ternero_id=ternero.id if ternero else None,
                fecha_entrada=(today - timedelta(days=RNG.randint(1, 30))) if ternero else None,
                activo=True,
                alertas_box=[],
            )
        )
    db.commit()
    print("OK boxes_recria: 8")


def seed_meteo(db, dias: int) -> None:
    if _count(db, LecturaMeteo) > 0:
        print("SKIP lecturas_meteorologia (ya hay datos)")
        return
    base = utc_now().replace(hour=12, minute=0, second=0, microsecond=0)
    for i in range(dias):
        db.add(
            LecturaMeteo(
                ts=base - timedelta(days=dias - 1 - i),
                estacion_id=ESTACION_ID,
                temperatura_c=Decimal(str(round(RNG.uniform(8, 22), 1))),
                humedad_relativa=Decimal(str(round(RNG.uniform(60, 92), 1))),
                precipitacion_mm=None,
                prob_precipitacion_pct=Decimal(str(RNG.choice([0, 10, 30, 50, 70]))),
                viento_km_h=Decimal(str(round(RNG.uniform(3, 25), 1))),
            )
        )
    db.commit()
    print(f"OK lecturas_meteorologia: {dias}")


def print_status(db) -> None:
    pares = [
        ("zonas", Zona), ("maquinaria", Maquinaria), ("empleados", Empleado),
        ("animales", Animal), ("lactaciones", Lactacion), ("tratamientos_activos", TratamientoActivo),
        ("eventos_sanitarios", EventoSanitario), ("incidencias", Incidencia), ("alertas", Alerta),
        ("tareas_ejecuciones", TareaEjecucion), ("turnos", Turno), ("asignaciones_turno", AsignacionTurno),
        ("resumenes_relevo", ResumenRelevo), ("pedidos", Pedido), ("boxes_recria", BoxRecria),
        ("lecturas_meteorologia", LecturaMeteo),
    ]
    print("Recuentos actuales:")
    for nombre, model in pares:
        print(f"  {nombre:<24} {_count(db, model)}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Población de datos realistas Tools4Milk (idempotente).")
    parser.add_argument("--status", action="store_true", help="Solo mostrar recuentos, no sembrar.")
    parser.add_argument("--weather-days", type=int, default=14, help="Días de lecturas meteorológicas a generar.")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        if args.status:
            print_status(db)
            return
        today = utc_now().date()
        seed_empleados(db)
        seed_animales(db, today)
        seed_lactaciones(db, today)
        seed_tratamientos(db, today)
        seed_eventos_sanitarios(db, today)
        seed_incidencias(db, today)
        seed_alertas(db)
        seed_tareas(db)
        seed_turnos(db, today)
        seed_relevos(db)
        seed_pedidos(db)
        seed_boxes(db, today)
        seed_meteo(db, args.weather_days)
        print("\nListo. Estado final:")
        print_status(db)
    finally:
        db.close()


if __name__ == "__main__":
    main()
