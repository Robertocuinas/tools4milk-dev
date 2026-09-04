"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronRight,
  Clock,
  Edit2,
  Plus,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { useState, useMemo } from "react";
import { api } from "@/lib/api";
import type { Task, TaskStatus, Zone, Employee, TaskCatalogItem } from "@/lib/types";

// ── Helpers ────────────────────────────────────────────────────────────────

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function getShiftForTime(iso?: string | null): "manana" | "tarde" | "otro" {
  if (!iso) return "otro";
  const h = new Date(iso).getHours();
  if (h >= 6 && h < 14) return "manana";
  if (h >= 14) return "tarde";
  return "manana";
}

const SHIFT_LABELS = { manana: "Mañana 06:00–14:00", tarde: "Tarde 16:00–00:00", otro: "Otro" };
const SHIFT_COLORS = {
  manana: "bg-state-info/10 text-state-info border-state-info/20",
  tarde: "bg-state-atencion/10 text-state-atencion border-state-atencion/20",
  otro: "bg-app-bg text-app-dim border-app-border",
};

const STATE_COLORS: Record<string, string> = {
  programada: "bg-app-bg text-app-dim",
  retrasada: "bg-state-critica/10 text-state-critica",
  pausada: "bg-state-atencion/10 text-state-atencion",
  ejecutada: "bg-state-ok/10 text-state-ok",
  cancelada: "bg-app-bg/60 text-app-dim line-through",
};

const STATE_LABELS: Record<string, string> = {
  programada: "Pendiente",
  retrasada: "Retrasada",
  pausada: "En curso",
  ejecutada: "Finalizada",
  cancelada: "Cancelada",
};

// ── Task form modal ────────────────────────────────────────────────────────

