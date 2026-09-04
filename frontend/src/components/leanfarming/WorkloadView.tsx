"use client";

import { useMemo } from "react";
import { AlertCircle } from "lucide-react";
import type { Task, Zone, Employee } from "@/lib/types";

interface WorkloadViewProps {
  tasks: Task[];
  zones: Zone[];
  employees: Employee[];
}

interface EmployeeWorkload {
  employee: Employee;
  assignedCount: number;
  completedCount: number;
  totalCount: number;
  percentComplete: number;
  percentLoad: number;
}

interface ZoneWorkload {
  zone: Zone;
  assignedCount: number;
  completedCount: number;
  totalCount: number;
  percentComplete: number;
}

function getStatusColor(percent: number) {
  if (percent >= 80) return "text-state-critica";
  if (percent >= 60) return "text-state-atencion";
  return "text-state-ok";
}

function getBackgroundColor(percent: number) {
  if (percent >= 80) return "bg-state-critica/10";
  if (percent >= 60) return "bg-state-atencion/10";
  return "bg-state-ok/10";
}

export function WorkloadView({
  tasks,
  zones,
  employees,
}: WorkloadViewProps) {
  // Calculate employee workload
  const employeeWorkloads = useMemo<EmployeeWorkload[]>(() => {
    return employees.map((emp) => {
      const empTasks = tasks.filter((t) => t.empleado_id === emp.id);
      const completed = empTasks.filter((t) => t.estado === "ejecutada").length;
      const total = empTasks.length;
      const percentComplete = total > 0 ? Math.round((completed / total) * 100) : 0;
      const percentLoad = Math.min(100, Math.round((total / 10) * 100)); // Assume max 10 tasks

      return {
        employee: emp,
        assignedCount: total,
        completedCount: completed,
        totalCount: total,
        percentComplete,
        percentLoad,
      };
    });
  }, [tasks, employees]);

  // Calculate zone workload
  const zoneWorkloads = useMemo<ZoneWorkload[]>(() => {
    return zones.map((zone) => {
      const zoneTasks = tasks.filter((t) => t.zona_id === zone.id);
      const completed = zoneTasks.filter((t) => t.estado === "ejecutada").length;
      const assigned = zoneTasks.filter((t) => t.empleado_id).length;
      const total = zoneTasks.length;
      const percentComplete = total > 0 ? Math.round((completed / total) * 100) : 0;

      return {
        zone,
        assignedCount: assigned,
        completedCount: completed,
        totalCount: total,
        percentComplete,
      };
    });
  }, [tasks, zones]);

  const sortedEmployees = [...employeeWorkloads].sort(
    (a, b) => b.percentLoad - a.percentLoad
  );

  return (
    <div className="space-y-8">
      {/* Employee workload */}
      <div>
        <h2 className="font-heading text-xl font-bold text-app-text mb-4">
          Carga de Trabajo por Trabajador
        </h2>
        <div className="grid gap-3">
          {sortedEmployees.map(({ employee, assignedCount, completedCount, percentLoad }) => (
            <div
              key={employee.id}
              className={`rounded-[10px] border border-app-border p-4 ${getBackgroundColor(percentLoad)}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex-1">
                  <p className="font-semibold text-app-text">{employee.nombre}</p>
                  <p className="text-xs text-app-dim">{employee.role || "—"}</p>
                </div>
                <div className="text-right">
                  <p className={`font-bold text-lg ${getStatusColor(percentLoad)}`}>
                    {percentLoad}%
                  </p>
                  <p className="text-xs text-app-dim">
                    {completedCount}/{assignedCount} tareas
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-white rounded-full h-2 border border-app-border/30 overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    percentLoad >= 80
                      ? "bg-state-critica"
                      : percentLoad >= 60
                        ? "bg-state-atencion"
                        : "bg-state-ok"
                  }`}
                  style={{ width: `${percentLoad}%` }}
                />
              </div>

              {percentLoad >= 80 && (
                <div className="flex items-center gap-2 mt-2">
                  <AlertCircle className="h-3 w-3 text-state-critica shrink-0" />
                  <p className="text-xs font-semibold text-state-critica">Sobrecargado</p>
                </div>
              )}
            </div>
          ))}

          {sortedEmployees.length === 0 && (
            <p className="text-sm text-app-dim text-center py-8">
              Sin empleados registrados
            </p>
          )}
        </div>
      </div>

      {/* Zone workload */}
      <div>
        <h2 className="font-heading text-xl font-bold text-app-text mb-4">
          Carga de Trabajo por Zona
        </h2>
        <div className="grid gap-3 lg:grid-cols-2">
          {zoneWorkloads.map(
            ({ zone, assignedCount, completedCount, totalCount, percentComplete }) => (
              <div
                key={zone.id}
                className={`rounded-[10px] border border-app-border p-4 ${getBackgroundColor(percentComplete)}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-semibold text-app-text">{zone.nombre}</p>
                    <p className="text-xs text-app-dim">
                      {assignedCount} asignadas / {totalCount} total
                    </p>
                  </div>
                  <p className={`font-bold text-lg ${getStatusColor(percentComplete)}`}>
                    {percentComplete}%
                  </p>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-white rounded-full h-2 border border-app-border/30 overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      percentComplete >= 80
                        ? "bg-state-critica"
                        : percentComplete >= 60
                          ? "bg-state-atencion"
                          : "bg-state-ok"
                    }`}
                    style={{ width: `${percentComplete}%` }}
                  />
                </div>

                {/* Stats */}
                <div className="flex gap-4 mt-3 text-xs">
                  <div>
                    <p className="text-app-dim">Completadas</p>
                    <p className="font-semibold text-app-text">{completedCount}</p>
                  </div>
                  <div>
                    <p className="text-app-dim">Pendientes</p>
                    <p className="font-semibold text-app-text">
                      {totalCount - completedCount}
                    </p>
                  </div>
                </div>
              </div>
            )
          )}

          {zoneWorkloads.length === 0 && (
            <p className="text-sm text-app-dim text-center py-8 lg:col-span-2">
              Sin zonas registradas
            </p>
          )}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 pt-4 border-t border-app-border">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase text-app-dim mb-1">
            Total tareas
          </p>
          <p className="text-2xl font-bold text-app-text">{tasks.length}</p>
        </div>
        <div className="text-center">
          <p className="text-xs font-semibold uppercase text-app-dim mb-1">
            Asignadas
          </p>
          <p className="text-2xl font-bold text-brand">
            {tasks.filter((t) => t.empleado_id).length}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs font-semibold uppercase text-app-dim mb-1">
            En curso
          </p>
          <p className="text-2xl font-bold text-state-atencion">
            {tasks.filter((t) => t.estado === "pausada").length}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs font-semibold uppercase text-app-dim mb-1">
            Completadas
          </p>
          <p className="text-2xl font-bold text-state-ok">
            {tasks.filter((t) => t.estado === "ejecutada").length}
          </p>
        </div>
      </div>
    </div>
  );
}
