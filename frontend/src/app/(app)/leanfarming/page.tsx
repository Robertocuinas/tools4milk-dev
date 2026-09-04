"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertOctagon,
  Calendar,
  CalendarClock,
  CheckCircle2,
  Clock,
  LayoutGrid,
  ListChecks,
  ListTodo,
  RefreshCw,
  UserRound,
  BarChart3,
  BookOpen,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useToast } from "@/components/ui/toast";
import { WeeklyPlanView } from "@/components/leanfarming/WeeklyPlanView";
import { ZonePlanView } from "@/components/leanfarming/ZonePlanView";
import { WorkloadView } from "@/components/leanfarming/WorkloadView";
import { TaskCatalogView } from "@/components/leanfarming/TaskCatalogView";
import { api } from "@/lib/api";
import { TV_REFETCH, TV_STALE } from "@/lib/tv-constants";
import { visualZoneSummaries } from "@/lib/visual-zones";
import type { Task } from "@/lib/types";

type ViewMode = "zonas" | "lista";
type ZoneStatus = "critica" | "atencion" | "operativa" | "inactiva";

type ZoneTaskSummary = {
  zone: { id: string; codigo: string; nombre: string };
  programadas: Task[];
  retrasadas: Task[];
  ejecutadas: Task[];
  urgentes: Task[];
};

const statusStyles: Record<ZoneStatus, string> = {
  critica: "border-state-critica/40 bg-state-critica/10 text-state-critica",
  atencion: "border-state-atencion/40 bg-state-atencion/10 text-state-atencion",
  operativa: "border-brand/30 bg-brand/8 text-brand",
  inactiva: "border-app-border bg-app-bg text-app-dim",
};

const statusDot: Record<ZoneStatus, string> = {
  critica: "bg-state-critica",
  atencion: "bg-state-atencion",
  operativa: "bg-brand",
  inactiva: "bg-app-dim",
};

function getZoneStatus(summary: ZoneTaskSummary): ZoneStatus {
  if (summary.retrasadas.some((task) => task.es_urgente)) return "critica";
  if (summary.retrasadas.length > 0 || summary.urgentes.length > 0) return "atencion";
  if (summary.programadas.length === 0 && summary.ejecutadas.length === 0) return "inactiva";
  return "operativa";
}

