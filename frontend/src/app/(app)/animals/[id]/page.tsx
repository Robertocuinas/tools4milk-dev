"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  BrainCircuit,
  CheckCircle2,
  Droplets,
  FlaskConical,
  Pill,
  Plus,
  RefreshCw,
  Stethoscope,
} from "lucide-react";
import Link from "next/link";
import { use } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { KpiCard } from "@/components/ui/kpi-card";
import { PanelCard, SectionTitle } from "@/components/ui/panel-card";
import { api } from "@/lib/api";
import type { Alert, Animal, Incident, Lactation, Treatment } from "@/lib/types";

// ── Helpers ─────────────────────────────────────────────────────────────────

function ageLabel(dateStr: string): string {
  const birth = new Date(dateStr);
  const months = Math.floor((Date.now() - birth.getTime()) / (30.44 * 24 * 3600 * 1000));
  if (months < 12) return `${months} meses`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem > 0 ? `${years} a ${rem} m` : `${years} años`;
}

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

function formatNum(v: number | null | undefined, digits = 1): string {
  if (v == null) return "—";
  return v.toLocaleString("es-ES", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

// ── Status badges ────────────────────────────────────────────────────────────

const estadoStyles: Record<Animal["estado"], string> = {
  produccion: "bg-state-ok/10 text-state-ok border-state-ok/20",
  recria: "bg-state-info/10 text-state-info border-state-info/20",
  crianza: "bg-state-info/10 text-state-info border-state-info/20",
  seca: "bg-state-atencion/10 text-state-atencion border-state-atencion/20",
  gestante: "bg-state-atencion/10 text-state-atencion border-state-atencion/20",
  baja: "bg-state-neutral/10 text-state-neutral border-state-neutral/20",
};

const sevBadge: Record<Alert["severidad"], string> = {
  critica: "bg-state-critica/10 text-state-critica",
  alta: "bg-state-atencion/10 text-state-atencion",
  media: "bg-state-info/10 text-state-info",
  baja: "bg-state-neutral/10 text-state-neutral",
};

// ── Section components ───────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 text-sm">
      <span className="shrink-0 font-semibold text-app-dim">{label}</span>
      <span className="text-right text-app-text">{value ?? <span className="text-app-dim">—</span>}</span>
    </div>
  );
}

