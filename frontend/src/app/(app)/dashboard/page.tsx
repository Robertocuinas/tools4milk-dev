"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertOctagon,
  ArrowLeftRight,
  BarChart3,
  Beef,
  CheckCircle2,
  ClipboardList,
  Clock,
  CloudSun,
  ListTodo,
  MapPin,
  Milk,
  Monitor,
  Package,
  Pill,
  RefreshCw,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { DonutStat, SparkArea } from "@/components/charts/MiniCharts";
import { KpiCard } from "@/components/ui/kpi-card";
import { PageHeader } from "@/components/ui/page-header";
import { PanelCard } from "@/components/ui/panel-card";
import { api } from "@/lib/api";
import type { Incident, Lactation } from "@/lib/types";

function SeverityBadge({ severity }: { severity: Incident["prioridad"] }) {
  const map: Record<Incident["prioridad"], string> = {
    critica: "bg-state-critica/10 text-state-critica",
    alta: "bg-state-atencion/10 text-state-atencion",
    media: "bg-state-info/10 text-state-info",
    baja: "bg-state-neutral/10 text-state-neutral",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold uppercase ${map[severity]}`}>
      {severity}
    </span>
  );
}

function formatNumber(value: number | null | undefined, digits = 0) {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toLocaleString("es-ES", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function lactationTrend(items: Lactation[]) {
  return items
    .filter((item) => item.produccion_promedio != null)
    .slice(0, 10)
    .reverse()
    .map((item, index) => ({
      label: item.fecha_inicio?.slice(5, 10) ?? String(index + 1),
      value: Number(item.produccion_promedio),
    }));
}

export default function DashboardPage() {
  const summary = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: api.dashboardSummary,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  const incidents = useQuery({
    queryKey: ["dashboard-incidents-recent"],
    queryFn: () => api.incidents({ limit: 5 }),
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  const quality = useQuery({
    queryKey: ["quality-summary"],
    queryFn: api.qualitySummary,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const lactations = useQuery({
    queryKey: ["dashboard-lactations-active"],
    queryFn: () => api.lactations({ activa: true, limit: 120 }),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const weather = useQuery({
    queryKey: ["weather-current"],
    queryFn: api.weather,
    refetchInterval: 10 * 60_000,
    staleTime: 5 * 60_000,
  });

  const s = summary.data;
  const q = quality.data;
  const w = weather.data;
  const recentIncidents = incidents.data?.slice(0, 5) ?? [];
  const activeIncidents = recentIncidents.filter((item) => item.estado === "abierta" || item.estado === "en_gestion");
  const trend = lactationTrend(lactations.data ?? []);
  const taskTotal = (s?.tareas.programadas ?? 0) + (s?.tareas.ejecutadas ?? 0) + (s?.tareas.retrasadas ?? 0);
  const taskDonePct = s ? Math.round((s.tareas.ejecutadas / Math.max(1, taskTotal)) * 100) : 0;

  return (
    <div className="min-h-full">
      <PageHeader
        eyebrow="Centro de control"
        title="Estado operativo de la explotación"
        EyebrowIcon={RefreshCw}
      >
        <Link
          href="/tv"
          className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand/30 bg-brand/8 px-3 py-1.5 text-xs font-bold text-brand transition hover:bg-brand/15"
        >
          <Monitor className="h-3.5 w-3.5" />
          TV Global
        </Link>
        <span className="flex items-center gap-1.5 rounded-full border border-app-border bg-white px-3 py-1.5 text-xs font-semibold text-app-dim">
          <RefreshCw className="h-3.5 w-3.5 text-brand" />
          Actualización cada 30 s
        </span>
      </PageHeader>

      <div className="space-y-6 px-6 py-6 lg:px-8">
        {/* KPI grid */}
        {summary.isLoading ? (
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-[14px] bg-app-surface2" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <Link href="/incidents">
              <KpiCard
                Icon={AlertOctagon}
                label="Incidencias activas"
                value={activeIncidents.length}
                sublabel={`${recentIncidents.filter((item) => item.prioridad === "critica").length} criticas · ${recentIncidents.filter((item) => item.prioridad === "alta").length} altas`}
                tone={recentIncidents.some((item) => item.prioridad === "critica") ? "critical" : recentIncidents.some((item) => item.prioridad === "alta") ? "warning" : "success"}
              />
            </Link>
            <Link href="/tasks">
              <KpiCard
                Icon={Clock}
                label="Tareas retrasadas"
                value={s?.tareas.retrasadas ?? "—"}
                sublabel="Pendientes fuera de plazo"
                tone={s && s.tareas.retrasadas > 0 ? "warning" : "success"}
              />
            </Link>
            <Link href="/tasks">
              <KpiCard
                Icon={ClipboardList}
                label="Tareas hoy"
                value={taskTotal}
                sublabel={`${s?.tareas.ejecutadas ?? 0} completadas`}
                tone="info"
              />
            </Link>
            <Link href="/animals">
              <KpiCard
                Icon={Beef}
                label="Animales activos"
                value={s?.animales.activos ?? "—"}
                sublabel="Censo operativo"
                tone="default"
              />
            </Link>
            <KpiCard
              Icon={Pill}
              label="Tratamientos"
              value={s?.tratamientos.activos ?? "—"}
              sublabel="Activos actualmente"
              tone={s && s.tratamientos.activos > 15 ? "critical" : "info"}
            />
            <Link href="/tasks">
              <KpiCard
                Icon={CheckCircle2}
                label="Cumplimiento"
                value={`${taskDonePct}%`}
                sublabel="Tareas ejecutadas"
                tone={taskDonePct > 65 ? "success" : "warning"}
              />
            </Link>
            <Link href="/quality">
              <KpiCard
                Icon={Milk}
                label="Producción"
                value={`${formatNumber(q?.produccion_promedio, 1)} L`}
                sublabel={`${q?.lactaciones_activas ?? 0} lactaciones activas`}
                tone="default"
              />
            </Link>
            <KpiCard
              Icon={CloudSun}
              label="Clima"
              value={w?.temperatura_actual != null ? `${formatNumber(w.temperatura_actual, 1)} °C` : "—"}
              sublabel={w?.descripcion ?? "Sin lectura reciente"}
              tone={weather.isError ? "critical" : "info"}
            />
          </div>
        )}

        {/* Animals by zone */}
        {s?.animales.por_zona && s.animales.por_zona.some((z) => z.total > 0) && (
          <PanelCard>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Beef className="h-4 w-4 text-brand" />
                <h2 className="font-heading text-sm font-bold text-app-text">Animales por zona</h2>
              </div>
              <span className="text-xs text-app-dim">{s.animales.activos} activos en total</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {s.animales.por_zona.filter((z) => z.total > 0).map((z) => (
                <div key={z.zona_id} className="flex items-center gap-2 rounded-[10px] border border-app-border bg-app-bg px-3 py-2">
                  <span className="font-heading text-base font-bold text-app-text">{z.total}</span>
                  <span className="text-xs text-app-dim">{z.nombre}</span>
                </div>
              ))}
            </div>
          </PanelCard>
        )}

        {/* Charts row */}
        <div className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
          <PanelCard>
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-app-dim">Pulso operativo</p>
                <h2 className="mt-0.5 font-heading text-base font-bold text-app-text">
                  Producción y carga de trabajo
                </h2>
              </div>
              <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-bold text-brand">
                {q?.animales_en_control ?? 0} en control
              </span>
            </div>
            <div className="h-40">
              {trend.length >= 2 ? (
                <SparkArea height={130} data={trend} color="#1b5e3b" />
              ) : (
                <div className="grid h-full place-items-center rounded-[10px] border border-dashed border-app-border text-sm text-app-dim">
                  Sin lactaciones suficientes para tendencia
                </div>
              )}
            </div>
          </PanelCard>

          <PanelCard>
            <p className="mb-4 text-[11px] font-extrabold uppercase tracking-[0.16em] text-app-dim">
              Cumplimiento de tareas
            </p>
            <div className="grid gap-4 sm:grid-cols-[110px_1fr] sm:items-center xl:grid-cols-1">
              <DonutStat value={taskDonePct} label="ejec." />
              <div className="space-y-3">
                {[
                  { label: "Programadas", value: s?.tareas.programadas ?? 0, bar: "bg-state-info" },
                  { label: "Ejecutadas", value: s?.tareas.ejecutadas ?? 0, bar: "bg-state-ok" },
                  { label: "Retrasadas", value: s?.tareas.retrasadas ?? 0, bar: "bg-state-critica" },
                ].map(({ label, value, bar }) => {
                  const pct = Math.round((value / Math.max(1, taskTotal)) * 100);
                  return (
                    <div key={label}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="font-semibold text-app-dim">{label}</span>
                        <span className="font-bold text-app-text">{value}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-app-surface2">
                        <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </PanelCard>
        </div>

        {/* Bottom row */}
        <div className="grid gap-5 xl:grid-cols-2">
          {/* Recent alerts/incidents */}
          <PanelCard>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertOctagon className="h-4 w-4 text-state-atencion" />
                <h2 className="font-heading text-base font-bold text-app-text">Incidencias recientes</h2>
              </div>
              <Link href="/incidents" className="text-xs font-semibold text-brand hover:underline">
                Ver todas →
              </Link>
            </div>

            {incidents.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-14 animate-pulse rounded-[10px] bg-app-surface2" />
                ))}
              </div>
            ) : recentIncidents.length === 0 ? (
              <div className="py-8 text-center text-sm text-app-dim">
                <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-state-ok" strokeWidth={1.5} />
                No hay incidencias recientes.
              </div>
            ) : (
              <div className="space-y-2">
                {recentIncidents.map((incident) => (
                  <div
                    key={incident.id}
                    className="rounded-[10px] border border-app-border bg-app-bg px-4 py-3"
                  >
                    <div className="flex items-center gap-2">
                      <SeverityBadge severity={incident.prioridad} />
                      <span className="text-xs capitalize text-app-dim">{incident.tipo.replace(/_/g, " ")}</span>
                    </div>
                    <p className="mt-1 truncate text-sm font-semibold text-app-text">{incident.descripcion}</p>
                  </div>
                ))}
              </div>
            )}
          </PanelCard>

          {/* Quick actions */}
          <PanelCard>
            <div className="mb-4 flex items-center gap-2">
              <Zap className="h-4 w-4 text-brand" />
              <h2 className="font-heading text-base font-bold text-app-text">Acciones rápidas</h2>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                { href: "/incidents?new=1", label: "Nueva incidencia", Icon: AlertOctagon, tone: "text-state-critica" },
                { href: "/orders?new=1", label: "Nuevo pedido", Icon: Package, tone: "text-brand" },
                { href: "/tasks?new=1", label: "Nueva tarea", Icon: ClipboardList, tone: "text-state-info" },
                { href: "/handover/tablet", label: "Cambio de turno", Icon: ArrowLeftRight, tone: "text-state-atencion" },
                { href: "/tv", label: "TV Global", Icon: Monitor, tone: "text-brand" },
                { href: "/report", label: "Informe semanal", Icon: BarChart3, tone: "text-state-ok" },
              ].map(({ href, label, Icon, tone }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-2.5 rounded-[10px] border border-app-border bg-app-bg px-4 py-3 text-sm font-semibold text-app-text transition hover:border-brand/30 hover:bg-white"
                >
                  <Icon className={`h-4 w-4 ${tone}`} />
                  {label}
                </Link>
              ))}
            </div>

            <div className="mt-3 border-t border-app-border pt-3">
              <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-app-dim">Navegación</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { href: "/zones", label: "Zonas", Icon: MapPin },
                  { href: "/incidents", label: "Incidencias", Icon: AlertOctagon },
                  { href: "/leanfarming", label: "LeanFarming", Icon: ListTodo },
                  { href: "/animals", label: "Animales", Icon: Beef },
                ].map(({ href, label, Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className="inline-flex items-center gap-1.5 rounded-[10px] border border-app-border bg-white px-3 py-1.5 text-xs font-semibold text-app-dim transition hover:border-brand/30 hover:text-brand"
                  >
                    <Icon className="h-3.5 w-3.5 text-brand" />
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          </PanelCard>
        </div>

        {summary.isError && (
          <div className="rounded-[14px] border border-state-critica/20 bg-state-critica/5 px-4 py-3 text-sm font-semibold text-state-critica">
            Error al cargar datos. Verifica que el backend esté en marcha.
          </div>
        )}
      </div>
    </div>
  );
}
