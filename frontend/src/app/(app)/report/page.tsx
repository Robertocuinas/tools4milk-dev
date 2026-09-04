"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertOctagon,
  AlertTriangle,
  BarChart3,
  Beef,
  CheckCircle2,
  ClipboardList,
  Droplets,
  MapPin,
  Package,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { KpiCard } from "@/components/ui/kpi-card";
import { PageHeader } from "@/components/ui/page-header";
import { PanelCard, SectionTitle } from "@/components/ui/panel-card";
import { WeatherPanel } from "@/components/ui/WeatherPanel";
import { api } from "@/lib/api";
import { visualZoneSummaries } from "@/lib/visual-zones";
import type { Incident, Order, Task } from "@/lib/types";

// ── Period helpers ────────────────────────────────────────────────────────────

type Period = "7d" | "semana" | "30d";

const PERIOD_LABELS: Record<Period, string> = {
  semana: "Esta semana",
  "7d": "Últimos 7 días",
  "30d": "Últimos 30 días",
};

function getPeriodStart(period: Period): Date {
  const now = new Date();
  if (period === "semana") {
    const day = now.getDay();
    const d = new Date(now);
    d.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    d.setHours(0, 0, 0, 0);
    return d;
  }
  const days = period === "30d" ? 30 : 7;
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

function inPeriod(iso: string | null | undefined, start: Date): boolean {
  if (!iso) return false;
  return new Date(iso) >= start;
}

// ── Mini table row ────────────────────────────────────────────────────────────

function MiniRow({ label, value, tone = "" }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-app-border py-2.5 text-sm last:border-0">
      <span className="text-app-dim">{label}</span>
      <span className={`font-bold text-app-text ${tone}`}>{value}</span>
    </div>
  );
}

// ── Status comment generator ──────────────────────────────────────────────────

