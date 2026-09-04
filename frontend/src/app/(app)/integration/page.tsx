"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CloudSun,
  Database,
  Globe,
  Loader2,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { KpiCard } from "@/components/ui/kpi-card";
import { PageHeader } from "@/components/ui/page-header";
import { PanelCard, SectionTitle } from "@/components/ui/panel-card";
import { api } from "@/lib/api";
import { API_BASE_URL, API_V1_URL } from "@/lib/config";
import { AccessDenied } from "@/components/ui/access-denied";
import { usePermissions } from "@/lib/use-permissions";

// ── Module status list ────────────────────────────────────────────────────────

const FRONTEND_MODULES = [
  { name: "Auth", path: "/auth/login", description: "Autenticación JWT" },
  { name: "Dashboard", path: "/dashboard/summary", description: "KPIs del centro de control" },
  { name: "Animals", path: "/animals", description: "Gestión del censo" },
  { name: "Alerts", path: "/alerts", description: "Alertas sanitarias y operativas" },
  { name: "Tasks", path: "/tasks", description: "Plan diario de tareas" },
  { name: "Incidents", path: "/incidents", description: "Gestión de incidencias" },
  { name: "Orders", path: "/pedidos", description: "Pedidos de suministros" },
  { name: "Shifts", path: "/turnos", description: "Gestión de turnos" },
  { name: "Handover", path: "/resumenes-relevo", description: "Cambios de turno" },
  { name: "Quality", path: "/lactations/quality/summary", description: "Calidad de leche" },
  { name: "Predictions", path: "/predictions/{id}", description: "Predicción DSS" },
  { name: "Weather", path: "/weather/current", description: "Meteorología (AEMET)" },
  { name: "TV Global", path: "/dashboard/summary", description: "Pantalla TV de explotación" },
  { name: "Audit Log", path: "/audit-log", description: "Registro de auditoría (admin)" },
];

// ── Status badge helper ────────────────────────────────────────────────────────

type StatusType = "ok" | "error" | "loading" | "unknown";

