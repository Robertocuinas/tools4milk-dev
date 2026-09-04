"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  BrainCircuit,
  CheckCircle2,
  LogOut,
  Monitor,
  Settings2,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { PanelCard, SectionTitle } from "@/components/ui/panel-card";
import { api } from "@/lib/api";
import { type Capability, roleDisplayName, normalizeRole } from "@/lib/role-capabilities";
import { useActiveWorkerStore } from "@/lib/active-worker-store";
import { usePermissions } from "@/lib/use-permissions";
import { useAppStore } from "@/store/app-store";

// ── Capability groups for display ─────────────────────────────────────────────

const CAPABILITY_GROUPS: { label: string; caps: Capability[] }[] = [
  {
    label: "Control y análisis",
    caps: ["view_dashboard", "view_report", "view_tv_global"],
  },
  {
    label: "Operativa diaria",
    caps: [
      "manage_tasks", "create_task", "complete_task",
      "manage_incidents", "create_incident",
      "manage_orders", "create_order",
      "manage_shifts", "view_handover", "create_handover",
    ],
  },
  {
    label: "Ganadería y sanidad",
    caps: [
      "view_animals", "manage_animals",
      "view_quality", "view_predictions",
      "manage_treatments", "manage_lactations",
      "view_alerts", "resolve_alert",
    ],
  },
  {
    label: "Zonas y maquinaria",
    caps: ["view_zones", "manage_zones", "use_tablet_zone", "manage_machinery", "view_management"],
  },
  {
    label: "Administración del sistema",
    caps: [
      "manage_employees", "manage_settings", "view_audit_log",
      "view_integration", "manage_users",
    ],
  },
];

