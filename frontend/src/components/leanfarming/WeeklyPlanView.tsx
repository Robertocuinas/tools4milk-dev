"use client";

import { useState, useMemo } from "react";
import type { Task, Zone, Shift, Employee } from "@/lib/types";
import { TaskCard } from "./TaskCard";
import { TaskAssignmentModal } from "./TaskAssignmentModal";

const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const SHIFT_TYPES = {
  manana: "Mañana",
  tarde: "Tarde",
  noche: "Noche/Guardia",
};

interface WeeklyPlanViewProps {
  tasks: Task[];
  zones: Zone[];
  shifts: Shift[];
  employees: Employee[];
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void;
}

interface TasksGrid {
  [dayIndex: number]: {
    [shiftType: string]: Task[];
  };
}

export function WeeklyPlanView({
  tasks,
  zones,
  employees,
  onTaskUpdate,
}: WeeklyPlanViewProps) {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedZoneFilter, setSelectedZoneFilter] = useState<string | "all">("all");
  const [selectedStateFilter, setSelectedStateFilter] = useState<string | "all">("all");

  // Build tasks grid by day and shift
  const tasksGrid = useMemo(() => {
    const grid: TasksGrid = {};

    for (let day = 0; day < 7; day++) {
      grid[day] = { manana: [], tarde: [], noche: [] };
    }

    tasks.forEach((task) => {
      if (!task.fecha_programada) return;

      // Filter by zone
      if (selectedZoneFilter !== "all" && task.zona_id !== selectedZoneFilter) return;

      // Filter by state
      if (selectedStateFilter !== "all" && task.estado !== selectedStateFilter) return;

      const date = new Date(task.fecha_programada);
      const dayOfWeek = date.getDay();
      const dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

      const hour = date.getHours();
      let shiftType = "tarde";
      if (hour < 14) shiftType = "manana";
      else if (hour >= 22 || hour < 6) shiftType = "noche";

      grid[dayIndex][shiftType].push(task);
    });

    return grid;
  }, [tasks, selectedZoneFilter, selectedStateFilter]);

  const unassignedTasks = tasks.filter(
    (t) =>
      !t.empleado_id &&
      (selectedZoneFilter === "all" || t.zona_id === selectedZoneFilter) &&
      (selectedStateFilter === "all" || t.estado === selectedStateFilter)
  );

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div>
          <label className="text-xs font-semibold uppercase text-app-dim mb-2 block">
            Zona
          </label>
          <select
            value={selectedZoneFilter}
            onChange={(e) => setSelectedZoneFilter(e.target.value)}
            className="rounded-[10px] border border-app-border px-3 py-2 text-sm bg-white"
          >
            <option value="all">Todas</option>
            {zones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase text-app-dim mb-2 block">
            Estado
          </label>
          <select
            value={selectedStateFilter}
            onChange={(e) => setSelectedStateFilter(e.target.value)}
            className="rounded-[10px] border border-app-border px-3 py-2 text-sm bg-white"
          >
            <option value="all">Todos</option>
            <option value="programada">Programada</option>
            <option value="retrasada">Retrasada</option>
            <option value="pausada">En curso</option>
            <option value="ejecutada">Finalizada</option>
          </select>
        </div>
      </div>

      {/* Tareas sin asignar */}
      {unassignedTasks.length > 0 && (
        <div className="rounded-[10px] border border-state-atencion/30 bg-state-atencion/5 p-4">
          <h3 className="font-bold text-state-atencion mb-3">
            {unassignedTasks.length} tarea{unassignedTasks.length !== 1 ? "s" : ""} sin asignar
          </h3>
          <div className="grid gap-2 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {unassignedTasks.slice(0, 8).map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onClick={() => setSelectedTask(task)}
                variant="compact"
              />
            ))}
          </div>
        </div>
      )}

      {/* Weekly grid */}
      <div className="overflow-x-auto">
        <div className="grid gap-2" style={{ gridTemplateColumns: "120px repeat(7, 1fr)" }}>
          {/* Header - days */}
          <div className="font-bold text-sm text-app-dim">Turno</div>
          {DAYS.map((day) => (
            <div key={day} className="text-center font-bold text-sm text-app-text">
              {day}
            </div>
          ))}

          {/* Rows - shifts */}
          {Object.entries(SHIFT_TYPES).map(([shiftKey, shiftLabel]) => (
            <div key={shiftKey} className="contents">
              <div className="text-xs font-semibold text-app-dim pt-2">
                {shiftLabel}
              </div>
              {Array.from({ length: 7 }).map((_, dayIndex) => (
                <div
                  key={`${shiftKey}-${dayIndex}`}
                  className="rounded-[10px] border border-app-border bg-white p-2 min-h-[150px] space-y-1"
                >
                  {tasksGrid[dayIndex][shiftKey as keyof typeof SHIFT_TYPES].map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onClick={() => setSelectedTask(task)}
                      variant="compact"
                      showAssigned={false}
                    />
                  ))}
                  {tasksGrid[dayIndex][shiftKey as keyof typeof SHIFT_TYPES].length === 0 && (
                    <div className="text-xs text-app-dim text-center py-2">—</div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Assignment modal */}
      {selectedTask && (
        <TaskAssignmentModal
          task={selectedTask}
          employees={employees}
          zones={zones}
          onAssign={(employeeId) => {
            onTaskUpdate(selectedTask.id, { empleado_id: employeeId });
            setSelectedTask(null);
          }}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </div>
  );
}