function StatusBadge({ status }: { status: StatusType }) {
  const map: Record<StatusType, { icon: React.ReactNode; cls: string; label: string }> = {
    ok: { icon: <CheckCircle2 className="h-4 w-4" />, cls: "bg-state-ok/10 text-state-ok", label: "Operativo" },
    error: { icon: <XCircle className="h-4 w-4" />, cls: "bg-state-critica/10 text-state-critica", label: "Error" },
    loading: { icon: <Loader2 className="h-4 w-4 animate-spin" />, cls: "bg-state-atencion/10 text-state-atencion", label: "Verificando" },
    unknown: { icon: <AlertTriangle className="h-4 w-4" />, cls: "bg-state-neutral/10 text-state-neutral", label: "No verificado" },
  };
  const s = map[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${s.cls}`}>
      {s.icon}
      {s.label}
    </span>
  );
}

function InfoLine({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-app-border py-2.5 text-sm last:border-0">
      <span className="text-app-dim">{label}</span>
      <span className={`font-semibold text-app-text ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function IntegrationPage() {
  const { role, user, can: userCan } = usePermissions();
  const isAdmin = userCan("view_integration");

  const healthQ = useQuery({
    queryKey: ["health"],
    queryFn: api.health,
    refetchInterval: 30_000,
    retry: 1,
  });

  const weatherQ = useQuery({
    queryKey: ["weather-current"],
    queryFn: api.weather,
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
    retry: 1,
  });

  const backendOnline = healthQ.isSuccess && healthQ.data.status === "ok";
  const dbOnline = healthQ.isSuccess && healthQ.data.database === "ok";
  const weatherOk = weatherQ.isSuccess;

  const systemOk = backendOnline && dbOnline;

  if (!isAdmin) {
    return (
      <div className="min-h-full">
        <PageHeader eyebrow="Estado del sistema" title="Integración API" EyebrowIcon={Activity} />
        <AccessDenied
          role={role}
          requiredCapability="view_integration"
          description="La vista de integración API es exclusiva para administradores del sistema."
        />
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <PageHeader eyebrow="Estado del sistema" title="Integración API" EyebrowIcon={Activity}>
        <StatusBadge status={healthQ.isLoading ? "loading" : systemOk ? "ok" : "error"} />
      </PageHeader>

      <div className="space-y-5 px-6 py-6 lg:px-8">
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <KpiCard
            Icon={Globe}
            label="Backend API"
            value={healthQ.isLoading ? "…" : backendOnline ? "Online" : "Offline"}
            tone={healthQ.isLoading ? "muted" : backendOnline ? "success" : "critical"}
          />
          <KpiCard
            Icon={Database}
            label="Base de datos"
            value={healthQ.isLoading ? "…" : dbOnline ? "Online" : "Offline"}
            tone={healthQ.isLoading ? "muted" : dbOnline ? "success" : "critical"}
          />
          <KpiCard
            Icon={CloudSun}
            label="Meteorología"
            value={weatherQ.isLoading ? "…" : weatherOk ? "Online" : "Sin datos"}
            sublabel={weatherQ.data?.temperatura_actual != null ? `${weatherQ.data.temperatura_actual.toFixed(0)}°C` : ""}
            tone={weatherQ.isLoading ? "muted" : weatherOk ? "success" : "warning"}
          />
          <KpiCard
            Icon={ShieldCheck}
            label="Auth"
            value={user ? "Autenticado" : "Sin sesión"}
            sublabel={user?.username}
            tone={user ? "success" : "critical"}
          />
        </div>

        {/* Backend detail */}
        <div className="grid gap-5 lg:grid-cols-2">
          <PanelCard>
            <div className="mb-3 flex items-center gap-2">
              <Globe className="h-4 w-4 text-brand" />
              <SectionTitle>Estado del backend</SectionTitle>
            </div>

            {healthQ.isLoading && (
              <div className="flex items-center gap-2 text-sm text-app-dim">
                <Loader2 className="h-4 w-4 animate-spin" />
                Verificando conexión…
              </div>
            )}

            {healthQ.isError && (
              <p className="text-sm text-state-critica">No se pudo conectar con el backend.</p>
            )}

            {healthQ.isSuccess && (
              <div>
                <InfoLine label="Estado" value={<StatusBadge status={backendOnline ? "ok" : "error"} />} />
                <InfoLine label="Base de datos" value={<StatusBadge status={dbOnline ? "ok" : "error"} />} />
                <InfoLine label="Entorno" value={healthQ.data.environment ?? "—"} />
                <InfoLine label="API base URL" value={API_BASE_URL} mono />
                <InfoLine label="API v1 URL" value={API_V1_URL} mono />
              </div>
            )}
          </PanelCard>

          <PanelCard>
            <div className="mb-3 flex items-center gap-2">
              <CloudSun className="h-4 w-4 text-state-info" />
              <SectionTitle>Servicios externos</SectionTitle>
            </div>

            <div>
              <InfoLine
                label="Meteorología (AEMET)"
                value={<StatusBadge status={weatherQ.isLoading ? "loading" : weatherOk ? "ok" : "error"} />}
              />
              {weatherQ.data && (
                <>
                  <InfoLine label="Temperatura" value={`${weatherQ.data.temperatura_actual?.toFixed(1) ?? "—"} °C`} />
                  <InfoLine label="Descripción" value={weatherQ.data.descripcion ?? "—"} />
                  {weatherQ.data.impacto_productivo && (
                    <InfoLine label="Impacto producción" value={weatherQ.data.impacto_productivo} />
                  )}
                </>
              )}
            </div>
          </PanelCard>
        </div>

        {/* Session info */}
        <PanelCard>
          <div className="mb-3 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-brand" />
            <SectionTitle>Sesión actual</SectionTitle>
          </div>
          <div className="grid gap-x-8 md:grid-cols-2">
            <InfoLine label="Usuario" value={user?.username ?? "—"} mono />
            <InfoLine label="Email" value={user?.email ?? "—"} />
            <InfoLine label="Rol" value={user?.role ?? "—"} />
            <InfoLine label="Estado" value={user?.activo !== false ? <span className="text-state-ok">Activo</span> : <span className="text-state-neutral">Inactivo</span>} />
          </div>
        </PanelCard>

        {/* Module status */}
        <PanelCard>
          <div className="mb-4 flex items-center gap-2">
            <Activity className="h-4 w-4 text-brand" />
            <SectionTitle>Módulos frontend conectados</SectionTitle>
          </div>
          <p className="mb-4 text-xs text-app-dim">
            Estado declarativo de los módulos del frontend. Solo los marcados como &quot;Verificado&quot; realizan comprobaciones activas.
          </p>
          <div className="grid gap-2 md:grid-cols-2">
            {FRONTEND_MODULES.map((mod) => (
              <div
                key={mod.name}
                className="flex items-center justify-between gap-3 rounded-[10px] border border-app-border bg-app-bg px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-app-text">{mod.name}</p>
                  <p className="text-xs text-app-dim">{mod.description}</p>
                  <p className="mt-0.5 font-mono text-[10px] text-app-dim/70">{API_V1_URL}{mod.path}</p>
                </div>
                <StatusBadge
                  status={
                    mod.name === "Auth" ? (user ? "ok" : "error")
                    : mod.name === "Weather" ? (weatherQ.isLoading ? "loading" : weatherOk ? "ok" : "error")
                    : systemOk ? "ok"
                    : "unknown"
                  }
                />
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-[10px] border border-state-info/20 bg-state-info/5 px-4 py-3 text-xs text-state-info">
            <strong>Nota:</strong> Para una verificación en tiempo real de todos los endpoints, se recomienda integrar
            un sistema de health-check periódico por módulo o un panel Prometheus/Grafana externo.
            {/* TODO: Cuando el backend exponga WebSocket/SSE, sustituir el polling por eventos push */}
          </div>
        </PanelCard>
      </div>
    </div>
  );
}