const CAP_LABELS: Partial<Record<Capability, string>> = {
  view_dashboard: "Ver dashboard",
  view_report: "Ver informe semanal",
  view_tv_global: "Ver TV global",
  manage_tasks: "Gestionar tareas",
  create_task: "Crear tareas",
  complete_task: "Completar tareas",
  manage_incidents: "Gestionar incidencias",
  create_incident: "Crear incidencias",
  manage_orders: "Gestionar pedidos",
  create_order: "Crear pedidos",
  manage_shifts: "Gestionar turnos",
  view_handover: "Ver relevos",
  create_handover: "Crear relevos",
  view_animals: "Ver animales",
  manage_animals: "Gestionar animales",
  view_quality: "Ver calidad de leche",
  view_predictions: "Ver predicciones",
  manage_treatments: "Gestionar tratamientos",
  manage_lactations: "Gestionar lactaciones",
  view_alerts: "Ver alertas",
  resolve_alert: "Resolver alertas",
  view_zones: "Ver zonas",
  manage_zones: "Gestionar zonas",
  use_tablet_zone: "Usar tablet por zona",
  manage_machinery: "Gestionar maquinaria",
  view_management: "Acceder a Gestión",
  manage_employees: "Gestionar empleados",
  manage_settings: "Configuración del sistema",
  view_audit_log: "Ver audit log",
  view_integration: "Ver integración API",
  manage_users: "Gestionar usuarios",
};

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-app-border py-2.5 text-sm last:border-0">
      <span className="shrink-0 font-semibold text-app-dim">{label}</span>
      <span className="text-right text-app-text">{value ?? <span className="text-app-dim">—</span>}</span>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const logout = useAppStore((s) => s.logout);
  const { role, can, isAdmin } = usePermissions();
  const normalizedRole = normalizeRole(role);
  const isUnknownRole = role !== null && role !== normalizedRole;

  const { worker: activeWorker, setWorker, clearWorker, hydrate: workerHydrate } = useActiveWorkerStore();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");

  useEffect(() => { workerHydrate(); }, [workerHydrate]);

  // Refresh user data from API
  const meQ = useQuery({
    queryKey: ["me"],
    queryFn: api.me,
    staleTime: 5 * 60_000,
    retry: 0,
  });

  // Load employees for worker selection
  const employeesQ = useQuery({
    queryKey: ["management-employees"],
    queryFn: () => api.employees(),
    staleTime: 5 * 60_000,
  });

  const profile = meQ.data ?? user;
  const roleInfo = {
    label: roleDisplayName(role),
    color:
      role === "admin" ? "bg-brand/10 text-brand border-brand/20"
      : role === "veterinario" ? "bg-state-info/10 text-state-info border-state-info/20"
      : role === "operario" ? "bg-state-atencion/10 text-state-atencion border-state-atencion/20"
      : "bg-state-ok/10 text-state-ok border-state-ok/20",
  };

  function handleLogout() {
    logout();
    router.replace("/");
  }

  function applyWorker() {
    const emp = (employeesQ.data ?? []).find((e) => e.id === selectedEmployeeId);
    if (!emp) return;
    setWorker({
      id: emp.id,
      name: [emp.nombre, emp.apellidos].filter(Boolean).join(" "),
      role: emp.role ?? "auxiliar",
    });
    setSelectedEmployeeId("");
  }

  return (
    <div className="min-h-full">
      <PageHeader eyebrow="Mi cuenta" title="Perfil" EyebrowIcon={UserRound}>
        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex items-center gap-2 rounded-[10px] border border-state-critica/20 bg-state-critica/5 px-3 py-2 text-sm font-semibold text-state-critica transition hover:bg-state-critica/10"
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </button>
      </PageHeader>

      <div className="space-y-5 px-6 py-6 lg:px-8">
        {/* Unknown role warning */}
        {isUnknownRole && (
          <div className="rounded-[14px] border border-state-atencion/30 bg-state-atencion/5 px-4 py-3 text-sm text-state-atencion">
            <strong>Rol no reconocido:</strong> &quot;{role}&quot; — se aplican permisos mínimos de operario.
          </div>
        )}

        {/* User card */}
        <div className="rounded-[14px] border border-app-border bg-white p-6 shadow-card">
          <div className="flex flex-wrap items-start gap-5">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-brand/10">
              <UserRound className="h-10 w-10 text-brand" strokeWidth={1.5} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="font-heading text-2xl font-bold text-app-text">
                  {profile?.username ?? "—"}
                </h2>
                <span className={`rounded-full border px-3 py-0.5 text-[11px] font-extrabold uppercase ${roleInfo.color}`}>
                  {roleInfo.label}
                </span>
                {profile?.activo !== false ? (
                  <span className="flex items-center gap-1 rounded-full bg-state-ok/10 px-2.5 py-0.5 text-[11px] font-bold text-state-ok">
                    <CheckCircle2 className="h-3 w-3" />
                    Activo
                  </span>
                ) : (
                  <span className="rounded-full bg-state-neutral/10 px-2.5 py-0.5 text-[11px] font-bold text-state-neutral">
                    Inactivo
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-app-dim">{profile?.email ?? "—"}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          {/* Account data */}
          <PanelCard>
            <SectionTitle className="mb-3">Datos de la cuenta</SectionTitle>
            <InfoRow label="Usuario" value={<span className="font-mono text-sm">{profile?.username}</span>} />
            <InfoRow label="Email" value={profile?.email} />
            <InfoRow label="Rol del sistema" value={
              <div className="flex flex-col items-end gap-0.5">
                <span className="font-semibold">{roleInfo.label}</span>
                {role && <span className="font-mono text-[10px] text-app-dim">({role})</span>}
              </div>
            } />
            <InfoRow label="Rol normalizado" value={<span className="font-mono text-xs">{normalizedRole}</span>} />
            <InfoRow label="Administrador" value={isAdmin ? (
              <span className="font-semibold text-brand">Sí</span>
            ) : (
              <span className="text-app-dim">No</span>
            )} />
            <InfoRow label="Estado" value={
              profile?.activo !== false
                ? <span className="font-semibold text-state-ok">Activo</span>
                : <span className="font-semibold text-state-neutral">Inactivo</span>
            } />

            {/* Quick links */}
            <div className="mt-4 border-t border-app-border pt-4">
              <p className="mb-2 text-xs font-semibold text-app-dim">Accesos rápidos</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { href: "/dashboard", label: "Dashboard", Icon: Activity },
                  { href: "/tv", label: "TV", Icon: Monitor },
                  ...(isAdmin ? [
                    { href: "/settings", label: "Configuración", Icon: Settings2 },
                    { href: "/audit-log", label: "Audit Log", Icon: ShieldCheck },
                  ] : []),
                  { href: "/predictions", label: "Predicciones", Icon: BrainCircuit },
                ].map(({ href, label, Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className="inline-flex items-center gap-1.5 rounded-[10px] border border-app-border bg-app-bg px-3 py-2 text-xs font-semibold text-app-dim hover:border-brand/30 hover:text-brand"
                  >
                    <Icon className="h-3.5 w-3.5 text-brand" />
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          </PanelCard>

          {/* Capabilities summary */}
          <PanelCard>
            <SectionTitle className="mb-3">Capacidades del rol &quot;{roleInfo.label}&quot;</SectionTitle>
            <div className="space-y-4">
              {CAPABILITY_GROUPS.map((group) => {
                const available = group.caps.filter((cap) => can(cap));
                const total = group.caps.length;
                if (total === 0) return null;
                return (
                  <div key={group.label}>
                    <div className="mb-1.5 flex items-center justify-between">
                      <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-app-dim">{group.label}</p>
                      <span className="text-[10px] text-app-dim">{available.length}/{total}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {group.caps.map((cap) => {
                        const allowed = can(cap);
                        return (
                          <span
                            key={cap}
                            title={CAP_LABELS[cap] ?? cap}
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              allowed
                                ? "bg-brand/10 text-brand"
                                : "bg-app-surface2 text-app-dim line-through opacity-50"
                            }`}
                          >
                            {CAP_LABELS[cap] ?? cap}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </PanelCard>
        </div>

        {/* ── Worker mode section ── */}
        <PanelCard>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <SectionTitle>Modo trabajador</SectionTitle>
              <p className="mt-0.5 text-xs text-app-dim">
                Selecciona un empleado para simular sus vistas operativas localmente.
              </p>
            </div>
            <span className="rounded-full bg-state-atencion/10 px-2.5 py-0.5 text-[10px] font-bold text-state-atencion">
              Solo local · No persistido
            </span>
          </div>

          {/* Active worker */}
          {activeWorker ? (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-[10px] border border-brand/20 bg-brand/5 px-4 py-3">
              <div>
                <p className="text-sm font-bold text-app-text">{activeWorker.name}</p>
                <p className="text-xs capitalize text-app-dim">Rol operativo: {activeWorker.role}</p>
              </div>
              <button
                type="button"
                onClick={clearWorker}
                className="flex items-center gap-1 rounded-[10px] border border-state-critica/20 bg-white px-3 py-1.5 text-xs font-semibold text-state-critica hover:bg-state-critica/5"
              >
                <X className="h-3.5 w-3.5" />
                Quitar
              </button>
            </div>
          ) : (
            <div className="mb-4 rounded-[10px] border border-dashed border-app-border bg-app-bg px-4 py-3 text-sm text-app-dim">
              Ningún trabajador activo seleccionado.
            </div>
          )}

          {/* Selector */}
          <div className="space-y-2">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-app-dim">
              Seleccionar empleado
            </p>

            {employeesQ.isLoading && (
              <div className="h-11 animate-pulse rounded-[10px] bg-app-surface2" />
            )}

            {employeesQ.isError && (
              <p className="text-sm text-state-critica">No se pudieron cargar los empleados.</p>
            )}

            {!employeesQ.isLoading && (employeesQ.data ?? []).length === 0 && (
              <p className="text-sm text-app-dim">Sin empleados registrados en el sistema.</p>
            )}

            {(employeesQ.data ?? []).length > 0 && (
              <div className="flex gap-2">
                <select
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  className="h-11 flex-1 rounded-[10px] border border-app-border bg-white px-3 text-sm text-app-text outline-none focus:border-brand"
                >
                  <option value="">Seleccionar empleado…</option>
                  {(employeesQ.data ?? []).map((e) => (
                    <option key={e.id} value={e.id}>
                      {[e.nombre, e.apellidos].filter(Boolean).join(" ")}
                      {e.role ? ` · ${e.role}` : ""}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!selectedEmployeeId}
                  onClick={applyWorker}
                  className="rounded-[10px] bg-brand px-4 text-sm font-bold text-white hover:bg-[#135532] disabled:opacity-40"
                >
                  Aplicar
                </button>
              </div>
            )}
          </div>

          <p className="mt-4 text-[11px] text-app-dim">
            <strong>Nota:</strong> La selección de trabajador es puramente local y visual.
            No modifica tus permisos reales de sesión ni afecta al backend.
            {/* TODO (Phase 13): Cuando el backend exponga POST /auth/select-worker o
                vinculación usuario↔empleado, reemplazar esta selección local
                por una sesión de trabajador real con permisos aplicados globalmente. */}
          </p>
        </PanelCard>
      </div>
    </div>
  );
}
