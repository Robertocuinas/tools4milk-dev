"use client";

import { useQueries } from "@tanstack/react-query";
import {
  AlertOctagon,
  AlertTriangle,
  Beef,
  ClipboardList,
  CloudSun,
  Droplets,
  Monitor,
  Pill,
  Tablet,
  UserRound,
} from "lucide-react";
import { useMemo } from "react";
import { TvKpiCard } from "@/components/tv/TvKpiCard";
import { TvPanel, TvEmptyRow } from "@/components/tv/TvPanel";
import { TvShell } from "@/components/tv/TvShell";
import { api } from "@/lib/api";
import { TV_REFETCH, TV_STALE } from "@/lib/tv-constants";
import type { Employee, Incident, ShiftAssignment, Task, Zone } from "@/lib/types";

// ── Zone status helpers ─────────────────────────────────────────────────────

type ZoneStatus = "critica" | "atencion" | "operativa" | "sin_datos" | "inactiva";

const TV_VISUAL_ZONES = [
  { key: "recria", name: "Recria", codes: ["boxes_terneros", "zona_recria", "recria", "becerrero"] },
  { key: "nave", name: "Nave", codes: ["patio_alimentacion", "enfermeria", "maquinaria", "robots", "sala_ordeno", "silos", "almacen", "oficina", "general"] },
];

function idsForCodes(zones: Zone[], codes: string[]) {
  const wanted = new Set(codes);
  return new Set(zones.filter((z) => wanted.has(z.codigo)).map((z) => z.id));
}

function getZoneStatus(
  zone: Zone,
  tasks: Task[],
  incidents: Incident[],
  currentShiftAssignments: ShiftAssignment[],
): ZoneStatus {
  // Explicitly inactive zones
  if (zone.activa === false) return "inactiva";

  const zoneTasks = tasks.filter((t) => t.zona_id === zone.id);
  const zoneIncidents = incidents.filter(
    (i) => i.zona_id === zone.id && (i.estado === "abierta" || i.estado === "en_gestion"),
  );
  const isAssigned = currentShiftAssignments.some((a) => a.zona_id === zone.id);

  // Critical: urgent delays OR critical/high incidents
  const hasUrgentDelay = zoneTasks.some((t) => t.estado === "retrasada" && t.es_urgente);
  const hasCriticalIncident = zoneIncidents.some((i) => i.prioridad === "critica");
  if (hasUrgentDelay || hasCriticalIncident) return "critica";

  // Warning: any delay OR high-priority incident OR open incidents
  const hasDelay = zoneTasks.some((t) => t.estado === "retrasada");
  const hasHighIncident = zoneIncidents.some((i) => i.prioridad === "alta");
  if (hasDelay || hasHighIncident || zoneIncidents.length > 1) return "atencion";

  // Operational: pending tasks OR worker assigned OR minor incidents
  const hasPending = zoneTasks.some((t) => t.estado === "programada");
  if (hasPending || isAssigned || zoneIncidents.length > 0) return "operativa";

  // No meaningful data for this zone
  return "sin_datos";
}

const zoneStatusStyles: Record<ZoneStatus, { ring: string; dot: string; label: string; text: string }> = {
  critica:   { ring: "border-state-critica/50 bg-state-critica/10",   dot: "bg-state-critica",   label: "CRÍTICA",   text: "text-state-critica" },
  atencion:  { ring: "border-state-atencion/50 bg-state-atencion/10", dot: "bg-state-atencion",  label: "ATENCIÓN",  text: "text-state-atencion" },
  operativa: { ring: "border-tv-accent/30 bg-tv-accent/5",             dot: "bg-tv-accent",       label: "OPERATIVA", text: "text-tv-accent" },
  sin_datos: { ring: "border-tv-border bg-tv-surface",                 dot: "bg-tv-dim",          label: "SIN DATOS", text: "text-tv-dim" },
  inactiva:  { ring: "border-tv-border/30 bg-tv-bg",                   dot: "bg-tv-dim/40",       label: "INACTIVA",  text: "text-tv-dim opacity-60" },
};