function LactationsPanel({ animalId }: { animalId: string }) {
  const q = useQuery({
    queryKey: ["animal-lactations", animalId],
    queryFn: () => api.lactations({ animal_id: animalId, limit: 20 }),
    staleTime: 60_000,
  });

  const items = q.data ?? [];

  return (
    <PanelCard>
      <div className="mb-4 flex items-center gap-2">
        <Droplets className="h-4 w-4 text-state-info" />
        <SectionTitle>Lactaciones ({items.length})</SectionTitle>
      </div>

      {q.isError && (
        <p className="text-sm text-state-critica">No se pudieron cargar las lactaciones.</p>
      )}

      {q.isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-[10px] bg-app-surface2" />
          ))}
        </div>
      )}

      {!q.isLoading && items.length === 0 && (
        <p className="text-sm text-app-dim">Sin lactaciones registradas.</p>
      )}

      {items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-app-border text-left text-[11px] font-extrabold uppercase tracking-[0.12em] text-app-dim">
                <th className="pb-2 pr-4">Nº</th>
                <th className="pb-2 pr-4">Parto</th>
                <th className="pb-2 pr-4">Secado</th>
                <th className="pb-2 pr-4">Prod. media</th>
                <th className="pb-2 pr-4">Grasa</th>
                <th className="pb-2 pr-4">Proteína</th>
                <th className="pb-2">RCS</th>
                <th className="pb-2 pl-4">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {items.map((lac: Lactation) => (
                <tr key={lac.id} className="text-app-text">
                  <td className="py-2.5 pr-4 font-bold">{lac.numero_lactacion ?? "—"}</td>
                  <td className="py-2.5 pr-4 text-app-dim">{formatDate(lac.fecha_inicio)}</td>
                  <td className="py-2.5 pr-4 text-app-dim">{formatDate(lac.fecha_fin)}</td>
                  <td className="py-2.5 pr-4">{formatNum(lac.produccion_promedio)} L</td>
                  <td className="py-2.5 pr-4">{lac.grasa_promedio != null ? `${formatNum(lac.grasa_promedio, 2)}%` : "—"}</td>
                  <td className="py-2.5 pr-4">{lac.proteina_promedio != null ? `${formatNum(lac.proteina_promedio, 2)}%` : "—"}</td>
                  <td className="py-2.5">
                    {lac.rcs_promedio != null ? (
                      <span className={`text-xs font-semibold ${lac.rcs_promedio >= 400000 ? "text-state-critica" : lac.rcs_promedio >= 250000 ? "text-state-atencion" : "text-state-ok"}`}>
                        {(lac.rcs_promedio / 1000).toFixed(0)}k
                      </span>
                    ) : "—"}
                  </td>
                  <td className="py-2.5 pl-4">
                    {lac.activa ? (
                      <span className="rounded-full bg-state-ok/10 px-2 py-0.5 text-[11px] font-bold text-state-ok">Activa</span>
                    ) : (
                      <span className="rounded-full bg-state-neutral/10 px-2 py-0.5 text-[11px] font-bold text-state-neutral">Cerrada</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PanelCard>
  );
}

function TreatmentsPanel({ animalId }: { animalId: string }) {
  const q = useQuery({
    queryKey: ["animal-treatments", animalId],
    queryFn: () => api.treatments({ animal_id: animalId, limit: 20 }),
    staleTime: 60_000,
  });

  const items = q.data ?? [];
  const active = items.filter((t: Treatment) => t.activo !== false);

  return (
    <PanelCard>
      <div className="mb-4 flex items-center gap-2">
        <Pill className="h-4 w-4 text-state-atencion" />
        <SectionTitle>Tratamientos ({active.length} activos de {items.length})</SectionTitle>
      </div>

      {q.isError && (
        <p className="text-sm text-state-critica">No se pudieron cargar los tratamientos.</p>
      )}

      {q.isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-[10px] bg-app-surface2" />
          ))}
        </div>
      )}

      {!q.isLoading && items.length === 0 && (
        <p className="text-sm text-app-dim">Sin tratamientos registrados.</p>
      )}

      {items.length > 0 && (
        <div className="space-y-3">
          {items.map((t: Treatment) => (
            <div
              key={t.id}
              className={`rounded-[10px] border px-4 py-3 ${t.activo !== false ? "border-state-atencion/20 bg-state-atencion/5" : "border-app-border bg-app-bg"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-app-text">{t.medicamento ?? "Tratamiento"}</p>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-app-dim">
                    {t.dosis && <span>Dosis: {t.dosis}</span>}
                    {t.via_administracion && <span>Vía: {t.via_administracion}</span>}
                    {t.fecha_inicio && <span>Desde: {formatDate(t.fecha_inicio)}</span>}
                    {t.fecha_fin && <span>Hasta: {formatDate(t.fecha_fin)}</span>}
                    {t.periodo_retirada_dias != null && (
                      <span className="font-semibold text-state-atencion">Retirada: {t.periodo_retirada_dias}d</span>
                    )}
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${t.activo !== false ? "bg-state-atencion/10 text-state-atencion" : "bg-state-neutral/10 text-state-neutral"}`}>
                  {t.activo !== false ? "Activo" : "Cerrado"}
                </span>
              </div>
              {t.observaciones && (
                <p className="mt-2 text-xs text-app-dim">{t.observaciones}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </PanelCard>
  );
}

function AlertsPanel({ animalId }: { animalId: string }) {
  const q = useQuery({
    queryKey: ["animal-alerts", animalId],
    queryFn: () => api.animalAlerts(animalId),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const alerts = q.data?.alertas ?? [];

  return (
    <PanelCard>
      <div className="mb-4 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-state-critica" />
        <SectionTitle>Alertas ({alerts.length})</SectionTitle>
      </div>

      {q.isError && (
        <p className="text-sm text-state-critica">No se pudieron cargar las alertas.</p>
      )}

      {q.isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-[10px] bg-app-surface2" />
          ))}
        </div>
      )}

      {!q.isLoading && alerts.length === 0 && (
        <p className="text-sm text-app-dim">Sin alertas registradas para este animal.</p>
      )}

      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.slice(0, 10).map((alert: Alert) => (
            <div
              key={alert.id}
              className={`rounded-[10px] border-l-4 bg-white px-4 py-3 shadow-card ${
                alert.severidad === "critica" ? "border-l-state-critica"
                : alert.severidad === "alta" ? "border-l-state-atencion"
                : alert.severidad === "media" ? "border-l-state-info"
                : "border-l-app-border"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${sevBadge[alert.severidad]}`}>
                  {alert.severidad}
                </span>
                <span className="text-xs capitalize text-app-dim">{alert.tipo_alerta}</span>
                <span className="ml-auto text-xs text-app-dim">{formatDate(alert.fecha_creacion)}</span>
              </div>
              <p className="mt-1 text-sm font-semibold text-app-text">{alert.descripcion}</p>
              {alert.recomendacion && (
                <p className="mt-1 text-xs text-app-dim">{alert.recomendacion}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </PanelCard>
  );
}

function IncidentsPanel({ animalId }: { animalId: string }) {
  const q = useQuery({
    queryKey: ["incidents-for-animal", animalId],
    queryFn: () => api.incidents({ animal_id: animalId, limit: 100 }),
    staleTime: 60_000,
  });

  const incidents = (q.data ?? []) as Incident[];

  if (!q.isLoading && incidents.length === 0 && !q.isError) return null;

  return (
    <PanelCard>
      <div className="mb-4 flex items-center gap-2">
        <Stethoscope className="h-4 w-4 text-app-dim" />
        <SectionTitle>Incidencias ({incidents.length})</SectionTitle>
      </div>

      {q.isError && (
        <p className="text-sm text-state-critica">No se pudieron cargar las incidencias.</p>
      )}

      {q.isLoading && (
        <div className="h-14 animate-pulse rounded-[10px] bg-app-surface2" />
      )}

      {incidents.length > 0 && (
        <div className="space-y-2">
          {incidents.map((inc) => (
            <div key={inc.id} className="rounded-[10px] border border-app-border bg-app-bg px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-xs capitalize text-app-dim">{inc.tipo.replace(/_/g, " ")}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  inc.prioridad === "critica" ? "bg-state-critica/10 text-state-critica"
                  : inc.prioridad === "alta" ? "bg-state-atencion/10 text-state-atencion"
                  : "bg-state-info/10 text-state-info"
                }`}>
                  {inc.prioridad}
                </span>
                <span className="ml-auto text-xs text-app-dim capitalize">{inc.estado.replace("_", " ")}</span>
              </div>
              <p className="mt-1 text-sm font-semibold text-app-text">{inc.descripcion}</p>
            </div>
          ))}
        </div>
      )}
    </PanelCard>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function AnimalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const queryClient = useQueryClient();

  const animalQ = useQuery({
    queryKey: ["animal", id],
    queryFn: () => api.animal(id),
    staleTime: 60_000,
  });

  const alertsCountQ = useQuery({
    queryKey: ["animal-alerts", id],
    queryFn: () => api.animalAlerts(id),
    staleTime: 30_000,
  });

  const treatmentsCountQ = useQuery({
    queryKey: ["animal-treatments", id],
    queryFn: () => api.treatments({ animal_id: id, limit: 50 }),
    staleTime: 60_000,
  });

  const lactationsCountQ = useQuery({
    queryKey: ["animal-lactations", id],
    queryFn: () => api.lactations({ animal_id: id, limit: 20 }),
    staleTime: 60_000,
  });

  const generateAlertsMutation = useMutation({
    mutationFn: () => api.generateAlerts(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["animal-alerts", id] });
    },
  });

  const animal = animalQ.data;

  if (animalQ.isLoading) {
    return (
      <div className="min-h-full">
        <div className="border-b border-app-border bg-white px-6 py-5 lg:px-8">
          <div className="h-8 w-48 animate-pulse rounded-[10px] bg-app-surface2" />
        </div>
        <div className="space-y-5 px-6 py-6 lg:px-8">
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-[14px] bg-app-surface2" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (animalQ.isError || !animal) {
    return (
      <div className="min-h-full px-6 py-12 lg:px-8">
        <EmptyState
          Icon={FlaskConical}
          title="Animal no encontrado"
          description="Este animal no existe o no tienes acceso a él."
          action={<Link href="/animals" className="rounded-[10px] border border-app-border bg-white px-4 py-2 text-sm font-semibold text-brand">← Volver a animales</Link>}
        />
      </div>
    );
  }

  const pendingAlerts = (alertsCountQ.data?.alertas ?? []).filter(a => a.estado === "pendiente").length;
  const activeTreatments = (treatmentsCountQ.data ?? []).filter(t => t.activo !== false).length;
  const lactations = lactationsCountQ.data ?? [];
  const activeLactation = lactations.find(l => l.activa);

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="border-b border-app-border bg-white px-6 py-5 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.18em] text-app-dim">
              <Link href="/animals" className="flex items-center gap-1 hover:text-brand">
                <ArrowLeft className="h-3.5 w-3.5" />
                Animales
              </Link>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h1 className="font-heading text-2xl font-bold text-app-text">
                <span className="font-mono text-brand">{animal.crotal_oficial}</span>
                {animal.nombre && <span className="ml-2 text-app-dim">· {animal.nombre}</span>}
              </h1>
              <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-extrabold uppercase ${estadoStyles[animal.estado]}`}>
                {animal.estado}
              </span>
              {animal.estado_reproductivo && (
                <span className="rounded-full bg-app-surface2 px-2.5 py-0.5 text-[11px] font-semibold capitalize text-app-dim">
                  {animal.estado_reproductivo}
                </span>
              )}
            </div>
          </div>

          {/* Quick actions */}
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/predictions?animal=${id}`}
              className="inline-flex items-center gap-1.5 rounded-[10px] border border-app-border bg-white px-3 py-2 text-xs font-semibold text-app-dim transition hover:border-brand/30 hover:text-brand"
            >
              <BrainCircuit className="h-3.5 w-3.5" />
              Predicción
            </Link>
            <button
              type="button"
              disabled={generateAlertsMutation.isPending}
              onClick={() => generateAlertsMutation.mutate()}
              className="inline-flex items-center gap-1.5 rounded-[10px] border border-app-border bg-white px-3 py-2 text-xs font-semibold text-app-dim transition hover:border-state-atencion/30 hover:text-state-atencion disabled:opacity-50"
            >
              {generateAlertsMutation.isPending ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5" />
              )}
              Generar alertas
            </button>
            <Link
              href={`/incidents`}
              className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand px-3 py-2 text-xs font-bold text-white shadow-brand transition hover:bg-[#135532]"
            >
              <Plus className="h-3.5 w-3.5" />
              Incidencia
            </Link>
          </div>
        </div>
      </div>

      <div className="space-y-5 px-6 py-6 lg:px-8">
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <KpiCard
            label="Edad"
            value={ageLabel(animal.fecha_nacimiento)}
            sublabel={animal.raza ?? "Raza desconocida"}
          />
          <KpiCard
            label="Lactaciones"
            value={lactations.length}
            sublabel={activeLactation ? `Lactación ${activeLactation.numero_lactacion ?? "?"} activa` : "Sin lactación activa"}
            tone={activeLactation ? "success" : "muted"}
          />
          <KpiCard
            label="Tratamientos"
            value={activeTreatments}
            sublabel="activos actualmente"
            tone={activeTreatments > 0 ? "warning" : "success"}
          />
          <KpiCard
            label="Alertas"
            value={pendingAlerts}
            sublabel="pendientes"
            tone={pendingAlerts > 0 ? "critical" : "success"}
          />
        </div>

        {/* Basic info + Reproductive state */}
        <div className="grid gap-5 lg:grid-cols-2">
          <PanelCard>
            <SectionTitle className="mb-3">Datos del animal</SectionTitle>
            <div className="divide-y divide-app-border">
              <InfoRow label="Crotal oficial" value={<span className="font-mono font-bold text-brand">{animal.crotal_oficial}</span>} />
              <InfoRow label="Nombre" value={animal.nombre} />
              <InfoRow label="Sexo" value={<span className="capitalize">{animal.sexo}</span>} />
              <InfoRow label="Raza" value={animal.raza} />
              <InfoRow label="Nacimiento" value={formatDate(animal.fecha_nacimiento)} />
              <InfoRow label="Fecha entrada" value={formatDate(animal.fecha_entrada)} />
              {animal.fecha_baja && (
                <InfoRow label="Fecha de baja" value={
                  <span className="font-semibold text-state-neutral">{formatDate(animal.fecha_baja)}</span>
                } />
              )}
              {animal.motivo_baja && (
                <InfoRow label="Motivo de baja" value={animal.motivo_baja} />
              )}
              {animal.notas && (
                <InfoRow label="Observaciones" value={animal.notas} />
              )}
            </div>
          </PanelCard>

          <PanelCard>
            <SectionTitle className="mb-3">Estado y producción</SectionTitle>
            <div className="divide-y divide-app-border">
              <InfoRow
                label="Estado"
                value={
                  <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-extrabold uppercase ${estadoStyles[animal.estado]}`}>
                    {animal.estado}
                  </span>
                }
              />
              <InfoRow
                label="Estado reproductivo"
                value={animal.estado_reproductivo
                  ? <span className="capitalize">{animal.estado_reproductivo}</span>
                  : null}
              />
              {activeLactation && (
                <>
                  <InfoRow label="Lactación activa" value={`Nº ${activeLactation.numero_lactacion ?? "?"}`} />
                  <InfoRow label="Producción media" value={activeLactation.produccion_promedio != null ? `${formatNum(activeLactation.produccion_promedio)} L/día` : null} />
                  <InfoRow label="Grasa" value={activeLactation.grasa_promedio != null ? `${formatNum(activeLactation.grasa_promedio, 2)}%` : null} />
                  <InfoRow label="Proteína" value={activeLactation.proteina_promedio != null ? `${formatNum(activeLactation.proteina_promedio, 2)}%` : null} />
                  <InfoRow
                    label="RCS"
                    value={activeLactation.rcs_promedio != null ? (
                      <span className={activeLactation.rcs_promedio >= 400000 ? "font-bold text-state-critica" : activeLactation.rcs_promedio >= 250000 ? "font-semibold text-state-atencion" : "text-state-ok"}>
                        {(activeLactation.rcs_promedio / 1000).toFixed(0)} k cel/mL
                      </span>
                    ) : null}
                  />
                </>
              )}

              <div className="pt-4">
                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/quality"
                    className="inline-flex items-center gap-1.5 rounded-[10px] border border-app-border bg-app-bg px-3 py-2 text-xs font-semibold text-app-dim hover:border-brand/30 hover:text-brand"
                  >
                    <Droplets className="h-3.5 w-3.5" />
                    Ver calidad
                  </Link>
                  <Link
                    href="/predictions"
                    className="inline-flex items-center gap-1.5 rounded-[10px] border border-app-border bg-app-bg px-3 py-2 text-xs font-semibold text-app-dim hover:border-brand/30 hover:text-brand"
                  >
                    <BrainCircuit className="h-3.5 w-3.5" />
                    Ver predicción
                  </Link>
                </div>
              </div>
            </div>
          </PanelCard>
        </div>

        {/* Lactations */}
        <LactationsPanel animalId={id} />

        {/* Treatments */}
        <TreatmentsPanel animalId={id} />

        {/* Alerts */}
        <AlertsPanel animalId={id} />

        {/* Incidents (only shows if there are any for this animal) */}
        <IncidentsPanel animalId={id} />

        {generateAlertsMutation.isError && (
          <div className="rounded-[14px] border border-state-critica/20 bg-state-critica/5 px-4 py-3 text-sm text-state-critica">
            Error al generar alertas: {generateAlertsMutation.error.message}
          </div>
        )}
        {generateAlertsMutation.isSuccess && (
          <div className="flex items-center gap-2 rounded-[14px] bg-state-ok/10 px-4 py-3 text-sm font-semibold text-state-ok">
            <CheckCircle2 className="h-4 w-4" />
            Alertas generadas correctamente.
          </div>
        )}
      </div>
    </div>
  );
}
