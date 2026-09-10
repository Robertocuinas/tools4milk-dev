"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertOctagon, CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { AccessDenied } from "@/components/ui/access-denied";
import { PageHeader } from "@/components/ui/page-header";
import { StatusState } from "@/components/ui/status-state";
import { SyntheticMarker } from "@/components/ui/synthetic-marker";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { usePermissions } from "@/lib/use-permissions";
import type { Alert, AlertSeverity, AlertState } from "@/lib/types";

type EstadoFilter = AlertState | "todas";
type SeveridadFilter = AlertSeverity | "todas";
type PendingResolve = { alert: Alert; operationId: string };

const ESTADO_LABELS: Record<AlertState, string> = {
  pendiente: "Pendiente",
  revisada: "Revisada",
  resuelta: "Resuelta",
  falsa_alarma: "Falsa alarma",
};

const ESTADO_STYLES: Record<AlertState, string> = {
  pendiente: "bg-state-critica/15 text-state-critica border-state-critica/30",
  revisada: "bg-state-atencion/15 text-state-atencion border-state-atencion/30",
  resuelta: "bg-state-ok/15 text-emerald-900 border-emerald-900/30",
  falsa_alarma: "bg-state-neutral/10 text-state-neutral border-state-neutral/20",
};

const SEVERITY_STYLES: Record<string, string> = {
  critica: "bg-state-critica/15 text-state-critica",
  alta: "bg-state-atencion/15 text-amber-900",
  media: "bg-state-info/15 text-state-info",
  baja: "bg-state-neutral/10 text-state-neutral",
};

