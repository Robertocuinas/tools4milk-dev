"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertOctagon, ClipboardList, MapPin, Monitor, Pill, Tablet, Wrench } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { KpiCard } from "@/components/ui/kpi-card";
import { PageHeader } from "@/components/ui/page-header";
import { WeatherPanel } from "@/components/ui/WeatherPanel";
import { api } from "@/lib/api";
import { TV_REFETCH, TV_STALE } from "@/lib/tv-constants";
import type { Incident, Machinery, Task, Treatment, Zone, VisualZoneKey } from "@/lib/types";

const VISUAL_ZONES: Record<VisualZoneKey, {
  title: string;
  description: string;
  codes: string[];
  subzones: { label: string; codes: string[] }[];
}> = {
  recria: {
    title: "Recria",
    description: "Boxes de terneros y zona de recria con tareas, tratamientos e incidencias.",
    codes: ["boxes_terneros", "zona_recria", "recria", "becerrero"],
    subzones: [
      { label: "Boxes de terneros", codes: ["boxes_terneros", "becerrero"] },
      { label: "Zona de recria", codes: ["zona_recria", "recria"] },
    ],
  },
  nave: {
    title: "Nave",
    description: "Patio de alimentacion, enfermeria y maquinaria del resto de la granja.",
    codes: ["patio_alimentacion", "enfermeria", "maquinaria", "robots", "sala_ordeno", "silos", "almacen", "oficina", "general"],
    subzones: [
      { label: "Patio de alimentacion", codes: ["patio_alimentacion", "silos", "almacen"] },
      { label: "Enfermeria", codes: ["enfermeria"] },
      { label: "Maquinaria", codes: ["maquinaria", "robots", "sala_ordeno", "general", "oficina"] },
    ],
  },
};

function idsForCodes(zones: Zone[], codes: string[]) {
  const wanted = new Set(codes);
  return new Set(zones.filter((z) => wanted.has(z.codigo)).map((z) => z.id));
}

function hasOpenIncident(i: Incident) {
  return i.estado === "abierta" || i.estado === "en_gestion";
}

function isPendingTask(t: Task) {
  return t.estado === "programada" || t.estado === "retrasada";
}

