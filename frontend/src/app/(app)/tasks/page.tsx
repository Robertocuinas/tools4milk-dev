"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertOctagon,
  CheckCircle2,
  ClipboardList,
  Clock,
  Loader2,
  MapPin,
  Plus,
  TimerReset,
  X,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Pagination } from "@/components/common/Pagination";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { DEFAULT_PAGE_SIZE, getSkip } from "@/lib/pagination";
import { displayZoneName, visualZoneOptions } from "@/lib/visual-zones";
import type { Task, TaskStatus } from "@/lib/types";

type FilterTab = "programada" | "retrasada" | "ejecutada";

const tabConfig: Record<FilterTab, { label: string; color: string; Icon: typeof Clock }> = {
  programada: { label: "Programadas", color: "text-state-info", Icon: Clock },
  retrasada: { label: "Retrasadas", color: "text-state-critica", Icon: AlertOctagon },
  ejecutada: { label: "Ejecutadas", color: "text-state-ok", Icon: CheckCircle2 },
};

const statusStyles: Record<TaskStatus, string> = {
  programada: "bg-state-info/15 text-state-info",
  ejecutada: "bg-state-ok/15 text-state-ok",
  retrasada: "bg-state-critica/15 text-state-critica",
  cancelada: "bg-state-neutral/10 text-state-neutral",
  pausada: "bg-state-atencion/15 text-state-atencion",
};

