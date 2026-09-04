"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/toast";
import {
  AlertOctagon,
  ArrowLeftRight,
  CheckCircle2,
  ClipboardList,
  Loader2,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { api } from "@/lib/api";
import { TV_STALE } from "@/lib/tv-constants";
import type { Employee, ShiftHandover } from "@/lib/types";

// ── Helpers ─────────────────────────────────────────────────────────────────

function shiftLabel(s: { fecha?: string | null; tipo_turno: string; hora_inicio?: string | null; hora_fin?: string | null }): string {
  const tipo = s.tipo_turno === "manana" ? "Mañana" : s.tipo_turno === "tarde" ? "Tarde" : s.tipo_turno;
  const time = s.hora_inicio && s.hora_fin
    ? ` · ${s.hora_inicio.slice(0, 5)}–${s.hora_fin.slice(0, 5)}`
    : "";
  return `${s.fecha ?? ""} · ${tipo}${time}`;
}

function empName(e: Employee | undefined, fallbackId: string): string {
  if (!e) return fallbackId.slice(0, 8) + "…";
  return [e.nombre, e.apellidos].filter(Boolean).join(" ");
}

// ── Sub-components ───────────────────────────────────────────────────────────

function TabletActionButton({
  label,
  sublabel,
  Icon,
  tone,
  onClick,
  disabled,
}: {
  label: string;
  sublabel?: string;
  Icon: typeof ArrowLeftRight;
  tone: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex min-h-[88px] w-full flex-col items-center justify-center gap-2 rounded-[14px] border-2 px-4 py-5 text-center font-bold transition active:scale-95 disabled:opacity-40 ${tone}`}
    >
      <Icon className="h-7 w-7" strokeWidth={1.8} />
      <span className="font-heading text-base">{label}</span>
      {sublabel && <span className="text-xs font-normal opacity-70">{sublabel}</span>}
    </button>
  );
}

function CountPill({
  count,
  label,
  tone,
}: {
  count: number;
  label: string;
  tone: string;
}) {
  return (
    <div className={`rounded-[14px] border px-5 py-4 text-center ${tone}`}>
      <p className="font-heading text-4xl font-bold">{count}</p>
      <p className="mt-1 text-xs font-semibold">{label}</p>
    </div>
  );
}

// ── Create handover modal ───────────────────────────────────────────────────

function CreateHandoverModal({
  shifts,
  onClose,
}: {
  shifts: { id: string; fecha?: string | null; tipo_turno: string; hora_inicio?: string | null }[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [salienteId, setSalienteId] = useState(shifts[0]?.id ?? "");
  const [entranteId, setEntranteId] = useState(shifts[1]?.id ?? "");
  const [notas, setNotas] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      api.createShiftHandover({
        turno_saliente_id: salienteId,
        turno_entrante_id: entranteId,
        notas_saliente: notas.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shift-handovers"] });
      toast.success("Cambio de turno registrado correctamente");
      onClose();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Error al registrar el relevo");
    },
  });

  const labelForShift = (s: typeof shifts[number]) => shiftLabel(s);

  const canSubmit = salienteId && entranteId && salienteId !== entranteId;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60">
      <div className="w-full max-w-lg rounded-t-[20px] border border-app-border bg-white">
        <div className="flex items-center justify-between border-b border-app-border px-6 py-4">
          <h2 className="font-heading text-xl font-bold text-app-text">Registrar cambio de turno</h2>
          <button type="button" onClick={onClose} className="text-app-dim hover:text-app-text">
            <ArrowLeftRight className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <label className="block">
            <span className="mb-2 block text-sm font-extrabold uppercase tracking-[0.12em] text-app-dim">
              Turno saliente
            </span>
            <select
              value={salienteId}
              onChange={(e) => setSalienteId(e.target.value)}
              className="h-12 w-full rounded-[10px] border border-app-border bg-white px-3 text-base text-app-text outline-none focus:border-brand"
            >
              {shifts.map((s) => (
                <option key={s.id} value={s.id}>{labelForShift(s)}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-extrabold uppercase tracking-[0.12em] text-app-dim">
              Turno entrante
            </span>
            <select
              value={entranteId}
              onChange={(e) => setEntranteId(e.target.value)}
              className="h-12 w-full rounded-[10px] border border-app-border bg-white px-3 text-base text-app-text outline-none focus:border-brand"
            >
              {shifts.map((s) => (
                <option key={s.id} value={s.id}>{labelForShift(s)}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-extrabold uppercase tracking-[0.12em] text-app-dim">
              Notas del turno saliente (opcional)
            </span>
            <textarea
              rows={4}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Incidencias, observaciones, puntos de atención para el siguiente turno..."
              className="w-full resize-none rounded-[10px] border border-app-border bg-white px-3 py-3 text-base text-app-text outline-none placeholder:text-app-dim focus:border-brand"
            />
          </label>

          {mutation.isError && (
            <p className="rounded-[10px] bg-state-critica/10 px-3 py-2 text-sm text-state-critica">
              {mutation.error.message}
            </p>
          )}

          <button
            type="button"
            disabled={!canSubmit || mutation.isPending}
            onClick={() => mutation.mutate()}
            className="flex w-full items-center justify-center gap-3 rounded-[14px] bg-brand py-5 font-heading text-xl font-bold text-white shadow-brand transition hover:bg-[#135532] disabled:opacity-50"
          >
            {mutation.isPending ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <ArrowLeftRight className="h-6 w-6" />
            )}
            {mutation.isPending ? "Registrando..." : "Confirmar cambio de turno"}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-[14px] border border-app-border py-4 font-semibold text-app-dim"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function TabletHandoverPage() {
  const [showCreate, setShowCreate] = useState(false);

  const handoversQuery = useQuery({
    queryKey: ["shift-handovers", 1],
    queryFn: () => api.shiftHandovers({ limit: 5 }),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const shiftsQuery = useQuery({
    queryKey: ["shifts", "todos", "", 1],
    queryFn: () => api.shifts({ limit: 10 }),
    staleTime: TV_STALE.SLOW,
  });

  const assignmentsQuery = useQuery({
    queryKey: ["tv-shift-assignments"],
    queryFn: () => api.shiftAssignments({ limit: 50 }),
    staleTime: TV_STALE.SLOW,
  });

  const employeesQuery = useQuery({
    queryKey: ["employees-lookup"],
    queryFn: () => api.employees(),
    staleTime: TV_STALE.CATALOG,
  });

  const employeeById = useMemo(() => {
    const map = new Map<string, Employee>();
    for (const e of employeesQuery.data ?? []) map.set(e.id, e);
    return map;
  }, [employeesQuery.data]);

  const tasksQuery = useQuery({
    queryKey: ["tasks", "programada", 1, ""],
    queryFn: () => api.tasks({ estado: "programada", limit: 20 }),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const incidentsQuery = useQuery({
    queryKey: ["incidents"],
    queryFn: () => api.incidents({ limit: 20 }),
    staleTime: 30_000,
  });

  const recent = handoversQuery.data?.resumenes ?? [];
  const shifts = shiftsQuery.data?.turnos ?? [];
  const pendingTasks = tasksQuery.data ?? [];
  const openIncidents = (incidentsQuery.data ?? []).filter((i: { estado: string }) => i.estado === "abierta" || i.estado === "en_gestion");

  const lastHandover: ShiftHandover | undefined = recent[0];

  return (
    <div className="min-h-full bg-app-bg">
      {showCreate && (
        <CreateHandoverModal
          shifts={shifts}
          onClose={() => setShowCreate(false)}
        />
      )}

      <PageHeader eyebrow="Cambio de turno" title="Relevo" EyebrowIcon={ArrowLeftRight}>
        <Link
          href="/handover"
          className="rounded-[10px] border border-app-border bg-white px-3 py-2 text-sm font-semibold text-app-dim hover:text-app-text"
        >
          Ver todos los relevos
        </Link>
      </PageHeader>

      <div className="space-y-5 px-4 py-5 sm:px-6">
        {/* ── Summary counters ── */}
        <div className="grid grid-cols-3 gap-3">
          <CountPill
            count={openIncidents.length}
            label="Incidencias"
            tone={openIncidents.length > 0
              ? "border-state-critica/30 bg-state-critica/5 text-state-critica"
              : "border-app-border bg-white text-app-dim"}
          />
          <CountPill
            count={pendingTasks.length}
            label="Tareas pend."
            tone={pendingTasks.length > 5
              ? "border-state-atencion/30 bg-state-atencion/5 text-state-atencion"
              : "border-app-border bg-white text-app-dim"}
          />
          <CountPill
            count={recent.length}
            label="Relevos"
            tone={recent.length > 0
              ? "border-state-info/30 bg-state-info/5 text-state-info"
              : "border-app-border bg-white text-app-dim"}
          />
        </div>

        {/* ── Main action ── */}
        <div className="rounded-[14px] border border-app-border bg-white p-5 shadow-card">
          <p className="mb-4 text-sm font-extrabold uppercase tracking-[0.14em] text-app-dim">
            Acción principal
          </p>
          <TabletActionButton
            Icon={ArrowLeftRight}
            label="Registrar cambio de turno"
            sublabel="Crear resumen de relevo y confirmar transición"
            tone="border-brand bg-brand/8 text-brand hover:bg-brand/15"
            onClick={() => setShowCreate(true)}
            disabled={shifts.length < 2}
          />
          {shifts.length < 2 && (
            <p className="mt-2 text-center text-xs text-app-dim">
              Se necesitan al menos 2 turnos registrados hoy
            </p>
          )}
        </div>

        {/* ── Last handover ── */}
        {lastHandover && (
          <div className="rounded-[14px] border border-app-border bg-white p-5 shadow-card">
            <p className="mb-3 text-sm font-extrabold uppercase tracking-[0.14em] text-app-dim">
              Último relevo registrado
            </p>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-app-dim">
                  {new Date(lastHandover.ts_generacion ?? "").toLocaleString("es-ES", {
                    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                  })}
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-app-bg px-2.5 py-1 font-semibold text-app-dim">
                    {lastHandover.incidencias_abiertas.length} incidencias
                  </span>
                  <span className="rounded-full bg-app-bg px-2.5 py-1 font-semibold text-app-dim">
                    {lastHandover.tareas_pendientes.length} tareas
                  </span>
                </div>
                {lastHandover.notas_saliente && (
                  <p className="mt-2 rounded-[10px] bg-app-bg px-3 py-2 text-sm text-app-text">
                    {lastHandover.notas_saliente}
                  </p>
                )}
              </div>
              {lastHandover.ts_confirmacion ? (
                <CheckCircle2 className="h-8 w-8 shrink-0 text-state-ok" />
              ) : (
                <div className="rounded-full bg-state-atencion/10 px-3 py-1 text-xs font-bold text-state-atencion">
                  Pendiente
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Incidents & tasks summary ── */}
        {openIncidents.length > 0 && (
          <div className="rounded-[14px] border border-state-critica/20 bg-white p-5 shadow-card">
            <div className="mb-3 flex items-center gap-2">
              <AlertOctagon className="h-4 w-4 text-state-critica" />
              <p className="text-sm font-extrabold uppercase tracking-[0.14em] text-state-critica">
                Incidencias a traspasar ({openIncidents.length})
              </p>
            </div>
            <div className="space-y-2">
              {openIncidents.slice(0, 4).map((inc: { id: string; descripcion: string; prioridad: string; tipo: string }) => (
                <div key={inc.id} className="rounded-[10px] border border-app-border bg-app-bg px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase text-app-dim">{inc.tipo.replace(/_/g, " ")}</span>
                  </div>
                  <p className="mt-0.5 text-sm font-semibold text-app-text">{inc.descripcion}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Current shift employees */}
        {(() => {
          const today = new Date().toISOString().slice(0, 10);
          const hour = new Date().getHours();
          const todayShifts = shifts.filter((s) => s.fecha === today);
          const current = todayShifts.find((s) => {
            const start = parseInt(s.hora_inicio?.slice(0, 2) ?? "0");
            const end = parseInt(s.hora_fin?.slice(0, 2) ?? "24");
            return hour >= start && hour < end;
          }) ?? todayShifts[0];
          if (!current) return null;
          const currentAssign = (assignmentsQuery.data?.asignaciones ?? []).filter(
            (a) => a.turno_id === current.id,
          );
          if (currentAssign.length === 0) return null;
          return (
            <div className="rounded-[14px] border border-app-border bg-white p-5 shadow-card">
              <div className="mb-3 flex items-center gap-2">
                <UserRound className="h-4 w-4 text-brand" />
                <p className="text-sm font-extrabold uppercase tracking-[0.14em] text-app-dim">
                  Equipo turno actual — {shiftLabel(current)}
                </p>
              </div>
              <div className="space-y-2">
                {currentAssign.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 rounded-[10px] border border-app-border bg-app-bg px-4 py-3">
                    <UserRound className="h-4 w-4 shrink-0 text-app-dim" />
                    <span className="text-sm font-semibold text-app-text">
                      {empName(employeeById.get(a.empleado_id), a.empleado_id)}
                    </span>
                    {a.rol && (
                      <span className="ml-auto rounded-full bg-app-surface2 px-2.5 py-0.5 text-xs text-app-dim">
                        {a.rol}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {pendingTasks.length > 0 && (
          <div className="rounded-[14px] border border-app-border bg-white p-5 shadow-card">
            <div className="mb-3 flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-state-atencion" />
              <p className="text-sm font-extrabold uppercase tracking-[0.14em] text-app-dim">
                Tareas pendientes ({pendingTasks.length})
              </p>
            </div>
            <div className="space-y-2">
              {pendingTasks.slice(0, 5).map((task) => (
                <div key={task.id} className="rounded-[10px] border border-app-border bg-app-bg px-4 py-3">
                  <p className="text-sm font-semibold text-app-text">
                    {task.tarea_catalogo?.nombre ?? "Tarea"}
                  </p>
                  <p className="text-xs text-app-dim">
                    {new Date(task.fecha_programada).toLocaleString("es-ES", {
                      hour: "2-digit", minute: "2-digit",
                    })}
                    {task.estado === "retrasada" && (
                      <span className="ml-2 font-bold text-state-critica">RETRASADA</span>
                    )}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
