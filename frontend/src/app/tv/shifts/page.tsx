"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertOctagon,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  MapPin,
  UserRound,
} from "lucide-react";
import { useMemo } from "react";
import { TvPanel, TvEmptyRow } from "@/components/tv/TvPanel";
import { TvShell } from "@/components/tv/TvShell";
import { api } from "@/lib/api";
import { TV_REFETCH, TV_STALE } from "@/lib/tv-constants";
import type { Employee, ShiftAssignment, ShiftType, Zone } from "@/lib/types";

const shiftTypeLabel: Record<ShiftType, string> = { manana: "Mañana", tarde: "Tarde" };
const shiftTypeStyle: Record<ShiftType, string> = {
  manana: "text-state-info",
  tarde: "text-state-atencion",
};

function empName(emp: Employee | undefined, fallbackId: string): string {
  if (!emp) return fallbackId.slice(0, 8) + "…";
  return [emp.nombre, emp.apellidos].filter(Boolean).join(" ");
}

const TV_VISUAL_ZONES = [
  { key: "recria", name: "Recria", codes: ["boxes_terneros", "zona_recria", "recria", "becerrero"] },
  { key: "nave", name: "Nave", codes: ["patio_alimentacion", "enfermeria", "maquinaria", "robots", "sala_ordeno", "silos", "almacen", "oficina", "general"] },
];

function displayZoneName(zone?: Pick<Zone, "codigo" | "nombre">) {
  if (!zone) return null;
  if (["boxes_terneros", "becerrero"].includes(zone.codigo)) return "Boxes de terneros";
  if (["zona_recria", "recria"].includes(zone.codigo)) return "Zona de recria";
  if (["patio_alimentacion", "silos", "almacen"].includes(zone.codigo)) return "Patio de alimentacion";
  if (zone.codigo === "enfermeria") return "Enfermeria";
  if (["maquinaria", "robots", "sala_ordeno", "oficina", "general"].includes(zone.codigo)) return "Maquinaria";
  return zone.nombre;
}

// ── Shift card ────────────────────────────────────────────────────────────────