function StatusBadge({ estado }: { estado: TaskStatus }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold uppercase ${statusStyles[estado]}`}>
      {estado}
    </span>
  );
}

function TaskCard({
  task,
  onComplete,
  loading,
  zoneLookup,
}: {
  task: Task;
  onComplete: (id: string) => void;
  loading: boolean;
  zoneLookup: Map<string, string>;
}) {
  const nombre = task.tarea_catalogo?.nombre ?? "Tarea sin nombre";
  const categoria = task.tarea_catalogo?.categoria;
  const zona = task.zona_id ? zoneLookup.get(task.zona_id) : task.tarea_catalogo?.zona_aplicable;
  const fecha = new Date(task.fecha_programada);
  const canComplete = task.estado === "programada" || task.estado === "retrasada";

  return (
    <div className="rounded-[10px] border border-app-border bg-white px-4 py-4 shadow-card transition hover:border-brand/20 hover:bg-app-bg">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge estado={task.estado} />
            {task.es_urgente && (
              <span className="rounded-full bg-state-critica/15 px-2 py-0.5 text-[11px] font-bold uppercase text-state-critica">
                Urgente
              </span>
            )}
            {categoria && <span className="text-xs font-semibold capitalize text-app-dim">{categoria}</span>}
          </div>
          <h2 className="mt-2 font-heading text-base font-bold text-app-text">{nombre}</h2>
          <div className="mt-1 flex flex-wrap gap-3 text-xs text-app-dim">
            <span>
              {fecha.toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}{" "}
              {fecha.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
            </span>
            {zona && <span className="capitalize">Zona: {zona}</span>}
            {task.ejecutado_por && <span>Por: {task.ejecutado_por}</span>}
          </div>
          {task.observaciones && <p className="mt-2 text-xs text-app-dim">{task.observaciones}</p>}
        </div>

        {canComplete ? (
          <button
            type="button"
            disabled={loading}
            onClick={() => onComplete(task.id)}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-brand/10 text-brand transition hover:bg-brand/15 disabled:opacity-50"
            title="Completar tarea"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          </button>
        ) : (
          <CheckCircle2 className="h-5 w-5 shrink-0 text-state-ok" />
        )}
      </div>
    </div>
  );
}

// ── Create task modal ─────────────────────────────────────────────────────────

function CreateTaskModal({
  zones,
  onClose,
  onSuccess,
}: {
  zones: { id: string; nombre: string }[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();

  // Load real task catalog from the new endpoint
  const catalogQuery = useQuery({
    queryKey: ["task-catalog"],
    queryFn: () => api.taskCatalog(),
    staleTime: 10 * 60_000,
  });
  const catalogItems = catalogQuery.data ?? [];

  const now = new Date();
  const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);

  const [catalogId, setCatalogId] = useState("");
  const [zonaId, setZonaId] = useState("");
  const [fechaPlanificada, setFechaPlanificada] = useState(localNow);
  const [notas, setNotas] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      api.createTask({
        ...(catalogId ? { tarea_catalogo_id: catalogId } : {}),
        ...(zonaId ? { zona_id: zonaId } : {}),
        fecha_programada: new Date(fechaPlanificada).toISOString(),
        ...(notas.trim() ? { observaciones: notas.trim() } : {}),
        estado: "programada",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      toast.success("Tarea creada correctamente");
      onSuccess();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Error al crear la tarea");
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center">
      <div className="w-full max-w-lg rounded-t-[20px] border border-app-border bg-white shadow-panel sm:rounded-[14px]">
        <div className="flex items-center justify-between border-b border-app-border px-6 py-4">
          <h2 className="font-heading text-lg font-bold text-app-text">Nueva tarea</h2>
          <button type="button" onClick={onClose} className="text-app-dim hover:text-app-text">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          {/* Catalog selector — uses real GET /tareas-catalogo endpoint */}
          <div>
            <label className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.14em] text-app-dim">
              Tipo de tarea
            </label>
            {catalogQuery.isLoading ? (
              <div className="h-11 animate-pulse rounded-[10px] bg-app-surface2" />
            ) : catalogItems.length > 0 ? (
              <select
                value={catalogId}
                onChange={(e) => setCatalogId(e.target.value)}
                className="h-11 w-full rounded-[10px] border border-app-border bg-white px-3 text-sm text-app-text outline-none focus:border-brand"
              >
                <option value="">Auto-seleccionar (primer disponible)</option>
                {catalogItems.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}{c.duracion_estimada_min ? ` (${c.duracion_estimada_min} min)` : ""}
                  </option>
                ))}
              </select>
            ) : (
              <div className="rounded-[10px] border border-state-atencion/30 bg-state-atencion/5 px-3 py-3 text-sm text-state-atencion">
                Sin tipos de tarea en el catálogo. Se usará el primero disponible en el sistema.
              </div>
            )}
          </div>

          {/* Zone selector */}
          <div>
            <label className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.14em] text-app-dim">
              Zona (opcional)
            </label>
            <select
              value={zonaId}
              onChange={(e) => setZonaId(e.target.value)}
              className="h-11 w-full rounded-[10px] border border-app-border bg-white px-3 text-sm text-app-text outline-none focus:border-brand"
            >
              <option value="">Sin zona específica</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>{z.nombre}</option>
              ))}
            </select>
          </div>

          {/* Scheduled date/time */}
          <div>
            <label className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.14em] text-app-dim">
              Fecha y hora planificada *
            </label>
            <input
              type="datetime-local"
              value={fechaPlanificada}
              onChange={(e) => setFechaPlanificada(e.target.value)}
              className="h-11 w-full rounded-[10px] border border-app-border bg-white px-3 text-sm text-app-text outline-none focus:border-brand"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.14em] text-app-dim">
              Observaciones (opcional)
            </label>
            <textarea
              rows={2}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              className="w-full resize-none rounded-[10px] border border-app-border bg-white px-3 py-2.5 text-sm text-app-text outline-none placeholder:text-app-dim focus:border-brand"
            />
          </div>

          {mutation.isError && (
            <p className="rounded-[10px] bg-state-critica/10 px-3 py-2 text-sm text-state-critica">
              {mutation.error.message}
            </p>
          )}

          <button
            type="button"
            disabled={!fechaPlanificada || mutation.isPending}
            onClick={() => mutation.mutate()}
            className="w-full rounded-[14px] bg-brand py-3.5 font-heading text-base font-bold text-white shadow-brand transition hover:bg-[#135532] disabled:opacity-50"
          >
            {mutation.isPending ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Creando…
              </span>
            ) : (
              "Crear tarea"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TasksPage() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState<FilterTab>("programada");
  const [page, setPage] = useState(1);
  const [zoneFilter, setZoneFilter] = useState<string>("");
  // Auto-open create modal from ?new=1
  const [showCreate, setShowCreate] = useState(() => searchParams.get("new") === "1");
  const pageSize = DEFAULT_PAGE_SIZE;

  const zonesQuery = useQuery({
    queryKey: ["zones"],
    queryFn: api.zones,
    staleTime: 5 * 60_000,
  });

  const tasksQuery = useQuery({
    queryKey: ["tasks", tab, page, zoneFilter],
    queryFn: () =>
      api.tasks({
        estado: tab,
        skip: getSkip(page, pageSize),
        limit: pageSize + 1,
        ...(zoneFilter ? { zona_id: zoneFilter } : {}),
      }),
    refetchInterval: 30_000,
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => api.completeTask(id),
    onSuccess: () => {
      toast.success("Tarea completada");
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Error al completar la tarea");
    },
  });

  const fetched = tasksQuery.data ?? [];
  const hasNext = fetched.length > pageSize;
  const list = fetched.slice(0, pageSize);
  const zoneOptions = visualZoneOptions(zonesQuery.data ?? []);
  const zoneLookup = new Map((zonesQuery.data ?? []).map((zone) => [zone.id, displayZoneName(zone) ?? zone.nombre]));

  return (
    <div className="min-h-full">
      {showCreate && (
        <CreateTaskModal
          zones={zoneOptions}
          onClose={() => setShowCreate(false)}
          onSuccess={() => setShowCreate(false)}
        />
      )}

      <PageHeader eyebrow="Plan diario" title="Tareas" EyebrowIcon={ClipboardList}>
        <div className="flex items-center gap-3">
          <span className="rounded-full border border-app-border bg-white px-3 py-1.5 text-sm font-bold text-app-text">
            {list.length} en página
          </span>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-[10px] bg-brand px-4 py-2 text-sm font-bold text-white shadow-brand transition hover:bg-[#135532]"
          >
            <Plus className="h-4 w-4" />
            Nueva tarea
          </button>
        </div>
      </PageHeader>

      <div className="space-y-5 px-6 py-6 lg:px-8">
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid min-w-0 flex-1 grid-cols-3 gap-3">
            {(Object.entries(tabConfig) as [FilterTab, (typeof tabConfig)[FilterTab]][]).map(
              ([key, { label, color, Icon }]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setTab(key);
                    setPage(1);
                  }}
                  className={`rounded-[10px] border px-4 py-3 text-left transition ${
                    tab === key
                      ? "border-brand/25 bg-brand/10"
                      : "border-app-border bg-white hover:bg-app-bg"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${tab === key ? color : "text-app-dim"}`} />
                    <span className={`text-sm font-bold ${tab === key ? "text-brand" : "text-app-dim"}`}>{label}</span>
                  </div>
                </button>
              ),
            )}
          </div>

          {/* Zone filter */}
          <div className="flex items-center gap-2 rounded-[10px] border border-app-border bg-white px-3 py-2.5">
            <MapPin className="h-4 w-4 shrink-0 text-app-dim" />
            <select
              value={zoneFilter}
              onChange={(e) => { setZoneFilter(e.target.value); setPage(1); }}
              className="bg-transparent text-sm font-semibold text-app-text outline-none"
              aria-label="Filtrar por zona"
            >
              <option value="">Todas las zonas</option>
              {zoneOptions.map((z) => (
                <option key={z.id} value={z.id}>{z.nombre}</option>
              ))}
            </select>
          </div>
        </div>

        {tasksQuery.isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-24 animate-pulse rounded-[10px] bg-app-surface2" />
            ))}
          </div>
        )}

        {tasksQuery.isError && (
          <div className="rounded-[14px] border border-state-critica/20 bg-state-critica/5 px-4 py-3 text-sm font-semibold text-state-critica">
            Error al cargar tareas.
          </div>
        )}

        {!tasksQuery.isLoading && list.length === 0 && (
          <div className="rounded-[10px] border border-app-border bg-white py-16 text-center shadow-card">
            <TimerReset className="mx-auto h-12 w-12 text-app-dim" strokeWidth={1.5} />
            <p className="mt-3 font-heading text-lg font-bold text-app-text">
              No hay tareas {tabConfig[tab].label.toLowerCase()}
            </p>
            {tab === "programada" && (
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="mt-4 rounded-[10px] bg-brand px-4 py-2 text-sm font-bold text-white hover:bg-[#135532]"
              >
                + Crear primera tarea
              </button>
            )}
          </div>
        )}

        <div className="space-y-3">
          {list.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onComplete={(id) => completeMutation.mutate(id)}
              loading={completeMutation.isPending}
              zoneLookup={zoneLookup}
            />
          ))}
        </div>

        {!tasksQuery.isLoading && list.length > 0 && (
          <Pagination
            page={page}
            pageSize={pageSize}
            currentCount={list.length}
            hasNext={hasNext}
            isLoading={tasksQuery.isFetching}
            onPageChange={setPage}
          />
        )}
      </div>
    </div>
  );
}