function TaskFormModal({
  task,
  date,
  defaultShift,
  zones,
  employees,
  catalog,
  onClose,
}: {
  task?: Task;
  date: string;
  defaultShift: "manana" | "tarde";
  zones: Zone[];
  employees: Employee[];
  catalog: TaskCatalogItem[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!task;

  const shiftHour = defaultShift === "manana" ? "T07:00:00" : "T17:00:00";
  const [zonaId, setZonaId] = useState(task?.zona_id ?? zones[0]?.id ?? "");
  const [catalogId, setCatalogId] = useState(task?.tarea_catalogo_id ?? "");
  const [empleadoId, setEmpleadoId] = useState(task?.empleado_id ?? "");
  const [fechaHora, setFechaHora] = useState(
    task?.fecha_programada ? task.fecha_programada.slice(0, 16) : `${date}${shiftHour.slice(0, 6)}`
  );
  const [observaciones, setObservaciones] = useState(task?.observaciones ?? "");
  const [estado, setEstado] = useState<TaskStatus>(task?.estado ?? "programada");

  const mutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      if (isEdit) {
        return api.updateTask(task!.id, payload as Partial<Task>);
      } else {
        return api.createTask(payload as Partial<Task>);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks-all-lean"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      onClose();
    },
  });

  const selectedCatalog = catalog.find((c) => c.id === catalogId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-[14px] border border-app-border bg-white shadow-panel">
        <div className="flex items-center justify-between border-b border-app-border px-5 py-4">
          <h3 className="font-heading text-base font-bold text-app-text">
            {isEdit ? "Editar tarea" : "Nueva tarea"}
          </h3>
          <button type="button" onClick={onClose} className="text-app-dim hover:text-app-text">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
          {/* Catalog */}
          <label className="block">
            <span className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.12em] text-app-dim">
              Tipo de tarea *
            </span>
            <select
              value={catalogId}
              onChange={(e) => setCatalogId(e.target.value)}
              className="h-10 w-full rounded-[10px] border border-app-border bg-white px-3 text-sm text-app-text outline-none focus:border-brand"
            >
              <option value="">Seleccionar tipo</option>
              {catalog.filter((c) => c.activa).map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </label>

          {selectedCatalog?.duracion_estimada_min && (
            <p className="flex items-center gap-1 text-xs text-app-dim">
              <Clock className="h-3.5 w-3.5" />
              Duración estimada: {selectedCatalog.duracion_estimada_min} min
            </p>
          )}

          {/* Zone */}
          <label className="block">
            <span className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.12em] text-app-dim">Zona</span>
            <select
              value={zonaId}
              onChange={(e) => setZonaId(e.target.value)}
              className="h-10 w-full rounded-[10px] border border-app-border bg-white px-3 text-sm text-app-text outline-none focus:border-brand"
            >
              <option value="">Sin zona</option>
              {zones.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}
            </select>
          </label>

          {/* Employee */}
          <label className="block">
            <span className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.12em] text-app-dim">
              Trabajador asignado
            </span>
            <select
              value={empleadoId}
              onChange={(e) => setEmpleadoId(e.target.value)}
              className="h-10 w-full rounded-[10px] border border-app-border bg-white px-3 text-sm text-app-text outline-none focus:border-brand"
            >
              <option value="">Sin asignar</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.nombre} {e.apellidos ?? ""}</option>
              ))}
            </select>
          </label>

          {/* Date/time */}
          <label className="block">
            <span className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.12em] text-app-dim">
              Fecha y hora programada
            </span>
            <input
              type="datetime-local"
              value={fechaHora}
              onChange={(e) => setFechaHora(e.target.value)}
              className="h-10 w-full rounded-[10px] border border-app-border bg-white px-3 text-sm text-app-text outline-none focus:border-brand"
            />
          </label>

          {/* Estado (only for edit) */}
          {isEdit && (
            <label className="block">
              <span className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.12em] text-app-dim">Estado</span>
              <select
                value={estado}
                onChange={(e) => setEstado(e.target.value as TaskStatus)}
                className="h-10 w-full rounded-[10px] border border-app-border bg-white px-3 text-sm text-app-text outline-none focus:border-brand"
              >
                {Object.entries(STATE_LABELS).filter(([k]) => k !== "cancelada").map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </label>
          )}

          {/* Notes */}
          <label className="block">
            <span className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.12em] text-app-dim">Observaciones</span>
            <textarea
              rows={2}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              className="w-full resize-none rounded-[10px] border border-app-border bg-white px-3 py-2 text-sm text-app-text outline-none focus:border-brand"
            />
          </label>

          {mutation.isError && (
            <p className="rounded-[10px] bg-state-critica/10 px-3 py-2 text-xs text-state-critica">
              Error al guardar la tarea
            </p>
          )}

          <button
            type="button"
            disabled={mutation.isPending}
            onClick={() =>
              mutation.mutate({
                tarea_catalogo_id: catalogId || undefined,
                zona_id: zonaId || undefined,
                empleado_id: empleadoId || undefined,
                fecha_programada: fechaHora ? new Date(fechaHora).toISOString() : undefined,
                estado: isEdit ? estado : "programada",
                observaciones: observaciones.trim() || undefined,
              })
            }
            className="w-full rounded-[10px] bg-brand py-3 font-heading text-sm font-bold text-white shadow-brand transition hover:bg-[#135532] disabled:opacity-50"
          >
            {mutation.isPending ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear tarea"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Task row ───────────────────────────────────────────────────────────────

function TaskRow({
  task,
  employees,
  zones,
  catalog,
  date,
  shift,
}: {
  task: Task;
  employees: Employee[];
  zones: Zone[];
  catalog: TaskCatalogItem[];
  date: string;
  shift: "manana" | "tarde";
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteTask(task.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks-all-lean"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const emp = employees.find((e) => e.id === task.empleado_id);
  const nombre = task.tarea_catalogo?.nombre ?? "Tarea";
  const stateStyle = STATE_COLORS[task.estado] ?? STATE_COLORS.programada;
  const stateLabel = STATE_LABELS[task.estado] ?? task.estado;

  return (
    <>
      {editing && (
        <TaskFormModal
          task={task}
          date={date}
          defaultShift={shift}
          zones={zones}
          employees={employees}
          catalog={catalog}
          onClose={() => setEditing(false)}
        />
      )}
      <div className="flex items-start gap-3 rounded-[10px] border border-app-border bg-white px-3 py-2.5 shadow-card">
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-semibold text-app-text">{nombre}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${stateStyle}`}>{stateLabel}</span>
            {emp && (
              <span className="flex items-center gap-1 text-[11px] text-app-dim">
                <UserRound className="h-3 w-3" />
                {emp.nombre}
              </span>
            )}
            {task.observaciones && (
              <span className="text-[11px] text-app-dim truncate max-w-[120px]">{task.observaciones}</span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-[6px] p-1.5 text-app-dim transition hover:bg-app-bg hover:text-app-text"
            title="Editar"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => { if (confirm("¿Eliminar esta tarea?")) deleteMutation.mutate(); }}
            disabled={deleteMutation.isPending}
            className="rounded-[6px] p-1.5 text-app-dim transition hover:bg-state-critica/10 hover:text-state-critica disabled:opacity-40"
            title="Eliminar"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </>
  );
}

// ── Day block ──────────────────────────────────────────────────────────────

function DayBlock({
  date,
  tasks,
  zones,
  employees,
  catalog,
  defaultOpen,
}: {
  date: Date;
  tasks: Task[];
  zones: Zone[];
  employees: Employee[];
  catalog: TaskCatalogItem[];
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [creating, setCreating] = useState<"manana" | "tarde" | null>(null);

  const ds = isoDate(date);
  const isToday = ds === isoDate(new Date());

  const tasksByShift = useMemo(() => {
    const manana: Task[] = [];
    const tarde: Task[] = [];
    for (const t of tasks) {
      const s = getShiftForTime(t.fecha_programada);
      if (s === "tarde") tarde.push(t);
      else manana.push(t);
    }
    return { manana, tarde };
  }, [tasks]);

  const dayLabel = date.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });

  return (
    <>
      {creating && (
        <TaskFormModal
          date={ds}
          defaultShift={creating}
          zones={zones}
          employees={employees}
          catalog={catalog}
          onClose={() => setCreating(null)}
        />
      )}

      <div className={`rounded-[14px] border ${isToday ? "border-brand/30" : "border-app-border"} bg-white shadow-card overflow-hidden`}>
        {/* Day header */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-app-bg/50"
        >
          <div className="flex items-center gap-3">
            <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-[10px] font-heading text-xl font-bold ${isToday ? "bg-brand text-white" : "bg-app-bg text-app-text"}`}>
              {date.getDate()}
            </div>
            <div>
              <p className={`font-heading text-sm font-bold capitalize ${isToday ? "text-brand" : "text-app-text"}`}>{dayLabel}</p>
              <p className="text-xs text-app-dim">{tasks.length} tarea(s)</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(["manana", "tarde"] as const).map((s) => {
              const count = tasksByShift[s].length;
              if (count === 0) return null;
              return (
                <span key={s} className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${SHIFT_COLORS[s]}`}>
                  {s === "manana" ? "M" : "T"} {count}
                </span>
              );
            })}
            {open ? <ChevronDown className="h-4 w-4 text-app-dim" /> : <ChevronRight className="h-4 w-4 text-app-dim" />}
          </div>
        </button>

        {open && (
          <div className="divide-y divide-app-border border-t border-app-border">
            {(["manana", "tarde"] as const).map((shift) => (
              <div key={shift} className="px-4 py-3">
                <div className="mb-3 flex items-center justify-between">
                  <span className={`rounded-[6px] border px-2.5 py-1 text-xs font-bold ${SHIFT_COLORS[shift]}`}>
                    {SHIFT_LABELS[shift]}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCreating(shift)}
                    className="flex items-center gap-1 rounded-[8px] border border-app-border px-2.5 py-1.5 text-xs font-bold text-app-dim transition hover:border-brand/30 hover:text-brand"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Añadir
                  </button>
                </div>
                <div className="space-y-2">
                  {tasksByShift[shift].map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      employees={employees}
                      zones={zones}
                      catalog={catalog}
                      date={ds}
                      shift={shift}
                    />
                  ))}
                  {tasksByShift[shift].length === 0 && (
                    <p className="py-3 text-center text-xs text-app-dim">Sin tareas</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ── Main view ──────────────────────────────────────────────────────────────

interface ZonePlanViewProps {
  tasks: Task[];
  zones: Zone[];
  employees: Employee[];
  catalog: TaskCatalogItem[];
}

export function ZonePlanView({ tasks, zones, employees, catalog }: ZonePlanViewProps) {
  const [selectedZone, setSelectedZone] = useState<string>("all");
  const [weekOffset, setWeekOffset] = useState(0);

  const weekDates = useMemo(() => {
    const base = new Date();
    base.setDate(base.getDate() + weekOffset * 7);
    const d = new Date(base);
    const day = d.getDay();
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((day + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => {
      const dd = new Date(monday);
      dd.setDate(monday.getDate() + i);
      return dd;
    });
  }, [weekOffset]);

  const weekStart = isoDate(weekDates[0]);
  const weekEnd = isoDate(weekDates[6]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (t.estado === "cancelada") return false;
      if (selectedZone !== "all" && t.zona_id !== selectedZone) return false;
      if (!t.fecha_programada) return false;
      const d = t.fecha_programada.slice(0, 10);
      return d >= weekStart && d <= weekEnd;
    });
  }, [tasks, selectedZone, weekStart, weekEnd]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of filteredTasks) {
      const d = t.fecha_programada!.slice(0, 10);
      const arr = map.get(d) ?? [];
      arr.push(t);
      map.set(d, arr);
    }
    return map;
  }, [filteredTasks]);

  const todayStr = isoDate(new Date());
  const weekRangeLabel = `${weekDates[0].getDate()} – ${weekDates[6].getDate()} ${weekDates[6].toLocaleDateString("es-ES", { month: "long" })}`;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={selectedZone}
          onChange={(e) => setSelectedZone(e.target.value)}
          className="h-9 rounded-[10px] border border-app-border bg-white px-3 text-sm text-app-text outline-none focus:border-brand"
        >
          <option value="all">Todas las zonas</option>
          {zones.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}
        </select>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekOffset((v) => v - 1)}
            className="rounded-[8px] border border-app-border p-1.5 text-app-dim hover:text-brand"
          >
            <ChevronDown className="h-4 w-4 rotate-90" />
          </button>
          <span className="text-sm font-semibold text-app-text">{weekRangeLabel}</span>
          <button
            type="button"
            onClick={() => setWeekOffset((v) => v + 1)}
            className="rounded-[8px] border border-app-border p-1.5 text-app-dim hover:text-brand"
          >
            <ChevronDown className="h-4 w-4 -rotate-90" />
          </button>
          {weekOffset !== 0 && (
            <button
              type="button"
              onClick={() => setWeekOffset(0)}
              className="text-xs font-bold text-app-dim hover:text-brand"
            >
              Hoy
            </button>
          )}
        </div>

        <span className="ml-auto text-xs text-app-dim">
          {filteredTasks.length} tarea(s) en la semana
        </span>
      </div>

      {/* Day list */}
      <div className="space-y-3">
        {weekDates.map((date) => {
          const ds = isoDate(date);
          const dayTasks = tasksByDay.get(ds) ?? [];
          return (
            <DayBlock
              key={ds}
              date={date}
              tasks={dayTasks}
              zones={zones}
              employees={employees}
              catalog={catalog}
              defaultOpen={ds === todayStr}
            />
          );
        })}
      </div>
    </div>
  );
}