// ── Employee helper ──────────────────────────────────────────────────────────

function employeeName(e: Employee | undefined, fallbackId: string): string {
  if (!e) return fallbackId.slice(0, 8) + "…";
  return [e.nombre, e.apellidos].filter(Boolean).join(" ");
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function TvGlobalPage() {
  const [
    summaryQ,
    incidentsQ,
    tasksQ,
    zonesQ,
    weatherQ,
    shiftsQ,
    assignmentsQ,
    qualityQ,
    employeesQ,
  ] = useQueries({
    queries: [
      {
        queryKey: ["tv-dashboard-summary"],
        queryFn: api.dashboardSummary,
        refetchInterval: TV_REFETCH.NORMAL,
        staleTime: TV_STALE.NORMAL,
      },
      {
        queryKey: ["tv-incidents"],
        queryFn: () => api.incidents({ limit: 100 }),
        refetchInterval: TV_REFETCH.NORMAL,
        staleTime: TV_STALE.NORMAL,
      },
      {
        queryKey: ["tv-tasks"],
        queryFn: () => api.tasks({ limit: 100 }),
        refetchInterval: TV_REFETCH.NORMAL,
        staleTime: TV_STALE.NORMAL,
      },
      {
        queryKey: ["zones"],
        queryFn: api.zones,
        staleTime: TV_STALE.CATALOG,
      },
      {
        queryKey: ["weather-current"],
        queryFn: api.weather,
        refetchInterval: TV_REFETCH.VERY_SLOW,
        staleTime: TV_STALE.VERY_SLOW,
      },
      {
        queryKey: ["tv-shifts"],
        queryFn: () => api.shifts({ limit: 4 }),
        refetchInterval: TV_REFETCH.SLOW,
        staleTime: TV_STALE.SLOW,
      },
      {
        queryKey: ["tv-shift-assignments"],
        queryFn: () => api.shiftAssignments({ limit: 50 }),
        refetchInterval: TV_REFETCH.SLOW,
        staleTime: TV_STALE.SLOW,
      },
      {
        queryKey: ["quality-summary"],
        queryFn: api.qualitySummary,
        refetchInterval: TV_REFETCH.VERY_SLOW,
        staleTime: TV_STALE.VERY_SLOW,
      },
      {
        queryKey: ["employees-lookup"],
        queryFn: () => api.employees(),
        staleTime: TV_STALE.CATALOG,
        refetchInterval: TV_REFETCH.CATALOG,
      },
    ],
  });

  // All queries for the refresh status indicator
  const allQueryStatuses = [
    summaryQ, incidentsQ, tasksQ, zonesQ, weatherQ, shiftsQ, assignmentsQ, qualityQ,
  ].map((q) => ({
    isLoading: q.isLoading,
    isFetching: q.isFetching,
    isError: q.isError,
    dataUpdatedAt: q.dataUpdatedAt,
  }));

  const summary = summaryQ.data;
  const allIncidents = incidentsQ.data ?? [];
  const allTasks = tasksQ.data ?? [];
  const zones = zonesQ.data ?? [];
  const weather = weatherQ.data;
  const shifts = shiftsQ.data?.turnos ?? [];
  const assignments = assignmentsQ.data?.asignaciones ?? [];
  const quality = qualityQ.data;

  // Employee lookup
  const employeeById = useMemo(() => {
    const map = new Map<string, Employee>();
    for (const e of employeesQ.data ?? []) map.set(e.id, e);
    return map;
  }, [employeesQ.data]);

  // Derived data
  const delayedTasks = allTasks.filter((t) => t.estado === "retrasada");
  const openIncidents = (allIncidents as Incident[]).filter(
    (i) => i.estado === "abierta" || i.estado === "en_gestion",
  );
  const taskTotal = (summary?.tareas.programadas ?? 0) + (summary?.tareas.retrasadas ?? 0);

  // Priority task list: delayed first, then urgent
  const priorityTasks = [
    ...delayedTasks.slice(0, 4),
    ...allTasks
      .filter((t) => t.es_urgente && t.estado === "programada")
      .slice(0, Math.max(0, 6 - delayedTasks.length)),
  ].slice(0, 6);

  // Current shift
  const todayStr = new Date().toISOString().slice(0, 10);
  const currentHour = new Date().getHours();
  const todayShifts = shifts.filter((s) => s.fecha === todayStr);
  const currentShift = todayShifts.find((s) => {
    const start = parseInt(s.hora_inicio?.slice(0, 2) ?? "0");
    const end = parseInt(s.hora_fin?.slice(0, 2) ?? "24");
    return currentHour >= start && currentHour < end;
  }) ?? todayShifts[0];
  const currentAssignments = currentShift
    ? assignments.filter((a) => a.turno_id === currentShift.id)
    : [];

  return (
    <TvShell
      title="Tools4 Milk — Estado Operativo"
      subtitle="Centro de control global de la explotación"
      queryStatuses={allQueryStatuses}
      backHref="/dashboard"
      backLabel="Gestión"
    >
      <div className="flex flex-col gap-5">
        {/* ── KPI row ── */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
          <TvKpiCard
            Icon={AlertTriangle}
            label="Incidencias criticas"
            value={openIncidents.filter((i) => i.prioridad === "critica" || i.prioridad === "alta").length}
            sublabel="Alertas integradas como incidencias"
            tone={openIncidents.some((i) => i.prioridad === "critica" || i.prioridad === "alta") ? "critical" : "ok"}
          />
          <TvKpiCard
            Icon={AlertOctagon}
            label="Incidencias"
            value={openIncidents.length}
            sublabel="Abiertas / en gestión"
            tone={openIncidents.length > 2 ? "warning" : openIncidents.length > 0 ? "info" : "ok"}
          />
          <TvKpiCard
            Icon={ClipboardList}
            label="Tareas pendientes"
            value={taskTotal}
            sublabel={`${delayedTasks.length} retrasadas`}
            tone={delayedTasks.length > 3 ? "critical" : delayedTasks.length > 0 ? "warning" : "ok"}
          />
          <TvKpiCard
            Icon={Beef}
            label="Animales activos"
            value={summary?.animales.activos ?? "—"}
            tone="neutral"
          />
          <TvKpiCard
            Icon={Pill}
            label="Tratamientos"
            value={summary?.tratamientos.activos ?? "—"}
            sublabel="activos"
            tone={(summary?.tratamientos.activos ?? 0) > 15 ? "critical" : "info"}
          />
          <TvKpiCard
            Icon={Droplets}
            label="Producción"
            value={quality?.produccion_promedio != null ? `${quality.produccion_promedio.toFixed(1)} L` : "—"}
            sublabel={
              weather?.temperatura_actual != null
                ? `${weather.temperatura_actual.toFixed(0)}°C · ${weather.descripcion ?? ""}`
                : "Sin datos clima"
            }
            tone={weatherQ.isError ? "warning" : "accent"}
          />
        </div>

        {/* ── Zone grid — richer panel ── */}
        <div className="rounded-2xl border border-tv-border bg-tv-surface p-5">
          <div className="mb-3 flex items-center gap-2">
            <CloudSun className="h-4 w-4 text-tv-dim" />
            <span className="text-xs font-extrabold uppercase tracking-[0.18em] text-tv-dim">
              Estado de zonas
            </span>
          </div>
          <div className="flex flex-wrap gap-3">
            {TV_VISUAL_ZONES.map((visualZone) => {
              const zoneIds = idsForCodes(zones, visualZone.codes);
              const representative = zones.find((z) => zoneIds.has(z.id)) ?? {
                id: visualZone.key,
                nombre: visualZone.name,
                codigo: visualZone.key,
                tiene_pantalla_tv: true,
                tiene_tablet: true,
                activa: true,
              };
              const groupedTasks = allTasks.filter((t) => t.zona_id && zoneIds.has(t.zona_id));
              const groupedIncidents = (allIncidents as Incident[]).filter((i) => i.zona_id && zoneIds.has(i.zona_id));
              const groupedAssignments = currentAssignments.filter((a) => a.zona_id && zoneIds.has(a.zona_id));
              const status = getZoneStatus(representative, groupedTasks, groupedIncidents, groupedAssignments);
              const s = zoneStatusStyles[status];
              const zoneTasks = groupedTasks.filter((t) => t.estado !== "ejecutada");
              const zoneInc = groupedIncidents.filter((i) => i.estado === "abierta" || i.estado === "en_gestion");
              const zoneWorkers = groupedAssignments;

              return (
                <div
                  key={visualZone.key}
                  className={`flex min-w-[160px] flex-col gap-1.5 rounded-xl border px-4 py-3 ${s.ring}`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${s.dot}`} />
                    <span className="font-heading text-sm font-bold text-tv-text">{visualZone.name}</span>
                  </div>
                  <span className={`text-[10px] font-extrabold uppercase ${s.text}`}>{s.label}</span>
                  <div className="flex flex-wrap gap-2 text-[10px] text-tv-dim">
                    {zoneTasks.length > 0 && (
                      <span className="flex items-center gap-1">
                        <ClipboardList className="h-3 w-3" />
                        {zoneTasks.length} tareas
                      </span>
                    )}
                    {zoneInc.length > 0 && (
                      <span className="flex items-center gap-1 text-state-atencion">
                        <AlertOctagon className="h-3 w-3" />
                        {zoneInc.length} incid.
                      </span>
                    )}
                    {zoneWorkers.length > 0 && (
                      <span className="flex items-center gap-1">
                        <UserRound className="h-3 w-3" />
                        {zoneWorkers.length}
                      </span>
                    )}
                    <Monitor className="h-3 w-3" />
                    <Tablet className="h-3 w-3" />
                  </div>
                </div>
              );
            })}
            {zones.length === 0 && !zonesQ.isLoading && (
              <p className="text-sm text-tv-dim">Sin zonas configuradas</p>
            )}
          </div>
        </div>

        {/* ── Main panels ── */}
        <div className="grid flex-1 gap-5 xl:grid-cols-3">
          {/* Critical incidents: alerts are integrated as incidents */}
          <TvPanel
            Icon={AlertTriangle}
            iconTone="text-state-critica"
            title="Incidencias criticas"
            count={openIncidents.filter((i) => i.prioridad === "critica" || i.prioridad === "alta").length}
            className="min-h-[280px]"
          >
            {incidentsQ.isError ? (
              <TvEmptyRow text="Error al cargar incidencias" />
            ) : openIncidents.filter((i) => i.prioridad === "critica" || i.prioridad === "alta").length === 0 ? (
              <TvEmptyRow text="Sin incidencias criticas" />
            ) : (
              <div className="space-y-2">
                {openIncidents.filter((i) => i.prioridad === "critica" || i.prioridad === "alta").slice(0, 6).map((inc) => (
                  <div
                    key={inc.id}
                    className="rounded-xl border border-l-4 border-tv-border border-l-state-critica bg-tv-surface2 px-4 py-3"
                  >
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-state-critica/15 px-2 py-0.5 text-[10px] font-extrabold uppercase text-state-critica">
                        {inc.prioridad}
                      </span>
                      <span className="text-xs capitalize text-tv-dim">{inc.tipo.replace(/_/g, " ")}</span>
                    </div>
                    <p className="mt-1 text-sm font-semibold leading-snug text-tv-text">
                      {inc.descripcion}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </TvPanel>

          {/* Open incidents */}
          <TvPanel
            Icon={AlertOctagon}
            iconTone="text-state-atencion"
            title="Incidencias abiertas"
            count={openIncidents.length}
            className="min-h-[280px]"
          >
            {incidentsQ.isError ? (
              <TvEmptyRow text="Error al cargar incidencias" />
            ) : openIncidents.length === 0 ? (
              <TvEmptyRow text="Sin incidencias abiertas ✓" />
            ) : (
              <div className="space-y-2">
                {openIncidents.slice(0, 6).map((inc) => (
                  <div key={inc.id} className="rounded-xl border border-tv-border bg-tv-surface2 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                        inc.prioridad === "critica" ? "bg-state-critica/15 text-state-critica"
                        : inc.prioridad === "alta" ? "bg-state-atencion/15 text-state-atencion"
                        : "bg-state-info/15 text-state-info"
                      }`}>
                        {inc.prioridad}
                      </span>
                      <span className="text-xs capitalize text-tv-dim">{inc.tipo.replace(/_/g, " ")}</span>
                    </div>
                    <p className="mt-1 text-sm font-semibold leading-snug text-tv-text">{inc.descripcion}</p>
                  </div>
                ))}
              </div>
            )}
          </TvPanel>

          {/* Urgent/delayed tasks */}
          <TvPanel
            Icon={ClipboardList}
            iconTone={delayedTasks.length > 0 ? "text-state-critica" : "text-tv-accent"}
            title="Tareas urgentes / retrasadas"
            count={priorityTasks.length}
            className="min-h-[280px]"
          >
            {tasksQ.isError ? (
              <TvEmptyRow text="Error al cargar tareas" />
            ) : priorityTasks.length === 0 ? (
              <TvEmptyRow text="Sin tareas urgentes ✓" />
            ) : (
              <div className="space-y-2">
                {priorityTasks.map((task) => (
                  <div
                    key={task.id}
                    className={`rounded-xl border border-tv-border bg-tv-surface2 px-4 py-3 ${
                      task.estado === "retrasada" ? "border-l-4 border-l-state-critica" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {task.estado === "retrasada" && (
                        <span className="rounded-full bg-state-critica/15 px-2 py-0.5 text-[10px] font-extrabold uppercase text-state-critica">
                          RETRASADA
                        </span>
                      )}
                      {task.es_urgente && task.estado !== "retrasada" && (
                        <span className="rounded-full bg-state-atencion/15 px-2 py-0.5 text-[10px] font-extrabold uppercase text-state-atencion">
                          URGENTE
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm font-semibold text-tv-text">
                      {task.tarea_catalogo?.nombre ?? "Tarea"}
                    </p>
                    <p className="text-xs text-tv-dim">
                      {new Date(task.fecha_programada).toLocaleString("es-ES", {
                        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </TvPanel>
        </div>

        {/* ── Current shift with real employee names ── */}
        {currentShift && (
          <div className="rounded-2xl border border-tv-border bg-tv-surface px-6 py-4">
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-3">
                <UserRound className="h-5 w-5 text-tv-accent" />
                <div>
                  <div className="text-xs font-extrabold uppercase tracking-[0.14em] text-tv-dim">Turno actual</div>
                  <div className="font-heading text-base font-bold text-tv-text">
                    {currentShift.tipo_turno === "manana" ? "Mañana" : "Tarde"} ·{" "}
                    {currentShift.hora_inicio?.slice(0, 5)} – {currentShift.hora_fin?.slice(0, 5)}
                  </div>
                </div>
              </div>
              {currentAssignments.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {currentAssignments.map((a) => {
                    const emp = employeeById.get(a.empleado_id);
                    return (
                      <div key={a.id} className="rounded-xl bg-tv-surface2 px-3 py-2">
                        <span className="text-sm font-semibold text-tv-text">
                          {employeeName(emp, a.empleado_id)}
                        </span>
                        {emp?.role && (
                          <span className="ml-1.5 text-xs capitalize text-tv-dim">{emp.role}</span>
                        )}
                        {a.rol && (
                          <span className="ml-1.5 rounded bg-tv-surface px-1.5 py-0.5 font-mono text-[10px] text-tv-dim">
                            {a.rol}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <span className="text-sm text-tv-dim">Sin asignaciones en este turno</span>
              )}
            </div>
          </div>
        )}
      </div>
    </TvShell>
  );
}
