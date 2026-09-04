"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Monitor,
  Plus,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { visualZoneOptions } from "@/lib/visual-zones";
import type {
  CreateShiftAssignmentPayload,
  CreateShiftPayload,
  Employee,
  Shift,
  ShiftAssignment,
  ShiftType,
  Zone,
} from "@/lib/types";

// ── Constants ──────────────────────────────────────────────────────────────

const SHIFT_TYPE_LABELS: Record<ShiftType, string> = {
  manana: "Mañana",
  tarde: "Tarde",
};

const SHIFT_HOURS: Record<ShiftType, { inicio: string; fin: string }> = {
  manana: { inicio: "06:00", fin: "14:00" },
  tarde: { inicio: "16:00", fin: "00:00" },
};

const SHIFT_CELL_STYLES: Record<ShiftType, string> = {
  manana: "bg-state-info/15 text-state-info border border-state-info/30",
  tarde: "bg-state-atencion/15 text-state-atencion border border-state-atencion/30",
};

// ── Week helpers ───────────────────────────────────────────────────────────

function getWeekDates(refDate: Date): Date[] {
  const d = new Date(refDate);
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(monday);
    dd.setDate(monday.getDate() + i);
    return dd;
  });
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

const DAY_LABELS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];

// ── Create shift modal (with inline worker assignment) ─────────────────────

