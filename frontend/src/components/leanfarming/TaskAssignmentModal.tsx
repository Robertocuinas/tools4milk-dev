"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import type { Task, Employee, Zone } from "@/lib/types";

interface TaskAssignmentModalProps {
  task: Task;
  employees: Employee[];
  zones: Zone[];
  onAssign: (employeeId: string) => void;
  onClose: () => void;
}

interface EmployeeOption {
  employee: Employee;
  compatible: boolean;
  reason?: string;
}

export function TaskAssignmentModal({
  task,
  employees,
  zones,
  onAssign,
  onClose,
}: TaskAssignmentModalProps) {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  const zone = zones.find((z) => z.id === task.zona_id);

  // Rank employees by compatibility
  const employeeOptions = useMemo<EmployeeOption[]>(() => {
    return employees
      .map((emp) => {
        // Simple compatibility logic:
        // Compatible if no zona_principal_id restriction, or it matches task's zone
        const compatible = !emp.zona_principal_id || emp.zona_principal_id === task.zona_id;
        const reason = !compatible ? "Zona no coincide" : undefined;

        return {
          employee: emp,
          compatible,
          reason,
        };
      })
      .sort((a, b) => {
        // Sort compatible first
        if (a.compatible !== b.compatible) {
          return a.compatible ? -1 : 1;
        }
        return a.employee.nombre.localeCompare(b.employee.nombre);
      });
  }, [employees, task.zona_id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-[14px] bg-white shadow-panel">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-app-border px-5 py-4">
          <h2 className="font-heading text-lg font-bold text-app-text">Asignar tarea</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-app-dim hover:text-app-text"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4 p-5">
          {/* Task details */}
          <div className="rounded-[10px] bg-app-bg p-3">
            <p className="text-xs font-semibold uppercase text-app-dim mb-1">Tarea</p>
            <p className="font-bold text-app-text">{task.tarea_catalogo?.nombre ?? "Tarea"}</p>
            {zone && (
              <p className="text-xs text-app-dim mt-1">Zona: {zone.nombre}</p>
            )}
          </div>

          {/* Employee selector */}
          <div>
            <label className="text-xs font-semibold uppercase text-app-dim mb-2 block">
              Asignar a
            </label>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {employeeOptions.map(({ employee, compatible, reason }) => (
                <button
                  key={employee.id}
                  type="button"
                  onClick={() => setSelectedEmployeeId(employee.id)}
                  disabled={!compatible}
                  className={`w-full text-left rounded-[10px] border p-3 transition ${
                    selectedEmployeeId === employee.id
                      ? "border-brand bg-brand/10"
                      : "border-app-border bg-white hover:border-app-border/70"
                  } ${!compatible && "opacity-50 cursor-not-allowed"}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-app-text">{employee.nombre}</p>
                      <p className="text-xs text-app-dim">{employee.role || "—"}</p>
                    </div>
                    {!compatible && (
                      <span className="text-[10px] font-bold text-state-critica">
                        {reason}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-[10px] border border-app-border px-4 py-2 text-sm font-bold text-app-text transition hover:bg-app-bg"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                if (selectedEmployeeId) {
                  onAssign(selectedEmployeeId);
                }
              }}
              disabled={!selectedEmployeeId}
              className="flex-1 rounded-[10px] bg-brand px-4 py-2 text-sm font-bold text-white transition hover:bg-brand/90 disabled:opacity-50"
            >
              Asignar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