function ShiftCard({
  shift,
  assignments,
  zones,
  employeeById,
  isCurrent,
}: {
  shift: {
    id: string;
    fecha?: string | null;
    tipo_turno: ShiftType;
    hora_inicio?: string | null;
    hora_fin?: string | null;
    notas?: string | null;
  };
  assignments: ShiftAssignment[];
  zones: Pick<Zone, "id" | "nombre" | "codigo">[];
  employeeById: Map<string, Employee>;
  isCurrent: boolean;
}) {
  const colorClass = shiftTypeStyle[shift.tipo_turno];

  const zoneLookup = useMemo(() => {
    const map = new Map<string, string>();
    for (const z of zones) map.set(z.id, displayZoneName(z) ?? z.nombre);
    return map;
  }, [zones]);

  return (
    <div className={`rounded-2xl border px-6 py-5 ${
      isCurrent
        ? "border-tv-accent/40 bg-tv-accent/5"
        : "border-tv-border bg-tv-surface"
    }`}>
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          {isCurrent && (
            <div className="mb-1 flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-tv-accent" />
              <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-tv-accent">
                Turno actual
              </span>
            </div>
          )}
          <div className={`font-heading text-3xl font-bold ${colorClass}`}>
            {shiftTypeLabel[shift.tipo_turno]}
          </div>
          <div className="mt-1 font-mono text-lg text-tv-text">
            {shift.hora_inicio?.slice(0, 5)} – {shift.hora_fin?.slice(0, 5)}
          </div>
        </div>
        <CalendarClock className={`h-10 w-10 opacity-30 ${colorClass}`} />
      </div>

      {assignments.length === 0 ? (
        <p className="text-sm text-tv-dim">Sin empleados asignados</p>
      ) : (
        <div className="space-y-2">
          {assignments.map((a) => {
            const emp = employeeById.get(a.empleado_id);
            const zoneName = a.zona_id ? zoneLookup.get(a.zona_id) : null;
            return (
              <div
                key={a.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-tv-surface2 px-4 py-2.5"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <UserRound className="h-4 w-4 shrink-0 text-tv-dim" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-tv-text">
                      {empName(emp, a.empleado_id)}
                    </p>
                    {emp?.role && (
                      <p className="text-[11px] capitalize text-tv-dim">{emp.role}</p>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-xs text-tv-dim">
                  {zoneName && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {zoneName}
                    </span>
                  )}
                  {a.rol && (
                    <span className="rounded bg-tv-surface px-1.5 py-0.5 font-mono text-[10px]">
                      {a.rol}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {shift.notas && (
        <p className="mt-3 text-xs text-tv-dim">{shift.notas}</p>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TvShiftsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const currentHour = new Date().getHours();

  const shiftsQ = useQuery({
    queryKey: ["tv-shifts-board"],
    queryFn: () => api.shifts({ fecha: today, limit: 10 }),
    refetchInterval: TV_REFETCH.SLOW,
    staleTime: TV_STALE.SLOW,
  });

  const assignmentsQ = useQuery({
    queryKey: ["tv-shift-assignments-board"],
    queryFn: () => api.shiftAssignments({ limit: 50 }),
    refetchInterval: TV_REFETCH.SLOW,
    staleTime: TV_STALE.SLOW,
  });

  const zonesQ = useQuery({
    queryKey: ["zones"],
    queryFn: api.zones,
    staleTime: TV_STALE.CATALOG,
  });

  const tasksQ = useQuery({
    queryKey: ["tv-tasks-board"],
    queryFn: () => api.tasks({ limit: 50 }),
    refetchInterval: TV_REFETCH.NORMAL,
    staleTime: TV_STALE.NORMAL,
  });

  const incidentsQ = useQuery({
    queryKey: ["tv-incidents-board"],
    queryFn: () => api.incidents({ limit: 20 }),
    refetchInterval: TV_REFETCH.NORMAL,
    staleTime: TV_STALE.NORMAL,
  });

  const employeesQ = useQuery({
    queryKey: ["employees-lookup"],
    queryFn: () => api.employees(),
    staleTime: TV_STALE.CATALOG,
    refetchInterval: TV_REFETCH.CATALOG,
  });

  const allQueryStatuses = [shiftsQ, assignmentsQ, tasksQ, incidentsQ].map((q) => ({
    isLoading: q.isLoading,
    isFetching: q.isFetching,
    isError: q.isError,
    dataUpdatedAt: q.dataUpdatedAt,
  }));

  // Employee lookup map
  const employeeById = useMemo(() => {
    const map = new Map<string, Employee>();
    for (const e of employeesQ.data ?? []) map.set(e.id, e);
    return map;
  }, [employeesQ.data]);

  const shifts = shiftsQ.data?.turnos ?? [];
  const assignments = assignmentsQ.data?.asignaciones ?? [];
  const zones = zonesQ.data ?? [];
  const allTasks = tasksQ.data ?? [];
  const allIncidents = incidentsQ.data ?? [];

  // Identify current shift
  const currentShift = shifts.find((s) => {
    const start = parseInt(s.hora_inicio?.slice(0, 2) ?? "0");
    const end = parseInt(s.hora_fin?.slice(0, 2) ?? "24");
    return currentHour >= start && currentHour < end;
  });

  const pendingTasks = allTasks.filter((t) => t.estado === "programada" || t.estado === "retrasada");
  const delayedTasks = allTasks.filter((t) => t.estado === "retrasada");
  const openIncidents = allIncidents.filter((i: { estado: string }) => i.estado === "abierta" || i.estado === "en_gestion");
  const criticalIncidents = openIncidents.filter((i: { prioridad: string }) => i.prioridad === "critica" || i.prioridad === "alta");

  // Zone coverage check
  const coveredZoneIds = new Set(
    assignments
      .filter((a) => currentShift && a.turno_id === currentShift.id && a.zona_id)
      .map((a) => a.zona_id!),
  );
  const uncoveredZones = TV_VISUAL_ZONES.filter((visualZone) => {
    const codeSet = new Set(visualZone.codes);
    const ids = zones.filter((z) => codeSet.has(z.codigo)).map((z) => z.id);
    return ids.length > 0 && !ids.some((id) => coveredZoneIds.has(id));
  });

  return (
    <TvShell
      title="Tools4 Milk — Tablero de Turnos"
      subtitle={`${today} · ${shifts.length} turnos registrados hoy`}
      queryStatuses={allQueryStatuses}
      backHref="/shifts"
      backLabel="Gestión turnos"
    >
      <div className="flex flex-col gap-5">
        {/* ── Today's shifts ── */}
        {shiftsQ.isError ? (
          <div className="rounded-2xl border border-state-critica/30 bg-state-critica/5 py-10 text-center">
            <p className="text-sm font-semibold text-state-critica">Error al cargar turnos</p>
          </div>
        ) : shifts.length === 0 ? (
          <div className="rounded-2xl border border-tv-border bg-tv-surface py-12 text-center">
            <CalendarClock className="mx-auto h-12 w-12 text-tv-dim" strokeWidth={1.5} />
            <p className="mt-3 font-heading text-xl font-bold text-tv-text">Sin turnos registrados hoy</p>
            <p className="mt-1 text-sm text-tv-dim">Accede a Gestión → Turnos para crearlos</p>
          </div>
        ) : (
          <div className="grid gap-5 xl:grid-cols-2">
            {shifts.map((shift) => (
              <ShiftCard
                key={shift.id}
                shift={shift}
                assignments={assignments.filter((a) => a.turno_id === shift.id)}
                zones={zones}
                employeeById={employeeById}
                isCurrent={shift.id === currentShift?.id}
              />
            ))}
          </div>
        )}

        {/* ── Zone coverage warning ── */}
        {uncoveredZones.length > 0 && (
          <div className="rounded-2xl border border-state-atencion/30 bg-state-atencion/5 px-5 py-4">
            <div className="flex items-center gap-2">
              <AlertOctagon className="h-4 w-4 text-state-atencion" />
              <span className="text-xs font-extrabold uppercase tracking-[0.16em] text-state-atencion">
                Zonas sin cobertura en turno actual
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {uncoveredZones.map((z) => (
                <span
                  key={z.key}
                  className="rounded-full bg-state-atencion/10 px-3 py-1 text-sm font-semibold text-state-atencion"
                >
                  {z.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Operational panels ── */}
        <div className="grid gap-5 xl:grid-cols-3">
          <TvPanel
            Icon={ClipboardList}
            iconTone={delayedTasks.length > 0 ? "text-state-critica" : "text-tv-accent"}
            title="Tareas pendientes"
            count={pendingTasks.length}
            className="min-h-[260px]"
          >
            {tasksQ.isError ? (
              <TvEmptyRow text="Error al cargar tareas" />
            ) : pendingTasks.length === 0 ? (
              <TvEmptyRow text="Sin tareas pendientes ✓" />
            ) : (
              <div className="space-y-2">
                {pendingTasks.slice(0, 7).map((task) => (
                  <div
                    key={task.id}
                    className={`flex items-start gap-3 rounded-xl border border-tv-border bg-tv-surface2 px-4 py-2.5 ${
                      task.estado === "retrasada" ? "border-l-4 border-l-state-critica" : ""
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-tv-text">
                        {task.tarea_catalogo?.nombre ?? "Tarea"}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-tv-dim">
                        {task.estado === "retrasada" && (
                          <span className="font-bold text-state-critica">RETRASADA</span>
                        )}
                        <span>
                          {new Date(task.fecha_programada).toLocaleString("es-ES", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                    {task.estado === "ejecutada" && (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-state-ok" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </TvPanel>

          <TvPanel
            Icon={AlertOctagon}
            iconTone="text-state-atencion"
            title="Incidencias de relevo"
            count={openIncidents.length}
            className="min-h-[260px]"
          >
            {incidentsQ.isError ? (
              <TvEmptyRow text="Error al cargar incidencias" />
            ) : openIncidents.length === 0 ? (
              <TvEmptyRow text="Sin incidencias pendientes ✓" />
            ) : (
              <div className="space-y-2">
                {openIncidents.slice(0, 6).map((inc: { id: string; tipo: string; descripcion: string; prioridad: string }) => (
                  <div key={inc.id} className="rounded-xl border border-tv-border bg-tv-surface2 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                        inc.prioridad === "critica"
                          ? "bg-state-critica/15 text-state-critica"
                          : "bg-state-atencion/15 text-state-atencion"
                      }`}>
                        {inc.prioridad}
                      </span>
                      <span className="text-xs capitalize text-tv-dim">
                        {inc.tipo.replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-tv-text">{inc.descripcion}</p>
                  </div>
                ))}
              </div>
            )}
          </TvPanel>

          <TvPanel
            Icon={AlertTriangle}
            iconTone="text-state-critica"
            title="Incidencias criticas"
            count={criticalIncidents.length}
            className="min-h-[260px]"
          >
            {incidentsQ.isError ? (
              <TvEmptyRow text="Error al cargar incidencias" />
            ) : criticalIncidents.length === 0 ? (
              <TvEmptyRow text="Sin incidencias criticas" />
            ) : (
              <div className="space-y-2">
                {criticalIncidents.slice(0, 6).map((inc: { id: string; tipo: string; descripcion: string; prioridad: string }) => (
                  <div
                    key={inc.id}
                    className="rounded-xl border border-l-4 border-tv-border border-l-state-critica bg-tv-surface2 px-4 py-3"
                  >
                    <p className="text-xs capitalize text-tv-dim">{inc.tipo.replace(/_/g, " ")}</p>
                    <p className="mt-0.5 text-sm font-semibold text-tv-text">{inc.descripcion}</p>
                  </div>
                ))}
              </div>
            )}
          </TvPanel>
        </div>
      </div>
    </TvShell>
  );
}