function TaskRow({
  task,
  onComplete,
  completing,
}: {
  task: Task;
  onComplete: (taskId: string) => void;
  completing: boolean;
}) {
  const canComplete = task.estado === "programada" || task.estado === "retrasada";

  return (
    <div className="flex items-center justify-between gap-3 rounded-[10px] border border-app-border bg-app-bg px-3 py-2.5">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {task.estado === "retrasada" && (
            <AlertOctagon className="h-3.5 w-3.5 shrink-0 text-state-critica" />
          )}
          {task.es_urgente && task.estado !== "retrasada" && (
            <Clock className="h-3.5 w-3.5 shrink-0 text-state-atencion" />
          )}
          <p className="truncate text-sm font-semibold text-app-text">
            {task.tarea_catalogo?.nombre ?? "Tarea"}
          </p>
        </div>
        <p className="mt-0.5 text-xs text-app-dim">
          {new Date(task.fecha_programada).toLocaleString("es-ES", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>

      {canComplete ? (
        <button
          type="button"
          disabled={completing}
          onClick={() => onComplete(task.id)}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand transition hover:bg-brand/15 disabled:opacity-50"
          title="Completar tarea"
        >
          <CheckCircle2 className="h-4 w-4" />
        </button>
      ) : (
        <CheckCircle2 className="h-5 w-5 shrink-0 text-state-ok" />
      )}
    </div>
  );
}

function ZoneCard({
  summary,
  onComplete,
  completing,
}: {
  summary: ZoneTaskSummary;
  onComplete: (taskId: string) => void;
  completing: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const status = getZoneStatus(summary);
  const total = summary.programadas.length + summary.retrasadas.length + summary.ejecutadas.length;
  const pct = total > 0 ? Math.round((summary.ejecutadas.length / total) * 100) : 0;
  const priorityTasks = [
    ...summary.retrasadas,
    ...summary.urgentes.filter((task) => task.estado === "programada"),
    ...summary.programadas.filter((task) => !task.es_urgente),
  ];

  return (
    <div className="rounded-[10px] border border-app-border bg-white">
      <button
        type="button"
        className="w-full px-4 py-4 text-left"
        onClick={() => setExpanded((value) => !value)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${statusDot[status]}`} />
              <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-app-dim">
                {summary.zone.codigo}
              </span>
            </div>
            <h2 className="mt-1 truncate font-heading text-lg font-bold text-app-text">
              {summary.zone.nombre}
            </h2>
          </div>
          <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase ${statusStyles[status]}`}>
            {status}
          </span>
        </div>

        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs font-semibold text-app-dim">
            <span>{summary.ejecutadas.length} / {total || 0} completadas</span>
            <span>{pct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-app-bg">
            <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-2">
          {[
            { label: "Prog.", value: summary.programadas.length, color: "text-state-info" },
            { label: "Retras.", value: summary.retrasadas.length, color: "text-state-critica" },
            { label: "Hechas", value: summary.ejecutadas.length, color: "text-state-ok" },
            { label: "Urg.", value: summary.urgentes.length, color: "text-state-atencion" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-[10px] bg-app-bg px-2 py-2 text-center">
              <div className={`font-heading text-lg font-bold ${color}`}>{value}</div>
              <div className="text-[10px] font-bold uppercase text-app-dim">{label}</div>
            </div>
          ))}
        </div>
      </button>

      {expanded && (
        <div className="space-y-2 border-t border-app-border px-4 pb-4 pt-3">
          {priorityTasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onComplete={onComplete}
              completing={completing}
            />
          ))}
          {priorityTasks.length === 0 && (
            <div className="rounded-[10px] bg-app-bg px-3 py-6 text-center text-sm font-semibold text-app-dim">
              Sin tareas pendientes en esta zona.
            </div>
          )}
          <Link
            href={`/zones/${summary.zone.id}`}
            className="block pt-1 text-center text-xs font-semibold text-brand hover:underline"
          >
            Abrir vista de zona completa →
          </Link>
        </div>
      )}
    </div>
  );
}

function GlobalTaskList({
  tasks,
  onComplete,
  completing,
}: {
  tasks: Task[];
  onComplete: (id: string) => void;
  completing: boolean;
}) {
  const [tab, setTab] = useState<Task["estado"]>("retrasada");
  const filtered = tasks.filter((task) => task.estado === tab);

  const tabs = [
    { key: "retrasada", label: "Retrasadas", color: "text-state-critica" },
    { key: "programada", label: "Programadas", color: "text-state-info" },
    { key: "ejecutada", label: "Ejecutadas", color: "text-state-ok" },
  ] as const;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {tabs.map(({ key, label, color }) => {
          const count = tasks.filter((task) => task.estado === key).length;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                tab === key
                  ? "bg-app-bg text-app-text"
                  : "bg-white text-app-dim hover:bg-app-bg"
              }`}
            >
              {label}
              <span className={`rounded-full px-1.5 text-[11px] font-bold ${tab === key ? color : "text-app-dim"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-[10px] border border-app-border bg-white px-4 py-12 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-state-ok" strokeWidth={1.6} />
          <p className="mt-2 text-sm font-semibold text-app-text">No hay tareas en esta vista.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.slice(0, 30).map((task) => (
            <TaskRow key={task.id} task={task} onComplete={onComplete} completing={completing} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function LeanFarmingPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [view, setView] = useState<ViewMode>("zonas");
  const [leanTab, setLeanTab] = useState<"weekly" | "zones" | "workload" | "catalog">("weekly");

  const zones = useQuery({
    queryKey: ["zones"],
    queryFn: api.zones,
    staleTime: TV_STALE.CATALOG,
  });

  const tasksQuery = useQuery({
    queryKey: ["tasks-all-lean"],
    queryFn: () => api.tasks({ limit: 500 }),
    staleTime: TV_STALE.NORMAL,
    refetchInterval: TV_REFETCH.NORMAL,
  });

  // Additional context queries for the operational summary
  const incidentsQuery = useQuery({
    queryKey: ["tv-incidents"],
    queryFn: () => api.incidents({ limit: 100 }),
    staleTime: TV_STALE.NORMAL,
    refetchInterval: TV_REFETCH.NORMAL,
  });

  const shiftsQuery = useQuery({
    queryKey: ["tv-shifts"],
    queryFn: () => api.shifts({ limit: 4 }),
    staleTime: TV_STALE.SLOW,
  });

  const assignmentsQuery = useQuery({
    queryKey: ["tv-shift-assignments"],
    queryFn: () => api.shiftAssignments({ limit: 30 }),
    staleTime: TV_STALE.SLOW,
  });

  const employeesQuery = useQuery({
    queryKey: ["employees"],
    queryFn: () => api.employees(),
    staleTime: TV_STALE.CATALOG,
  });

  const catalogQuery = useQuery({
    queryKey: ["task-catalog"],
    queryFn: () => api.taskCatalog(),
    staleTime: TV_STALE.CATALOG,
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => api.completeTask(id),
    onSuccess: () => {
      toast.success("Tarea completada");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Error al completar la tarea");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks-all-lean"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: (data: { id: string; updates: Partial<Task> }) =>
      api.updateTask(data.id, data.updates),
    onSuccess: () => {
      toast.success("Tarea actualizada");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Error al actualizar la tarea");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks-all-lean"] });
    },
  });

  const createCatalogMutation = useMutation({
    mutationFn: (task: Record<string, unknown>) => api.createTaskCatalog(task),
    onSuccess: () => {
      toast.success("Tarea de catálogo creada");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Error al crear tarea");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["task-catalog"] });
    },
  });

  const updateCatalogMutation = useMutation({
    mutationFn: (data: { id: string; updates: Record<string, unknown> }) =>
      api.updateTaskCatalog(data.id, data.updates),
    onSuccess: () => {
      toast.success("Tarea de catálogo actualizada");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Error al actualizar tarea");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["task-catalog"] });
    },
  });

  const deleteCatalogMutation = useMutation({
    mutationFn: (id: string) => api.deleteTaskCatalog(id),
    onSuccess: () => {
      toast.success("Tarea de catálogo eliminada");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Error al eliminar tarea");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["task-catalog"] });
    },
  });

  const tasks = tasksQuery.data ?? [];
  const zoneSummaries: ZoneTaskSummary[] = visualZoneSummaries(zones.data ?? [], tasks).map((visualZone) => {
    const zoneTasks = visualZone.items;
    return {
      zone: { id: visualZone.key, codigo: visualZone.key, nombre: visualZone.title },
      programadas: zoneTasks.filter((task) => task.estado === "programada"),
      retrasadas: zoneTasks.filter((task) => task.estado === "retrasada"),
      ejecutadas: zoneTasks.filter((task) => task.estado === "ejecutada"),
      urgentes: zoneTasks.filter((task) => task.es_urgente && task.estado !== "ejecutada"),
    };
  });

  const totals = {
    programadas: tasks.filter((task) => task.estado === "programada").length,
    retrasadas: tasks.filter((task) => task.estado === "retrasada").length,
    ejecutadas: tasks.filter((task) => task.estado === "ejecutada").length,
    urgentes: tasks.filter((task) => task.es_urgente && task.estado !== "ejecutada").length,
  };

  // Operational context
  const openIncidents = (incidentsQuery.data ?? []).filter(
    (i: { estado: string }) => i.estado === "abierta" || i.estado === "en_gestion",
  );
  const criticalIncidents = openIncidents.filter((i: { prioridad: string }) => i.prioridad === "critica" || i.prioridad === "alta");

  // Current shift
  const todayStr = new Date().toISOString().slice(0, 10);
  const currentHour = new Date().getHours();
  const todayShifts = (shiftsQuery.data?.turnos ?? []).filter((s) => s.fecha === todayStr);
  const currentShift = todayShifts.find((s) => {
    const start = parseInt(s.hora_inicio?.slice(0, 2) ?? "0");
    const end = parseInt(s.hora_fin?.slice(0, 2) ?? "24");
    return currentHour >= start && currentHour < end;
  }) ?? todayShifts[0];

  const currentAssignments = currentShift
    ? (assignmentsQuery.data?.asignaciones ?? []).filter((a) => a.turno_id === currentShift.id)
    : [];

  return (
    <div className="min-h-full bg-app-bg text-app-text">
      <div className="border-b border-app-border px-6 py-5 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.18em] text-app-dim">
              <ListTodo className="h-4 w-4 text-brand" />
              LeanFarming
            </div>
            <h1 className="mt-1 font-heading text-2xl font-bold text-app-text">
              Gestion visual de tareas por zona
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex overflow-hidden rounded-[10px] border border-app-border bg-white">
              {[
                { key: "zonas", label: "Por zona", Icon: LayoutGrid },
                { key: "lista", label: "Lista", Icon: ListChecks },
              ].map(({ key, label, Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setView(key as ViewMode)}
                  className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold transition ${
                    view === key ? "bg-app-bg text-brand" : "text-app-dim hover:text-app-text"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => tasksQuery.refetch()}
              className="inline-flex items-center gap-2 rounded-[10px] border border-app-border bg-white px-3 py-2 text-sm font-semibold text-app-dim transition hover:text-app-text"
            >
              <RefreshCw className="h-4 w-4" />
              Actualizar
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-6 px-6 py-6 lg:px-8">
        {/* Operational context */}
        {(openIncidents.length > 0 || currentShift) && (
          <div className="flex flex-wrap gap-3">
            {criticalIncidents.length > 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-state-critica/40 bg-state-critica/10 px-4 py-2.5">
                <AlertOctagon className="h-4 w-4 text-state-critica" />
                <span className="text-sm font-bold text-state-critica">
                  {criticalIncidents.length} incidencia{criticalIncidents.length > 1 ? "s" : ""} critica{criticalIncidents.length > 1 ? "s" : ""}
                </span>
                <Link href="/incidents" className="ml-1 text-[11px] font-semibold text-state-critica underline">
                  Ver
                </Link>
              </div>
            )}
            {openIncidents.length > 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-state-atencion/40 bg-state-atencion/10 px-4 py-2.5">
                <AlertOctagon className="h-4 w-4 text-state-atencion" />
                <span className="text-sm font-bold text-state-atencion">
                  {openIncidents.length} incidencia{openIncidents.length > 1 ? "s" : ""} abierta{openIncidents.length > 1 ? "s" : ""}
                </span>
                <Link href="/incidents" className="ml-1 text-[11px] font-semibold text-state-atencion underline">
                  Ver
                </Link>
              </div>
            )}
            {currentShift && (
              <div className="flex items-center gap-2 rounded-[10px] border border-app-border bg-white px-4 py-2.5">
                <CalendarClock className="h-4 w-4 text-brand" />
                <span className="text-sm font-semibold text-app-text">
                  Turno {currentShift.tipo_turno === "manana" ? "Mañana" : "Tarde"} · {currentShift.hora_inicio?.slice(0, 5)}–{currentShift.hora_fin?.slice(0, 5)}
                </span>
                {currentAssignments.length > 0 && (
                  <div className="flex items-center gap-1 ml-1">
                    <UserRound className="h-3.5 w-3.5 text-app-dim" />
                    <span className="text-xs text-app-dim">{currentAssignments.length} asignados</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[
            { label: "Programadas", value: totals.programadas, Icon: Clock, color: "text-state-info" },
            { label: "Retrasadas", value: totals.retrasadas, Icon: AlertOctagon, color: "text-state-critica" },
            { label: "Ejecutadas", value: totals.ejecutadas, Icon: CheckCircle2, color: "text-state-ok" },
            { label: "Urgentes", value: totals.urgentes, Icon: ListTodo, color: "text-state-atencion" },
          ].map(({ label, value, Icon, color }) => (
            <div key={label} className="rounded-[10px] border border-app-border bg-white p-4">
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${color}`} />
                <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-app-dim">
                  {label}
                </span>
              </div>
              <div className={`mt-2 font-heading text-4xl font-bold ${color}`}>{value}</div>
            </div>
          ))}
        </div>

        {/* Tabs for LeanFarming planning */}
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 border-b border-app-border pb-4">
            {[
              { key: "weekly", label: "Planificación semanal", Icon: Calendar },
              { key: "zones", label: "Por zona", Icon: LayoutGrid },
              { key: "workload", label: "Carga de trabajo", Icon: BarChart3 },
              { key: "catalog", label: "Catálogo", Icon: BookOpen },
            ].map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setLeanTab(key as typeof leanTab)}
                className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold transition rounded-t-[10px] border-b-2 ${
                  leanTab === key
                    ? "border-brand text-brand"
                    : "border-transparent text-app-dim hover:text-app-text"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {tasksQuery.isLoading || zones.isLoading || employeesQuery.isLoading ? (
            <div className="space-y-4">
              <div className="h-64 animate-pulse rounded-[10px] bg-white" />
              <div className="h-64 animate-pulse rounded-[10px] bg-white" />
            </div>
          ) : leanTab === "weekly" ? (
            <WeeklyPlanView
              tasks={tasks}
              zones={zones.data ?? []}
              shifts={shiftsQuery.data?.turnos ?? []}
              employees={employeesQuery.data ?? []}
              onTaskUpdate={(id, updates) => updateTaskMutation.mutate({ id, updates })}
            />
          ) : leanTab === "zones" ? (
            <ZonePlanView
              tasks={tasks}
              zones={zones.data ?? []}
              employees={employeesQuery.data ?? []}
              catalog={catalogQuery.data ?? []}
            />
          ) : leanTab === "workload" ? (
            <WorkloadView
              tasks={tasks}
              zones={zones.data ?? []}
              employees={employeesQuery.data ?? []}
            />
          ) : (
            <TaskCatalogView
              catalog={catalogQuery.data ?? []}
              zones={zones.data ?? []}
              onCreateTask={(task) => createCatalogMutation.mutate(task)}
              onUpdateTask={(id, updates) => updateCatalogMutation.mutate({ id, updates })}
              onDeleteTask={(id) => deleteCatalogMutation.mutate(id)}
            />
          )}
        </div>

        {/* Legacy view modes */}
        {view === "zonas" && leanTab !== "weekly" && leanTab !== "zones" && leanTab !== "workload" && (
          <div className="space-y-4 pt-8 border-t border-app-border">
            <h2 className="font-heading text-lg font-bold text-app-text">
              Vista por zona (Legacy)
            </h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {zoneSummaries.map((summary) => (
                <ZoneCard
                  key={summary.zone.id}
                  summary={summary}
                  onComplete={(id) => completeMutation.mutate(id)}
                  completing={completeMutation.isPending}
                />
              ))}
            </div>
          </div>
        )}

        {view === "lista" && (
          <div className="space-y-4 pt-8 border-t border-app-border">
            <h2 className="font-heading text-lg font-bold text-app-text">
              Lista de tareas (Legacy)
            </h2>
            <GlobalTaskList
              tasks={tasks}
              onComplete={(id) => completeMutation.mutate(id)}
              completing={completeMutation.isPending}
            />
          </div>
        )}
      </div>
    </div>
  );
}