function CreateShiftModal({
  prefillDate,
  prefillTipo,
  zones,
  employees,
  onClose,
}: {
  prefillDate?: string;
  prefillTipo?: ShiftType;
  zones: { id: string; nombre: string }[];
  employees: Employee[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const [fecha, setFecha] = useState(prefillDate ?? today);
  const [tipoTurno, setTipoTurno] = useState<ShiftType>(prefillTipo ?? "manana");
  const [notas, setNotas] = useState("");
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [zonaId, setZonaId] = useState("");

  const shiftMutation = useMutation({
    mutationFn: async (payload: CreateShiftPayload) => {
      const shift = await api.createShift(payload);
      // Also create assignments for selected employees
      for (const empId of selectedEmployees) {
        await api.createShiftAssignment({
          turno_id: shift.id,
          empleado_id: empId,
          zona_id: zonaId || null,
          rol: null,
        });
      }
      return shift;
    },
    onSuccess: () => {
      toast.success("Turno creado correctamente");
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      queryClient.invalidateQueries({ queryKey: ["shift-assignments"] });
      onClose();
    },
    onError: (err: Error) => toast.error(err.message || "Error al crear el turno"),
  });

  const hours = SHIFT_HOURS[tipoTurno];

  const toggleEmployee = (empId: string) => {
    setSelectedEmployees((prev) =>
      prev.includes(empId) ? prev.filter((e) => e !== empId) : [...prev, empId]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center">
      <div className="w-full max-w-lg rounded-t-[20px] border border-app-border bg-white shadow-panel sm:rounded-[14px]">
        <div className="flex items-center justify-between border-b border-app-border px-6 py-4">
          <h2 className="font-heading text-lg font-bold text-app-text">Nuevo turno</h2>
          <button type="button" onClick={onClose} className="text-app-dim hover:text-app-text">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[80vh] space-y-4 overflow-y-auto px-6 py-5">
          {/* Fecha + tipo */}
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.14em] text-app-dim">Fecha *</span>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="h-11 w-full rounded-[10px] border border-app-border bg-white px-3 text-sm text-app-text outline-none focus:border-brand"
              />
            </label>
            <div>
              <p className="mb-1.5 text-xs font-extrabold uppercase tracking-[0.14em] text-app-dim">Tipo *</p>
              <div className="grid grid-cols-2 gap-2">
                {(["manana", "tarde"] as ShiftType[]).map((tipo) => (
                  <button
                    key={tipo}
                    type="button"
                    onClick={() => setTipoTurno(tipo)}
                    className={`rounded-[10px] border-2 py-2.5 text-sm font-bold transition ${
                      tipoTurno === tipo ? SHIFT_CELL_STYLES[tipo] : "border-app-border text-app-dim hover:border-app-dim"
                    }`}
                  >
                    {SHIFT_TYPE_LABELS[tipo]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Hours display */}
          <div className="rounded-[10px] bg-app-bg px-4 py-2.5 text-sm text-app-dim">
            Horario: <span className="font-bold text-app-text">{hours.inicio} – {hours.fin}</span>
          </div>

          {/* Workers */}
          <div>
            <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.14em] text-app-dim">
              Trabajadores ({selectedEmployees.length} seleccionados)
            </p>
            <div className="max-h-40 overflow-y-auto space-y-1.5 rounded-[10px] border border-app-border p-2">
              {employees.map((emp) => {
                const selected = selectedEmployees.includes(emp.id);
                return (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => toggleEmployee(emp.id)}
                    className={`flex w-full items-center gap-2 rounded-[8px] px-3 py-2 text-left text-sm transition ${
                      selected ? "bg-brand/10 text-brand font-semibold" : "text-app-text hover:bg-app-bg"
                    }`}
                  >
                    <div className={`h-2 w-2 shrink-0 rounded-full ${selected ? "bg-brand" : "bg-app-border"}`} />
                    {emp.nombre} {emp.apellidos ?? ""}
                    <span className="ml-auto text-[11px] capitalize text-app-dim">{emp.role}</span>
                  </button>
                );
              })}
              {employees.length === 0 && <p className="py-4 text-center text-sm text-app-dim">Sin empleados</p>}
            </div>
          </div>

          {/* Zone */}
          <label className="block">
            <span className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.14em] text-app-dim">Zona (opcional)</span>
            <select
              value={zonaId}
              onChange={(e) => setZonaId(e.target.value)}
              className="h-11 w-full rounded-[10px] border border-app-border bg-white px-3 text-sm text-app-text outline-none focus:border-brand"
            >
              <option value="">Sin zona específica</option>
              {zones.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}
            </select>
          </label>

          {/* Notes */}
          <label className="block">
            <span className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.14em] text-app-dim">Notas</span>
            <textarea
              rows={2}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              className="w-full resize-none rounded-[10px] border border-app-border bg-white px-3 py-2.5 text-sm text-app-text outline-none focus:border-brand"
            />
          </label>

          {shiftMutation.isError && (
            <p className="rounded-[10px] bg-state-critica/10 px-3 py-2 text-sm text-state-critica">
              {shiftMutation.error.message}
            </p>
          )}

          <button
            type="button"
            disabled={!fecha || shiftMutation.isPending}
            onClick={() => shiftMutation.mutate({ fecha, tipo_turno: tipoTurno, hora_inicio: hours.inicio, hora_fin: hours.fin, notas: notas.trim() || null })}
            className="w-full rounded-[10px] bg-brand py-3.5 font-heading text-base font-bold text-white shadow-brand transition hover:bg-[#135532] disabled:opacity-50"
          >
            {shiftMutation.isPending ? "Creando..." : selectedEmployees.length > 0 ? `Crear turno con ${selectedEmployees.length} trabajador(es)` : "Crear turno"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Add employee to shift modal ────────────────────────────────────────────

function AddEmployeeModal({
  shift,
  zones,
  employees,
  onClose,
}: {
  shift: Shift;
  zones: { id: string; nombre: string }[];
  employees: Employee[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [empleadoId, setEmpleadoId] = useState("");
  const [zonaId, setZonaId] = useState("");

  const mutation = useMutation({
    mutationFn: (payload: CreateShiftAssignmentPayload) => api.createShiftAssignment(payload),
    onSuccess: () => {
      toast.success("Empleado asignado");
      queryClient.invalidateQueries({ queryKey: ["shift-assignments"] });
      onClose();
    },
    onError: (err: Error) => toast.error(err.message || "Error"),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center">
      <div className="w-full max-w-md rounded-t-[20px] border border-app-border bg-white shadow-panel sm:rounded-[14px]">
        <div className="flex items-center justify-between border-b border-app-border px-6 py-4">
          <div>
            <h2 className="font-heading text-base font-bold text-app-text">Asignar trabajador</h2>
            <p className="text-xs text-app-dim">{SHIFT_TYPE_LABELS[shift.tipo_turno]} · {shift.fecha}</p>
          </div>
          <button type="button" onClick={onClose} className="text-app-dim hover:text-app-text"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4 px-6 py-5">
          <label className="block">
            <span className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.14em] text-app-dim">Empleado *</span>
            <select value={empleadoId} onChange={(e) => setEmpleadoId(e.target.value)}
              className="h-11 w-full rounded-[10px] border border-app-border bg-white px-3 text-sm text-app-text outline-none focus:border-brand">
              <option value="">Seleccionar empleado</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.nombre} {e.apellidos ?? ""}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.14em] text-app-dim">Zona (opcional)</span>
            <select value={zonaId} onChange={(e) => setZonaId(e.target.value)}
              className="h-11 w-full rounded-[10px] border border-app-border bg-white px-3 text-sm text-app-text outline-none focus:border-brand">
              <option value="">Sin zona específica</option>
              {zones.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}
            </select>
          </label>
          <button
            type="button"
            disabled={!empleadoId || mutation.isPending}
            onClick={() => mutation.mutate({ turno_id: shift.id, empleado_id: empleadoId, zona_id: zonaId || null, rol: null })}
            className="w-full rounded-[10px] bg-brand py-3.5 font-heading text-base font-bold text-white shadow-brand transition hover:bg-[#135532] disabled:opacity-50"
          >
            {mutation.isPending ? "Asignando..." : "Asignar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Gantt view ─────────────────────────────────────────────────────────────

type GanttCell = { shiftId: string; tipo: ShiftType } | null;

function GanttView({
  weekDates,
  shifts,
  assignments,
  employees,
  zones,
  onAddShift,
  onAddEmployee,
}: {
  weekDates: Date[];
  shifts: Shift[];
  assignments: ShiftAssignment[];
  employees: Employee[];
  zones: { id: string; nombre: string }[];
  onAddShift: (date: string, tipo: ShiftType) => void;
  onAddEmployee: (shift: Shift) => void;
}) {
  const employeeMap = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);

  // Build lookup: date → tipo_turno → shift
  const shiftByDateType = useMemo(() => {
    const map = new Map<string, Map<ShiftType, Shift>>();
    for (const s of shifts) {
      if (!s.fecha) continue;
      if (!map.has(s.fecha)) map.set(s.fecha, new Map());
      map.get(s.fecha)!.set(s.tipo_turno, s);
    }
    return map;
  }, [shifts]);

  // Build lookup: shift_id → assignments
  const assignmentsByShift = useMemo(() => {
    const map = new Map<string, ShiftAssignment[]>();
    for (const a of assignments) {
      const arr = map.get(a.turno_id) ?? [];
      arr.push(a);
      map.set(a.turno_id, arr);
    }
    return map;
  }, [assignments]);

  // Collect all employee IDs that appear in any assignment for this week
  const weekShiftIds = new Set(shifts.map((s) => s.id));
  const weekEmployeeIds = useMemo(() => {
    const ids = new Set<string>();
    for (const a of assignments) {
      if (weekShiftIds.has(a.turno_id)) ids.add(a.empleado_id);
    }
    // Also include all active employees to allow adding
    for (const e of employees) ids.add(e.id);
    return [...ids];
  }, [assignments, employees, weekShiftIds]);

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="overflow-x-auto rounded-[14px] border border-app-border bg-white shadow-card">
      <table className="min-w-full table-fixed border-collapse">
        <thead>
          <tr className="border-b border-app-border bg-app-bg">
            <th className="sticky left-0 z-10 bg-app-bg py-3 pl-4 pr-3 text-left text-xs font-extrabold uppercase tracking-[0.14em] text-app-dim" style={{ minWidth: 140 }}>
              Empleado
            </th>
            {weekDates.map((d, i) => {
              const ds = isoDate(d);
              const isToday = ds === todayStr;
              return (
                <th
                  key={ds}
                  className={`py-3 text-center text-xs font-extrabold uppercase tracking-[0.1em] ${isToday ? "text-brand" : "text-app-dim"}`}
                  style={{ width: 90 }}
                >
                  <div>{DAY_LABELS[i]}</div>
                  <div className={`mt-0.5 font-heading text-base font-bold ${isToday ? "text-brand" : "text-app-text"}`}>
                    {d.getDate()}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {weekEmployeeIds.map((empId) => {
            const emp = employeeMap.get(empId);
            if (!emp) return null;
            return (
              <tr key={empId} className="border-b border-app-border/50 last:border-0 hover:bg-app-bg/40">
                <td className="sticky left-0 z-10 bg-white py-3 pl-4 pr-3 hover:bg-app-bg/40">
                  <div className="flex items-center gap-2">
                    <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-app-bg">
                      <UserRound className="h-3.5 w-3.5 text-app-dim" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-app-text">{emp.nombre} {emp.apellidos ?? ""}</p>
                      <p className="text-[11px] capitalize text-app-dim">{emp.role}</p>
                    </div>
                  </div>
                </td>
                {weekDates.map((d) => {
                  const ds = isoDate(d);
                  const dayShifts = shiftByDateType.get(ds);

                  // Find which shifts this employee is assigned to on this day
                  const mananaShift = dayShifts?.get("manana");
                  const tardeShift = dayShifts?.get("tarde");
                  const inManana = mananaShift ? (assignmentsByShift.get(mananaShift.id) ?? []).some((a) => a.empleado_id === empId) : false;
                  const inTarde = tardeShift ? (assignmentsByShift.get(tardeShift.id) ?? []).some((a) => a.empleado_id === empId) : false;

                  return (
                    <td key={ds} className="py-2 text-center">
                      <div className="flex flex-col items-center gap-1">
                        {inManana && (
                          <span className={`rounded-md px-2 py-1 text-[11px] font-bold ${SHIFT_CELL_STYLES.manana}`}>M</span>
                        )}
                        {inTarde && (
                          <span className={`rounded-md px-2 py-1 text-[11px] font-bold ${SHIFT_CELL_STYLES.tarde}`}>T</span>
                        )}
                        {!inManana && !inTarde && (
                          <span className="text-app-border text-xs">—</span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
          {weekEmployeeIds.length === 0 && (
            <tr>
              <td colSpan={8} className="py-12 text-center text-sm text-app-dim">
                Sin empleados asignados esta semana
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Day summary row */}
      <div className="border-t border-app-border bg-app-bg px-4 py-3">
        <div className="flex items-center gap-3 overflow-x-auto">
          <span className="shrink-0 text-xs font-extrabold uppercase tracking-[0.12em] text-app-dim">Turnos del día:</span>
          {weekDates.map((d) => {
            const ds = isoDate(d);
            const dayShifts = shiftByDateType.get(ds);
            const manana = dayShifts?.get("manana");
            const tarde = dayShifts?.get("tarde");
            const mananaCount = manana ? (assignmentsByShift.get(manana.id) ?? []).length : 0;
            const tardeCount = tarde ? (assignmentsByShift.get(tarde.id) ?? []).length : 0;
            return (
              <div key={ds} className="flex shrink-0 flex-col items-center gap-1">
                <span className="text-[11px] font-semibold text-app-dim">{d.getDate()}</span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => manana ? onAddEmployee(manana) : onAddShift(ds, "manana")}
                    className={`rounded px-1.5 py-0.5 text-[11px] font-bold transition ${manana ? SHIFT_CELL_STYLES.manana + " hover:opacity-80" : "border border-dashed border-app-border text-app-dim hover:border-state-info hover:text-state-info"}`}
                    title={manana ? `M: ${mananaCount} trabajador(es)` : "Crear turno mañana"}
                  >
                    M{manana ? ` ${mananaCount}` : "+"}
                  </button>
                  <button
                    type="button"
                    onClick={() => tarde ? onAddEmployee(tarde) : onAddShift(ds, "tarde")}
                    className={`rounded px-1.5 py-0.5 text-[11px] font-bold transition ${tarde ? SHIFT_CELL_STYLES.tarde + " hover:opacity-80" : "border border-dashed border-app-border text-app-dim hover:border-state-atencion hover:text-state-atencion"}`}
                    title={tarde ? `T: ${tardeCount} trabajador(es)` : "Crear turno tarde"}
                  >
                    T{tarde ? ` ${tardeCount}` : "+"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function ShiftsPage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [showCreate, setShowCreate] = useState<{ date?: string; tipo?: ShiftType } | null>(null);
  const [addToShift, setAddToShift] = useState<Shift | null>(null);

  const weekDates = useMemo(() => {
    const base = new Date();
    base.setDate(base.getDate() + weekOffset * 7);
    return getWeekDates(base);
  }, [weekOffset]);

  const weekStart = isoDate(weekDates[0]);
  const weekEnd = isoDate(weekDates[6]);

  const shiftsQuery = useQuery({
    queryKey: ["shifts", weekStart, weekEnd],
    queryFn: () => api.shifts({ limit: 500 }),
    staleTime: 30_000,
  });

  const assignmentsQuery = useQuery({
    queryKey: ["shift-assignments"],
    queryFn: () => api.shiftAssignments({ limit: 500 }),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const zonesQuery = useQuery({ queryKey: ["zones"], queryFn: api.zones, staleTime: 5 * 60_000 });
  const employeesQuery = useQuery({ queryKey: ["management-employees"], queryFn: () => api.employees(), staleTime: 5 * 60_000 });

  const assignableZones = useMemo(() => visualZoneOptions((zonesQuery.data ?? []) as Zone[]), [zonesQuery.data]);

  // Filter shifts for this week
  const weekShifts = useMemo(() => {
    return (shiftsQuery.data?.turnos ?? []).filter((s) => s.fecha != null && s.fecha >= weekStart && s.fecha <= weekEnd);
  }, [shiftsQuery.data, weekStart, weekEnd]);

  const weekAssignments = useMemo(() => {
    const weekShiftIds = new Set(weekShifts.map((s) => s.id));
    return (assignmentsQuery.data?.asignaciones ?? []).filter((a) => weekShiftIds.has(a.turno_id));
  }, [assignmentsQuery.data, weekShifts]);

  const todayShiftsCount = weekShifts.filter((s) => s.fecha === isoDate(new Date())).length;
  const totalAssignments = weekAssignments.length;

  const monthLabel = weekDates[0].toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  const weekRangeLabel = `${weekDates[0].getDate()} – ${weekDates[6].getDate()} de ${weekDates[6].toLocaleDateString("es-ES", { month: "long" })}`;

  return (
    <div className="min-h-full">
      {showCreate && (
        <CreateShiftModal
          prefillDate={showCreate.date}
          prefillTipo={showCreate.tipo}
          zones={assignableZones}
          employees={employeesQuery.data ?? []}
          onClose={() => setShowCreate(null)}
        />
      )}
      {addToShift && (
        <AddEmployeeModal
          shift={addToShift}
          zones={assignableZones}
          employees={employeesQuery.data ?? []}
          onClose={() => setAddToShift(null)}
        />
      )}

      <PageHeader eyebrow="Planificación de equipo" title="Turnos" EyebrowIcon={CalendarClock}>
        <div className="flex items-center gap-3">
          <Link
            href="/tv/shifts"
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-app-border bg-app-bg px-3 py-2 text-sm font-semibold text-app-dim transition hover:border-brand/30 hover:text-brand"
          >
            <Monitor className="h-4 w-4" />
            TV Turnos
          </Link>
          <button
            type="button"
            onClick={() => setShowCreate({})}
            className="inline-flex items-center gap-2 rounded-[10px] bg-brand px-4 py-2 text-sm font-bold text-white shadow-brand transition hover:bg-[#135532]"
          >
            <Plus className="h-4 w-4" />
            Nuevo turno
          </button>
        </div>
      </PageHeader>

      <div className="space-y-5 px-6 py-6 lg:px-8">
        {/* Week navigator */}
        <div className="flex items-center justify-between rounded-[14px] border border-app-border bg-white px-5 py-4 shadow-card">
          <button
            type="button"
            onClick={() => setWeekOffset((v) => v - 1)}
            className="rounded-[8px] border border-app-border p-2 text-app-dim transition hover:border-brand/30 hover:text-brand"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="text-center">
            <p className="font-heading text-base font-bold text-app-text">{weekRangeLabel}</p>
            <p className="text-xs capitalize text-app-dim">{monthLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            {weekOffset !== 0 && (
              <button
                type="button"
                onClick={() => setWeekOffset(0)}
                className="rounded-[8px] border border-app-border px-3 py-2 text-xs font-bold text-app-dim transition hover:text-brand"
              >
                Hoy
              </button>
            )}
            <button
              type="button"
              onClick={() => setWeekOffset((v) => v + 1)}
              className="rounded-[8px] border border-app-border p-2 text-app-dim transition hover:border-brand/30 hover:text-brand"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Turnos semana", value: weekShifts.length, tone: "text-app-text" },
            { label: "Mañana", value: weekShifts.filter((s) => s.tipo_turno === "manana").length, tone: "text-state-info" },
            { label: "Tarde", value: weekShifts.filter((s) => s.tipo_turno === "tarde").length, tone: "text-state-atencion" },
            { label: "Asignaciones", value: totalAssignments, tone: "text-brand" },
          ].map(({ label, value, tone }) => (
            <div key={label} className="rounded-[10px] border border-app-border bg-white p-4 shadow-card">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-app-dim">{label}</p>
              <p className={`mt-2 font-heading text-3xl font-bold ${tone}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className={`rounded px-2 py-0.5 font-bold ${SHIFT_CELL_STYLES.manana}`}>M</span>
            <span className="text-app-dim">Mañana 06:00–14:00</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`rounded px-2 py-0.5 font-bold ${SHIFT_CELL_STYLES.tarde}`}>T</span>
            <span className="text-app-dim">Tarde 16:00–00:00</span>
          </div>
          <span className="text-app-dim">Clic en M/T para asignar · Clic en M+/T+ para crear turno</span>
        </div>

        {/* Gantt */}
        {shiftsQuery.isLoading ? (
          <div className="h-64 animate-pulse rounded-[14px] bg-app-bg" />
        ) : (
          <GanttView
            weekDates={weekDates}
            shifts={weekShifts}
            assignments={weekAssignments}
            employees={employeesQuery.data ?? []}
            zones={assignableZones}
            onAddShift={(date, tipo) => setShowCreate({ date, tipo })}
            onAddEmployee={(shift) => setAddToShift(shift)}
          />
        )}
      </div>
    </div>
  );
}