function buildStatusComment(
  criticalIncidents: number,
  openIncidents: number,
  delayedTasks: number,
  pendingOrders: number,
): { text: string; tone: string } {
  if (criticalIncidents > 0) {
    return { text: `${criticalIncidents} incidencia${criticalIncidents > 1 ? "s" : ""} critica${criticalIncidents > 1 ? "s" : ""} requiere${criticalIncidents > 1 ? "n" : ""} atencion inmediata.`, tone: "text-state-critica" };
  }
  if (openIncidents > 2) {
    return { text: `${openIncidents} incidencias abiertas en curso. Verificar estado de gestión.`, tone: "text-state-atencion" };
  }
  if (delayedTasks > 3) {
    return { text: `${delayedTasks} tareas retrasadas. Revisar planificación de la explotación.`, tone: "text-state-atencion" };
  }
  if (pendingOrders > 0) {
    return { text: `${pendingOrders} pedido${pendingOrders > 1 ? "s" : ""} pendiente${pendingOrders > 1 ? "s" : ""} de aprobación o recepción.`, tone: "text-state-info" };
  }
  return { text: "Explotación sin incidencias críticas. Estado operativo normal.", tone: "text-state-ok" };
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ReportPage() {
  const [period, setPeriod] = useState<Period>("7d");
  const periodStart = useMemo(() => getPeriodStart(period), [period]);

  const summaryQ = useQuery({ queryKey: ["dashboard-summary"], queryFn: api.dashboardSummary, staleTime: 30_000 });
  const tasksQ = useQuery({ queryKey: ["report-tasks"], queryFn: () => api.tasks({ limit: 300 }), staleTime: 30_000 });
  const incidentsQ = useQuery({ queryKey: ["report-incidents"], queryFn: () => api.incidents({ limit: 200 }), staleTime: 30_000 });
  const ordersQ = useQuery({ queryKey: ["report-orders"], queryFn: () => api.orders({ limit: 100 }), staleTime: 30_000 });
  const qualityQ = useQuery({ queryKey: ["quality-summary"], queryFn: api.qualitySummary, staleTime: 60_000 });
  const zonesQ = useQuery({ queryKey: ["zones"], queryFn: api.zones, staleTime: 60_000 });

  const allTasks = useMemo(() => tasksQ.data ?? [], [tasksQ.data]);
  const allIncidents = useMemo(() => (incidentsQ.data ?? []) as Incident[], [incidentsQ.data]);
  const allOrders = useMemo(() => ordersQ.data?.pedidos ?? [], [ordersQ.data]);
  const zones = zonesQ.data ?? [];
  const zoneSummaries = visualZoneSummaries(zones, allTasks);

  // Period-filtered data
  const tasks = useMemo(() => allTasks.filter((t: Task) => inPeriod(t.fecha_programada, periodStart)), [allTasks, periodStart]);
  const incidents = useMemo(() => allIncidents.filter((i) => inPeriod(i.fecha_creacion, periodStart)), [allIncidents, periodStart]);
  const orders = useMemo(() => allOrders.filter((o: Order) => inPeriod(o.ts_solicitud, periodStart)), [allOrders, periodStart]);

  // Current state (regardless of period)
  const openIncidents = allIncidents.filter((i) => i.estado === "abierta" || i.estado === "en_gestion");
  const criticalIncidents = openIncidents.filter((i) => i.prioridad === "critica");
  const highIncidents = incidents.filter((i) => i.prioridad === "alta").length;
  const pendingOrders = allOrders.filter((o: Order) => o.estado === "solicitado" || o.estado === "aprobado");

  // Period stats
  const tasksDone = tasks.filter((t: Task) => t.estado === "ejecutada").length;
  const tasksPending = tasks.filter((t: Task) => t.estado === "programada").length;
  const tasksDelayed = tasks.filter((t: Task) => t.estado === "retrasada").length;

  const incidentsOpen = incidents.filter((i) => i.estado === "abierta" || i.estado === "en_gestion").length;
  const incidentsClosed = incidents.filter((i) => i.estado === "resuelta" || i.estado === "cerrada").length;
  const incidentsCritical = incidents.filter((i) => i.prioridad === "critica").length;

  const ordersReceived = orders.filter((o: Order) => o.estado === "recibido").length;
  const ordersPending = orders.filter((o: Order) => o.estado === "solicitado" || o.estado === "en_transito").length;

  const statusComment = buildStatusComment(criticalIncidents.length, openIncidents.length, tasksDelayed, pendingOrders.length);

  const isLoading = summaryQ.isLoading || tasksQ.isLoading || incidentsQ.isLoading;

  return (
    <div className="min-h-full">
      <PageHeader eyebrow="Análisis operativo" title="Informe de explotación" EyebrowIcon={BarChart3}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-app-dim">Periodo:</span>
          {(["semana", "7d", "30d"] as Period[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`rounded-[10px] px-3 py-1.5 text-xs font-bold transition ${period === p ? "bg-brand text-white shadow-brand" : "border border-app-border bg-white text-app-dim hover:border-brand/30"}`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </PageHeader>

      <div className="space-y-5 px-6 py-6 lg:px-8">
        {/* Disclaimer */}
        <div className="rounded-[10px] border border-state-info/20 bg-state-info/5 px-4 py-2.5 text-xs text-state-info">
          Datos filtrados por periodo sobre los últimos {tasks === allTasks ? "todos los" : period === "30d" ? "100–300" : "todos los"} registros cargados.
          Algunos endpoints no tienen filtro de fecha servidor — el filtrado es local.
        </div>

        {/* Status comment */}
        {!isLoading && (
          <div className={`flex items-start gap-3 rounded-[14px] border px-5 py-4 ${
            statusComment.tone === "text-state-critica" ? "border-state-critica/20 bg-state-critica/5"
            : statusComment.tone === "text-state-atencion" ? "border-state-atencion/20 bg-state-atencion/5"
            : statusComment.tone === "text-state-info" ? "border-state-info/20 bg-state-info/5"
            : "border-state-ok/20 bg-state-ok/5"
          }`}>
            <p className={`text-sm font-semibold ${statusComment.tone}`}>{statusComment.text}</p>
          </div>
        )}

        {/* KPI grid */}
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-6">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-[14px] bg-app-surface2" />
            ))
          ) : (
            <>
              <KpiCard label="Tareas completadas" value={tasksDone} tone="success" Icon={CheckCircle2} sublabel={`en ${PERIOD_LABELS[period].toLowerCase()}`} />
              <KpiCard label="Tareas pendientes" value={tasksPending} tone={tasksPending > 10 ? "warning" : "default"} Icon={ClipboardList} />
              <KpiCard label="Retrasadas" value={tasksDelayed} tone={tasksDelayed > 0 ? "critical" : "success"} Icon={AlertOctagon} />
              <KpiCard label="Incidencias abiertas" value={openIncidents.length} tone={openIncidents.length > 0 ? "warning" : "success"} Icon={AlertTriangle} sublabel="estado actual" />
              <KpiCard label="Incidencias criticas" value={criticalIncidents.length} tone={criticalIncidents.length > 0 ? "critical" : "success"} Icon={AlertTriangle} sublabel="abiertas" />
              <KpiCard label="Pedidos pend." value={pendingOrders.length} tone={pendingOrders.length > 0 ? "info" : "success"} Icon={Package} sublabel="por recibir" />
            </>
          )}
        </div>

        {/* Two-column layout */}
        <div className="grid gap-5 lg:grid-cols-2">
          {/* LEFT: Tasks + Incidents */}
          <div className="space-y-5">
            {/* Tasks */}
            <PanelCard>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-brand" />
                  <SectionTitle>Tareas · {period === "semana" ? "Esta semana" : period === "7d" ? "Últimos 7 días" : "Último mes"}</SectionTitle>
                </div>
                <Link href="/tasks" className="text-xs font-semibold text-brand hover:underline">Ver todas →</Link>
              </div>

              {tasksQ.isLoading ? (
                <div className="h-20 animate-pulse rounded-[10px] bg-app-surface2" />
              ) : tasks.length === 0 ? (
                <p className="text-sm text-app-dim">Sin tareas en este periodo.</p>
              ) : (
                <>
                  <MiniRow label="Completadas" value={tasksDone} tone="text-state-ok" />
                  <MiniRow label="Programadas" value={tasksPending} />
                  <MiniRow label="Retrasadas" value={tasksDelayed} tone={tasksDelayed > 0 ? "text-state-critica" : ""} />
                  <MiniRow label="Total en periodo" value={tasks.length} />
                </>
              )}

              {/* Upcoming delayed tasks */}
              {!tasksQ.isLoading && tasksDelayed > 0 && (
                <div className="mt-3 space-y-1.5 border-t border-app-border pt-3">
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-state-critica">Retrasadas urgentes</p>
                  {tasks.filter((t: Task) => t.estado === "retrasada").slice(0, 3).map((t: Task) => (
                    <div key={t.id} className="rounded-[10px] bg-state-critica/5 px-3 py-2">
                      <p className="text-xs font-semibold text-app-text">{t.tarea_catalogo?.nombre ?? "Tarea"}</p>
                      <p className="text-[11px] text-app-dim">
                        {new Date(t.fecha_programada).toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </PanelCard>

            {/* Incidents */}
            <PanelCard>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <AlertOctagon className="h-4 w-4 text-state-atencion" />
                  <SectionTitle>Incidencias</SectionTitle>
                </div>
                <Link href="/incidents" className="text-xs font-semibold text-brand hover:underline">Ver todas →</Link>
              </div>

              {incidentsQ.isLoading ? (
                <div className="h-20 animate-pulse rounded-[10px] bg-app-surface2" />
              ) : (
                <>
                  <MiniRow label="En periodo" value={incidents.length} />
                  <MiniRow label="Abiertas / en gestión" value={incidentsOpen} tone={incidentsOpen > 0 ? "text-state-atencion" : ""} />
                  <MiniRow label="Críticas" value={incidentsCritical} tone={incidentsCritical > 0 ? "text-state-critica" : ""} />
                  <MiniRow label="Resueltas / cerradas" value={incidentsClosed} tone="text-state-ok" />
                </>
              )}

              {!incidentsQ.isLoading && incidents.length > 0 && (
                <div className="mt-3 space-y-1.5 border-t border-app-border pt-3">
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-app-dim">Recientes</p>
                  {incidents.slice(0, 3).map((i) => (
                    <div key={i.id} className="rounded-[10px] border border-app-border bg-app-bg px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] capitalize text-app-dim">{i.tipo.replace(/_/g, " ")}</span>
                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${i.prioridad === "critica" ? "bg-state-critica/10 text-state-critica" : "bg-state-atencion/10 text-state-atencion"}`}>
                          {i.prioridad}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs font-semibold text-app-text">{i.descripcion}</p>
                    </div>
                  ))}
                </div>
              )}
            </PanelCard>
          </div>

          {/* RIGHT: Alerts + Orders + Quality */}
          <div className="space-y-5">
            {/* Priority incidents */}
            <PanelCard>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-state-critica" />
                  <SectionTitle>Incidencias prioritarias</SectionTitle>
                </div>
                <Link href="/incidents" className="text-xs font-semibold text-brand hover:underline">Ver todas</Link>
              </div>

              {incidentsQ.isLoading ? (
                <div className="h-16 animate-pulse rounded-[10px] bg-app-surface2" />
              ) : (
                <>
                  <MiniRow label="En periodo" value={incidents.length} />
                  <MiniRow label="Criticas" value={incidentsCritical} tone={incidentsCritical > 0 ? "text-state-critica" : ""} />
                  <MiniRow label="Altas" value={highIncidents} tone={highIncidents > 0 ? "text-state-atencion" : ""} />
                  <MiniRow label="Resueltas / cerradas" value={incidentsClosed} tone="text-state-ok" />
                </>
              )}
            </PanelCard>

            {/* Orders */}
            <PanelCard>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-brand" />
                  <SectionTitle>Pedidos</SectionTitle>
                </div>
                <Link href="/orders" className="text-xs font-semibold text-brand hover:underline">Ver todos →</Link>
              </div>

              {ordersQ.isLoading ? (
                <div className="h-16 animate-pulse rounded-[10px] bg-app-surface2" />
              ) : orders.length === 0 ? (
                <p className="text-sm text-app-dim">Sin pedidos en este periodo.</p>
              ) : (
                <>
                  <MiniRow label="En periodo" value={orders.length} />
                  <MiniRow label="Pendientes / en tránsito" value={ordersPending} tone={ordersPending > 0 ? "text-state-info" : ""} />
                  <MiniRow label="Recibidos" value={ordersReceived} tone="text-state-ok" />
                </>
              )}
            </PanelCard>

            {/* Quality */}
            <PanelCard>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Droplets className="h-4 w-4 text-state-info" />
                  <SectionTitle>Calidad de leche</SectionTitle>
                </div>
                <Link href="/quality" className="text-xs font-semibold text-brand hover:underline">Ver calidad →</Link>
              </div>

              {qualityQ.isLoading ? (
                <div className="h-16 animate-pulse rounded-[10px] bg-app-surface2" />
              ) : (
                <>
                  <MiniRow label="Animales en control" value={qualityQ.data?.animales_en_control ?? "—"} />
                  <MiniRow label="Lactaciones activas" value={qualityQ.data?.lactaciones_activas ?? "—"} />
                  {qualityQ.data?.produccion_promedio != null && (
                    <MiniRow label="Producción media" value={`${qualityQ.data.produccion_promedio.toFixed(1)} L/día`} />
                  )}
                  {qualityQ.data?.grasa_promedio != null && (
                    <MiniRow label="Grasa media" value={`${qualityQ.data.grasa_promedio.toFixed(2)}%`} />
                  )}
                  {qualityQ.data?.rcs_promedio != null && (
                    <MiniRow label="RCS medio" value={`${(qualityQ.data.rcs_promedio / 1000).toFixed(0)} k cel/mL`} tone={qualityQ.data.rcs_promedio >= 250000 ? "text-state-atencion" : "text-state-ok"} />
                  )}
                </>
              )}
            </PanelCard>
          </div>
        </div>

        {/* Zones summary */}
        <PanelCard>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-brand" />
              <SectionTitle>Estado de zonas</SectionTitle>
            </div>
            <Link href="/zones" className="text-xs font-semibold text-brand hover:underline">Ver zonas →</Link>
          </div>

          {zonesQ.isLoading ? (
            <div className="h-16 animate-pulse rounded-[10px] bg-app-surface2" />
          ) : zoneSummaries.length === 0 ? (
            <p className="text-sm text-app-dim">Sin zonas configuradas.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-2">
              {zoneSummaries.map((z) => {
                const zTasks = z.items;
                const delayed = zTasks.filter((t: Task) => t.estado === "retrasada").length;
                return (
                  <Link
                    key={z.key}
                    href={`/zones/${z.key}`}
                    className="rounded-[10px] border border-app-border bg-app-bg px-4 py-3 transition hover:border-brand/30 hover:bg-white"
                  >
                    <p className="font-mono text-[11px] text-app-dim">{z.key}</p>
                    <p className="text-sm font-bold text-app-text">{z.title}</p>
                    {delayed > 0 && (
                      <p className="mt-1 text-[11px] font-semibold text-state-critica">{delayed} retrasadas</p>
                    )}
                    {delayed === 0 && zTasks.length > 0 && (
                      <p className="mt-1 text-[11px] font-semibold text-state-ok">{zTasks.length} tareas</p>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </PanelCard>

        {/* Animales KPI */}
        <PanelCard>
          <div className="mb-4 flex items-center gap-2">
            <Beef className="h-4 w-4 text-brand" />
            <SectionTitle>Ganadería</SectionTitle>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-[10px] border border-app-border bg-app-bg px-4 py-3">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-app-dim">Animales activos</p>
              <p className="mt-1.5 font-heading text-3xl font-bold text-app-text">{summaryQ.data?.animales.activos ?? "—"}</p>
            </div>
            <div className="rounded-[10px] border border-app-border bg-app-bg px-4 py-3">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-app-dim">Tratamientos activos</p>
              <p className={`mt-1.5 font-heading text-3xl font-bold ${(summaryQ.data?.tratamientos.activos ?? 0) > 10 ? "text-state-atencion" : "text-app-text"}`}>
                {summaryQ.data?.tratamientos.activos ?? "—"}
              </p>
            </div>
            <div className="rounded-[10px] border border-app-border bg-app-bg px-4 py-3">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-app-dim">Animales en control</p>
              <p className="mt-1.5 font-heading text-3xl font-bold text-app-text">
                {qualityQ.data?.animales_en_control ?? "—"}
              </p>
            </div>
          </div>
        </PanelCard>

        {/* Weather */}
        <WeatherPanel />

        {/* Quick links */}
        <div className="rounded-[14px] border border-app-border bg-white p-5 shadow-card">
          <p className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.14em] text-app-dim">Accesos directos</p>
          <div className="flex flex-wrap gap-2">
            {[
              { href: "/dashboard", label: "Dashboard" },
              { href: "/incidents", label: "Incidencias" },
              { href: "/tasks", label: "Tareas" },
              { href: "/orders", label: "Pedidos" },
              { href: "/zones", label: "Zonas" },
              { href: "/quality", label: "Calidad" },
              { href: "/animals", label: "Animales" },
              { href: "/incidents", label: "Incidencias" },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="rounded-[10px] border border-app-border bg-app-bg px-3 py-2 text-xs font-semibold text-app-dim transition hover:border-brand/30 hover:text-brand"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