function VisualZoneCard({
  zoneKey,
  zones,
  tasks,
  incidents,
  machinery,
  treatments,
}: {
  zoneKey: VisualZoneKey;
  zones: Zone[];
  tasks: Task[];
  incidents: Incident[];
  machinery: Machinery[];
  treatments: Treatment[];
}) {
  const config = VISUAL_ZONES[zoneKey];
  const zoneIds = idsForCodes(zones, config.codes);
  const zoneTasks = tasks.filter((t) => t.zona_id && zoneIds.has(t.zona_id));
  const openIncidents = incidents.filter((i) => i.zona_id && zoneIds.has(i.zona_id) && hasOpenIncident(i));
  const zoneMachinery = machinery.filter((m) => m.zona_id && zoneIds.has(m.zona_id));
  const pendingTasks = zoneTasks.filter(isPendingTask);
  const delayed = zoneTasks.filter((t) => t.estado === "retrasada");

  return (
    <Link href={`/zones/${zoneKey}`} className="block rounded-[14px] border border-app-border bg-white p-5 shadow-card transition hover:border-brand/30 hover:shadow-panel">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-app-dim">Visualizacion principal</p>
          <h2 className="mt-1 font-heading text-2xl font-bold text-app-text">{config.title}</h2>
          <p className="mt-1 text-sm text-app-dim">{config.description}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-extrabold uppercase ${
          delayed.length > 0 || openIncidents.some((i) => i.prioridad === "alta" || i.prioridad === "critica")
            ? "bg-state-atencion/10 text-state-atencion"
            : "bg-state-ok/10 text-state-ok"
        }`}>
          {delayed.length > 0 ? "Atencion" : "Operativa"}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Tareas pendientes" value={pendingTasks.length} Icon={ClipboardList} tone={delayed.length > 0 ? "warning" : "info"} />
        <KpiCard label="Incidencias abiertas" value={openIncidents.length} Icon={AlertOctagon} tone={openIncidents.length > 0 ? "warning" : "success"} />
        <KpiCard label="Tratamientos activos" value={treatments.filter((t) => t.activo).length} Icon={Pill} tone="info" />
        <KpiCard label="Maquinaria" value={zoneMachinery.length} Icon={Wrench} />
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {config.subzones.map((subzone) => {
          const ids = idsForCodes(zones, subzone.codes);
          const count = tasks.filter((t) => t.zona_id && ids.has(t.zona_id) && isPendingTask(t)).length;
          const incCount = incidents.filter((i) => i.zona_id && ids.has(i.zona_id) && hasOpenIncident(i)).length;
          return (
            <div key={subzone.label} className="rounded-[10px] border border-app-border bg-app-bg px-4 py-3">
              <p className="text-sm font-bold text-app-text">{subzone.label}</p>
              <p className="mt-1 text-xs text-app-dim">{count} tareas pendientes · {incCount} incidencias</p>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex gap-2 text-xs font-semibold">
        <span className="inline-flex items-center gap-1 rounded-full bg-state-info/8 px-2 py-1 text-state-info"><Monitor className="h-3 w-3" /> TV</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-state-ok/8 px-2 py-1 text-state-ok"><Tablet className="h-3 w-3" /> Tablet</span>
      </div>
    </Link>
  );
}

export default function ZonesPage() {
  const zonesQ = useQuery({ queryKey: ["zones"], queryFn: api.zones, staleTime: TV_STALE.CATALOG });
  const tasksQ = useQuery({ queryKey: ["tasks-all"], queryFn: () => api.tasks({ limit: 500 }), staleTime: TV_STALE.NORMAL, refetchInterval: TV_REFETCH.NORMAL });
  const incidentsQ = useQuery({ queryKey: ["tv-incidents"], queryFn: () => api.incidents({ limit: 300 }), staleTime: TV_STALE.NORMAL, refetchInterval: TV_REFETCH.NORMAL });
  const machineryQ = useQuery({ queryKey: ["machinery-all"], queryFn: () => api.machinery({ limit: 200 }), staleTime: TV_STALE.CATALOG });
  const treatmentsQ = useQuery({ queryKey: ["treatments-active"], queryFn: () => api.treatments({ activo: true, limit: 100 }), staleTime: TV_STALE.NORMAL });

  const zones = zonesQ.data ?? [];
  const tasks = useMemo(() => tasksQ.data ?? [], [tasksQ.data]);
  const incidents = useMemo(() => incidentsQ.data ?? [], [incidentsQ.data]);
  const machinery = useMemo(() => machineryQ.data ?? [], [machineryQ.data]);
  const treatments = useMemo(() => treatmentsQ.data ?? [], [treatmentsQ.data]);

  const openIncidents = incidents.filter(hasOpenIncident).length;
  const pendingTasks = tasks.filter(isPendingTask).length;

  return (
    <div className="min-h-full">
      <PageHeader eyebrow="Mapa operativo" title="Zonas de trabajo" EyebrowIcon={MapPin}>
        <span className="rounded-full border border-app-border bg-white px-3 py-1.5 text-sm font-bold text-app-text">
          Recria y Nave
        </span>
      </PageHeader>

      <div className="space-y-5 px-6 py-6 lg:px-8">
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <KpiCard label="Visualizaciones" value={2} />
          <KpiCard label="Subzonas activas" value={7} tone="success" />
          <KpiCard label="Tareas pendientes" value={pendingTasks} Icon={ClipboardList} tone={pendingTasks > 0 ? "info" : "success"} />
          <KpiCard label="Incidencias abiertas" value={openIncidents} Icon={AlertOctagon} tone={openIncidents > 0 ? "warning" : "success"} />
        </div>

        <WeatherPanel compact />

        {zonesQ.isLoading ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="h-80 animate-pulse rounded-[14px] bg-app-surface2" />
            <div className="h-80 animate-pulse rounded-[14px] bg-app-surface2" />
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <VisualZoneCard zoneKey="recria" zones={zones} tasks={tasks} incidents={incidents} machinery={machinery} treatments={treatments} />
            <VisualZoneCard zoneKey="nave" zones={zones} tasks={tasks} incidents={incidents} machinery={machinery} treatments={treatments} />
          </div>
        )}

        <div className="rounded-[14px] border border-app-border bg-white px-5 py-4 text-sm text-app-dim shadow-card">
          Las zonas historicas siguen en base de datos para no romper relaciones, pero esta vista solo muestra las dos visualizaciones operativas: Recria y Nave.
        </div>
      </div>
    </div>
  );
}
