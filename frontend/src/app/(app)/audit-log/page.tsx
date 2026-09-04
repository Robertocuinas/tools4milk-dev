"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronUp,
  Database,
  ShieldCheck,
} from "lucide-react";
import { useMemo, useState } from "react";
import { AccessDenied } from "@/components/ui/access-denied";
import { KpiCard } from "@/components/ui/kpi-card";
import { PageHeader } from "@/components/ui/page-header";
import { api } from "@/lib/api";
import { usePermissions } from "@/lib/use-permissions";
import type { AuditLogEntry, AuditOperation } from "@/lib/types";

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatTs(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

const operationStyles: Record<AuditOperation, { badge: string; label: string }> = {
  INSERT: { badge: "bg-state-ok/10 text-state-ok", label: "INSERT" },
  UPDATE: { badge: "bg-state-info/10 text-state-info", label: "UPDATE" },
  DELETE: { badge: "bg-state-critica/10 text-state-critica", label: "DELETE" },
};

// ── Row component ─────────────────────────────────────────────────────────────

function AuditRow({ entry }: { entry: AuditLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const op = operationStyles[entry.operacion] ?? { badge: "bg-app-bg text-app-dim", label: entry.operacion };

  return (
    <div className="border-b border-app-border last:border-0">
      <button
        type="button"
        className="flex w-full items-center gap-4 px-4 py-3 text-left transition hover:bg-app-bg"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold uppercase ${op.badge}`}>
          {op.label}
        </span>
        <span className="min-w-[120px] font-mono text-xs font-semibold text-brand">
          {entry.tabla_afectada}
        </span>
        <span className="hidden flex-1 truncate text-xs text-app-dim sm:block">
          {entry.registro_id ? entry.registro_id.slice(0, 8) + "…" : "—"}
        </span>
        <span className="hidden text-xs text-app-dim md:block">{entry.usuario_bd}</span>
        <span className="ml-auto shrink-0 text-xs text-app-dim">{formatTs(entry.ts)}</span>
        {expanded ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-app-dim" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-app-dim" />
        )}
      </button>

      {expanded && (
        <div className="grid gap-4 bg-app-bg px-4 pb-4 pt-2 sm:grid-cols-2">
          {entry.datos_anteriores && (
            <div>
              <p className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-state-critica">
                Antes
              </p>
              <pre className="overflow-x-auto rounded-[10px] border border-app-border bg-white p-3 text-[11px] text-app-text">
                {JSON.stringify(entry.datos_anteriores, null, 2)}
              </pre>
            </div>
          )}
          {entry.datos_nuevos && (
            <div>
              <p className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-state-ok">
                Después
              </p>
              <pre className="overflow-x-auto rounded-[10px] border border-app-border bg-white p-3 text-[11px] text-app-text">
                {JSON.stringify(entry.datos_nuevos, null, 2)}
              </pre>
            </div>
          )}
          {!entry.datos_anteriores && !entry.datos_nuevos && (
            <p className="text-xs text-app-dim">Sin detalle de datos.</p>
          )}
          <div className="sm:col-span-2">
            <p className="text-[10px] font-mono text-app-dim">
              SHA-256: {entry.hash_sha256?.slice(0, 32)}…
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type FilterOp = AuditOperation | "";

const TABLE_OPTIONS = [
  "", "animales", "lactaciones", "tratamientos_activos", "alertas",
  "incidencias", "pedidos", "turnos", "asignaciones_turno", "empleados",
  "maquinaria", "zonas", "usuarios",
];

export default function AuditLogPage() {
  const { role, can: userCan } = usePermissions();
  const isAdmin = userCan("view_audit_log");

  const [tabla, setTabla] = useState("");
  const [accion, setAccion] = useState<FilterOp>("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [limit] = useState(200);

  const q = useQuery({
    queryKey: ["audit-log", tabla, accion, fechaDesde, fechaHasta, limit],
    queryFn: () =>
      api.auditLog({
        ...(tabla ? { tabla } : {}),
        ...(accion ? { accion } : {}),
        ...(fechaDesde ? { fecha_desde: fechaDesde } : {}),
        ...(fechaHasta ? { fecha_hasta: fechaHasta } : {}),
        limit,
      }),
    staleTime: 30_000,
    enabled: isAdmin,
  });

  const registros = useMemo(() => q.data?.registros ?? [], [q.data]);

  const stats = useMemo(() => ({
    total: registros.length,
    inserts: registros.filter((r) => r.operacion === "INSERT").length,
    updates: registros.filter((r) => r.operacion === "UPDATE").length,
    deletes: registros.filter((r) => r.operacion === "DELETE").length,
  }), [registros]);

  // Client-side search filter by tabla or usuario_bd
  const [search, setSearch] = useState("");
  const filtered = search.trim()
    ? registros.filter(
        (r) =>
          r.tabla_afectada.toLowerCase().includes(search.toLowerCase()) ||
          r.usuario_bd.toLowerCase().includes(search.toLowerCase()),
      )
    : registros;

  if (!isAdmin) {
    return (
      <div className="min-h-full">
        <PageHeader eyebrow="Sistema" title="Audit Log" EyebrowIcon={ShieldCheck} />
        <AccessDenied
          role={role}
          requiredCapability="view_audit_log"
          description="El registro de auditoría es exclusivo para administradores del sistema."
        />
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <PageHeader eyebrow="Administración del sistema" title="Audit Log" EyebrowIcon={ShieldCheck}>
        <span className="rounded-full border border-app-border bg-white px-3 py-1.5 text-xs font-semibold text-app-dim">
          Últimos {limit} registros
        </span>
      </PageHeader>

      <div className="space-y-5 px-6 py-6 lg:px-8">
        {/* KPIs */}
        {q.isSuccess && (
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <KpiCard label="Total eventos" value={stats.total} tone="default" />
            <KpiCard label="Inserciones" value={stats.inserts} tone="success" Icon={Database} />
            <KpiCard label="Actualizaciones" value={stats.updates} tone="info" Icon={Database} />
            <KpiCard label="Eliminaciones" value={stats.deletes} tone="critical" Icon={Database} />
          </div>
        )}

        {/* Filters */}
        <div className="rounded-[14px] border border-app-border bg-white p-4 shadow-card">
          <p className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.14em] text-app-dim">
            Filtros
          </p>
          <div className="flex flex-wrap gap-3">
            <div className="min-w-[160px] flex-1">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-app-dim">
                Tabla
              </label>
              <select
                value={tabla}
                onChange={(e) => setTabla(e.target.value)}
                className="h-10 w-full rounded-[10px] border border-app-border bg-white px-3 text-sm text-app-text outline-none focus:border-brand"
              >
                <option value="">Todas las tablas</option>
                {TABLE_OPTIONS.filter(Boolean).map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div className="min-w-[140px]">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-app-dim">
                Operación
              </label>
              <select
                value={accion}
                onChange={(e) => setAccion(e.target.value as FilterOp)}
                className="h-10 w-full rounded-[10px] border border-app-border bg-white px-3 text-sm text-app-text outline-none focus:border-brand"
              >
                <option value="">Todas</option>
                <option value="INSERT">INSERT</option>
                <option value="UPDATE">UPDATE</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-app-dim">
                Desde
              </label>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                className="h-10 rounded-[10px] border border-app-border bg-white px-3 text-sm text-app-text outline-none focus:border-brand"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-app-dim">
                Hasta
              </label>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                className="h-10 rounded-[10px] border border-app-border bg-white px-3 text-sm text-app-text outline-none focus:border-brand"
              />
            </div>

            <div className="flex-1">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-app-dim">
                Búsqueda rápida
              </label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tabla o usuario..."
                className="h-10 w-full min-w-[160px] rounded-[10px] border border-app-border bg-white px-3 text-sm text-app-text outline-none placeholder:text-app-dim focus:border-brand"
              />
            </div>

            {(tabla || accion || fechaDesde || fechaHasta || search) && (
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => { setTabla(""); setAccion(""); setFechaDesde(""); setFechaHasta(""); setSearch(""); }}
                  className="h-10 rounded-[10px] border border-app-border px-3 text-sm font-semibold text-app-dim transition hover:text-app-text"
                >
                  Limpiar
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Loading */}
        {q.isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-[10px] bg-app-surface2" />
            ))}
          </div>
        )}

        {/* Error */}
        {q.isError && (
          <div className="rounded-[14px] border border-state-critica/20 bg-state-critica/5 px-4 py-3 text-sm text-state-critica">
            Error al cargar el audit log: {q.error.message}
          </div>
        )}

        {/* Empty */}
        {q.isSuccess && filtered.length === 0 && (
          <div className="rounded-[14px] border border-app-border bg-white py-12 text-center shadow-card">
            <Database className="mx-auto h-10 w-10 text-app-dim" strokeWidth={1.5} />
            <p className="mt-3 font-heading text-base font-bold text-app-text">Sin registros</p>
            <p className="mt-1 text-sm text-app-dim">
              {search || tabla || accion ? "No hay eventos con estos filtros." : "El log de auditoría está vacío."}
            </p>
          </div>
        )}

        {/* Table */}
        {filtered.length > 0 && (
          <div className="rounded-[14px] border border-app-border bg-white shadow-card overflow-hidden">
            {/* Table header */}
            <div className="flex items-center gap-4 border-b border-app-border bg-app-bg px-4 py-2.5">
              <span className="w-[80px] text-[11px] font-extrabold uppercase tracking-[0.12em] text-app-dim">Op.</span>
              <span className="min-w-[120px] text-[11px] font-extrabold uppercase tracking-[0.12em] text-app-dim">Tabla</span>
              <span className="hidden flex-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-app-dim sm:block">Registro ID</span>
              <span className="hidden text-[11px] font-extrabold uppercase tracking-[0.12em] text-app-dim md:block">Usuario</span>
              <span className="ml-auto text-[11px] font-extrabold uppercase tracking-[0.12em] text-app-dim">Fecha</span>
              <span className="w-4" />
            </div>

            {/* Rows */}
            <div className="divide-y divide-app-border">
              {filtered.map((entry: AuditLogEntry) => (
                <AuditRow key={entry.id} entry={entry} />
              ))}
            </div>

            {/* Footer count */}
            {filtered.length < registros.length && (
              <div className="border-t border-app-border bg-app-bg px-4 py-2 text-xs text-app-dim">
                Mostrando {filtered.length} de {registros.length} eventos filtrados
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