function subscribeToConnectivity(callback: () => void): () => void {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getOnlineSnapshot(): boolean {
  return window.navigator.onLine;
}

function getServerOnlineSnapshot(): boolean {
  return true;
}

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AlertCard({
  alert,
  animalLabel,
  canResolve,
  resolving,
  onResolve,
}: {
  alert: Alert;
  animalLabel: string | null;
  canResolve: boolean;
  resolving: boolean;
  onResolve: (alert: Alert) => void;
}) {
  const resolvable = alert.estado === "pendiente" || alert.estado === "revisada";

  return (
    <article
      aria-label={`Alerta ${alert.tipo_alerta}`}
      className="rounded-[10px] border border-app-border bg-white p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-extrabold uppercase ${ESTADO_STYLES[alert.estado]}`}
        >
          {ESTADO_LABELS[alert.estado]}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${SEVERITY_STYLES[alert.severidad] ?? SEVERITY_STYLES.media}`}
        >
          {alert.severidad}
        </span>
        <span className="ml-auto text-xs text-app-dim">{formatDate(alert.fecha_creacion)}</span>
      </div>

      <h2 className="mt-2 text-sm font-bold text-app-text">
        {alert.tipo_alerta.replace(/_/g, " ")}
      </h2>
      <p className="mt-1 text-sm text-app-text">{alert.descripcion}</p>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-app-dim">
        {animalLabel && (
          <span>
            Animal: <span className="font-mono font-bold text-brand">{animalLabel}</span>
          </span>
        )}
        {alert.fecha_revision && (
          <span>
            Resuelta: <span className="text-app-text">{formatDate(alert.fecha_revision)}</span>
          </span>
        )}
      </div>

      {alert.recomendacion && (
        <div className="mt-2 rounded-[10px] bg-brand/5 px-3 py-2 text-xs text-app-text">
          <span className="font-semibold">Recomendación:</span> {alert.recomendacion}
        </div>
      )}

      {alert.estado === "resuelta" && (
        <p aria-live="polite" className="mt-2 text-xs font-bold text-emerald-900">
          Alerta resuelta
        </p>
      )}

      {canResolve && resolvable && (
        <div className="mt-3">
          <button
            type="button"
            disabled={resolving}
            onClick={() => onResolve(alert)}
            className="inline-flex items-center gap-1.5 rounded-[10px] bg-state-ok/15 px-3 py-2 text-xs font-bold text-state-ok transition hover:bg-state-ok/25 disabled:opacity-50"
          >
            {resolving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {resolving ? "Resolviendo…" : "Resolver alerta"}
          </button>
        </div>
      )}
    </article>
  );
}

function ResolveConfirmDialog({
  alert,
  pending,
  error,
  onConfirm,
  onCancel,
}: {
  alert: Alert;
  pending: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="resolve-dialog-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
    >
      <div className="w-full max-w-md rounded-t-[20px] border border-app-border bg-white shadow-panel sm:rounded-[14px]">
        <div className="border-b border-app-border px-6 py-4">
          <h2 id="resolve-dialog-title" className="font-heading text-lg font-bold text-app-text">
            Confirmar resolución
          </h2>
        </div>
        <div className="space-y-3 px-6 py-5">
          <p className="text-sm text-app-text">
            ¿Marcar como resuelta la alerta{" "}
            <span className="font-bold">{alert.tipo_alerta.replace(/_/g, " ")}</span>? Esta
            acción queda registrada y no se puede deshacer desde esta vista.
          </p>
          <p className="text-xs text-app-dim">
            Datos de demostración sintética, sin validez clínica ni productiva.
          </p>
          {error && (
            <p role="alert" className="rounded-[10px] bg-state-critica/10 px-3 py-2 text-sm text-state-critica">
              {error}
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onCancel}
              disabled={pending}
              className="rounded-[10px] border border-app-border px-4 py-2.5 text-sm font-bold text-app-dim transition hover:text-app-text disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={pending}
              autoFocus
              className="inline-flex items-center justify-center gap-2 rounded-[10px] bg-brand px-4 py-2.5 text-sm font-bold text-white shadow-brand transition hover:bg-[#135532] disabled:opacity-50"
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {pending ? "Resolviendo…" : "Sí, resolver"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AlertsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { can, role } = usePermissions();
  const online = useSyncExternalStore(
    subscribeToConnectivity,
    getOnlineSnapshot,
    getServerOnlineSnapshot,
  );

  const [estadoFilter, setEstadoFilter] = useState<EstadoFilter>("todas");
  const [severidadFilter, setSeveridadFilter] = useState<SeveridadFilter>("todas");
  const [pendingResolve, setPendingResolve] = useState<PendingResolve | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const canView = can("view_alerts");
  const canResolve = can("resolve_alert");

  const alertsQuery = useQuery({
    queryKey: ["alerts"],
    queryFn: () => api.alerts({ limit: 200 }),
    staleTime: 30_000,
    refetchInterval: 60_000,
    enabled: canView,
  });

  const animalsQuery = useQuery({
    queryKey: ["animals-lookup"],
    queryFn: () => api.animals({ limit: 500 }),
    staleTime: 5 * 60_000,
    enabled: canView,
  });

  const animalLookup = useMemo(() => {
    const map = new Map<string, string>();
    for (const animal of animalsQuery.data ?? []) {
      map.set(
        animal.id,
        animal.crotal_oficial + (animal.nombre ? ` · ${animal.nombre}` : ""),
      );
    }
    return map;
  }, [animalsQuery.data]);

  const resolveMutation = useMutation({
    mutationFn: ({ alert, operationId }: PendingResolve) => api.resolveAlert(alert, operationId),
    onMutate: ({ alert }) => {
      setResolvingId(alert.id);
      setResolveError(null);
    },
    onSuccess: () => {
      toast.success("Alerta resuelta");
      setPendingResolve(null);
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      queryClient.invalidateQueries({ queryKey: ["alerts-unified"] });
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
    },
    onError: (err: Error) => {
      setResolveError(err.message || "No se pudo resolver la alerta");
    },
    onSettled: () => {
      setResolvingId(null);
    },
  });

  const filtered = useMemo(() => {
    const list = alertsQuery.data?.alertas ?? [];
    return [...list]
      .filter((alert) => estadoFilter === "todas" || alert.estado === estadoFilter)
      .filter((alert) => severidadFilter === "todas" || alert.severidad === severidadFilter)
      .sort(
        (a, b) =>
          new Date(b.fecha_creacion ?? 0).getTime() -
          new Date(a.fecha_creacion ?? 0).getTime(),
      );
  }, [alertsQuery.data, estadoFilter, severidadFilter]);

  const stats = useMemo(() => {
    const list = alertsQuery.data?.alertas ?? [];
    return {
      total: alertsQuery.data?.total ?? list.length,
      pendientes:
        alertsQuery.data?.estadisticas?.pendientes ??
        list.filter((a) => a.estado === "pendiente").length,
      resueltas: list.filter((a) => a.estado === "resuelta" || a.estado === "falsa_alarma").length,
    };
  }, [alertsQuery.data]);

  if (!canView) {
    return (
      <div className="min-h-full px-6 py-6 lg:px-8">
        <AccessDenied
          role={role}
          requiredCapability="view_alerts"
          title="Sin acceso a alertas"
          description="Tu rol actual no tiene acceso a la vista de alertas."
        />
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <PageHeader eyebrow="Seguimiento DSS" title="Alertas" EyebrowIcon={AlertOctagon}>
        <SyntheticMarker />
        {alertsQuery.isSuccess && (
          <span className="rounded-full border border-app-border bg-white px-3 py-1.5 text-sm font-bold text-app-text">
            {stats.total} registros
          </span>
        )}
      </PageHeader>

      <div className="space-y-5 px-6 py-6 lg:px-8">
        {!online && (
          <p
            role="alert"
            className="rounded-[10px] border border-state-atencion/30 bg-state-atencion/10 px-4 py-3 text-sm font-semibold text-state-atencion"
          >
            Sin conexión: se muestra la última lista disponible. La resolución requiere
            conexión con el servidor.
          </p>
        )}

        <p className="text-sm text-app-dim">
          Superficie de decisión sobre alertas sintéticas. Para la vista operativa
          unificada con incidencias, consulta{" "}
          <Link href="/incidents" className="font-semibold text-brand hover:underline">
            Incidencias
          </Link>
          .
        </p>

        {alertsQuery.isSuccess && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Total", value: stats.total, tone: "text-app-text" },
              { label: "Pendientes", value: stats.pendientes, tone: "text-state-critica" },
              { label: "Resueltas visibles", value: stats.resueltas, tone: "text-state-ok" },
            ].map(({ label, value, tone }) => (
              <div
                key={label}
                className="rounded-[10px] border border-app-border bg-white p-4 shadow-card"
              >
                <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-app-dim">
                  {label}
                </p>
                <p className={`mt-2 font-heading text-4xl font-bold ${tone}`}>{value}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.14em] text-app-dim">
            Estado:
            <select
              aria-label="Filtrar por estado"
              value={estadoFilter}
              onChange={(e) => setEstadoFilter(e.target.value as EstadoFilter)}
              className="rounded-[10px] border border-app-border bg-white px-3 py-2 text-sm font-semibold normal-case tracking-normal text-app-text outline-none"
            >
              <option value="todas">Todos</option>
              <option value="pendiente">Pendiente</option>
              <option value="revisada">Revisada</option>
              <option value="resuelta">Resuelta</option>
              <option value="falsa_alarma">Falsa alarma</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.14em] text-app-dim">
            Severidad:
            <select
              aria-label="Filtrar por severidad"
              value={severidadFilter}
              onChange={(e) => setSeveridadFilter(e.target.value as SeveridadFilter)}
              className="rounded-[10px] border border-app-border bg-white px-3 py-2 text-sm font-semibold normal-case tracking-normal text-app-text outline-none"
            >
              <option value="todas">Todas</option>
              <option value="critica">Crítica</option>
              <option value="alta">Alta</option>
              <option value="media">Media</option>
              <option value="baja">Baja</option>
            </select>
          </label>
        </div>

        {alertsQuery.isLoading && (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" aria-label="Cargando alertas">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-[10px] bg-white" />
            ))}
          </div>
        )}

        {alertsQuery.isError && (
          <StatusState
            kind="error"
            title="No se pudieron cargar las alertas"
            description={alertsQuery.error?.message ?? "Error desconocido"}
            action={
              <button
                type="button"
                onClick={() => alertsQuery.refetch()}
                className="font-semibold text-brand hover:underline"
              >
                Reintentar
              </button>
            }
          />
        )}

        {alertsQuery.isSuccess && filtered.length === 0 && (
          <StatusState
            kind="empty"
            title="Sin alertas"
            description="No hay alertas sintéticas para los filtros seleccionados."
          />
        )}

        {alertsQuery.isSuccess && filtered.length > 0 && (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                animalLabel={
                  alert.animal_id ? (animalLookup.get(alert.animal_id) ?? null) : null
                }
                canResolve={canResolve}
                resolving={resolvingId === alert.id}
                onResolve={(item) => {
                  setResolveError(null);
                  setPendingResolve({ alert: item, operationId: crypto.randomUUID() });
                }}
              />
            ))}
          </div>
        )}
      </div>

      {pendingResolve && (
        <ResolveConfirmDialog
          alert={pendingResolve.alert}
          pending={resolveMutation.isPending}
          error={resolveError}
          onConfirm={() => resolveMutation.mutate(pendingResolve)}
          onCancel={() => {
            if (!resolveMutation.isPending) {
              setPendingResolve(null);
              setResolveError(null);
            }
          }}
        />
      )}
    </div>
  );
}
