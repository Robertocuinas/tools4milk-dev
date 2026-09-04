"use client";

import type { Incident, Task } from "@/lib/types";

function formatTime(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
  });
}

const TaskCard = ({ task, hasIncident }: { task: Task; hasIncident: boolean }) => {
  const bgClass = hasIncident ? "border-state-critica/50 bg-state-critica/10" : "border-app-border bg-white";

  return (
    <div className={`rounded-[10px] border p-4 shadow-sm ${bgClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-bold text-app-text">{task.tarea_catalogo?.nombre ?? "Tarea"}</p>
          <p className="mt-1 text-xs text-app-dim">{formatTime(task.fecha_programada)}</p>
          {task.observaciones && <p className="mt-2 text-xs leading-relaxed text-app-text">{task.observaciones}</p>}
        </div>
        {hasIncident && (
          <div className="shrink-0 rounded-full bg-state-critica/20 px-2 py-1">
            <span className="text-[10px] font-bold uppercase text-state-critica">⚠️ Incidencia</span>
          </div>
        )}
      </div>
    </div>
  );
};

const KanbanColumn = ({
  title,
  tasks,
  incidents,
  isEmpty,
}: {
  title: string;
  tasks: Task[];
  incidents: Incident[];
  isEmpty: boolean;
}) => {
  const taskIncidentMap = new Set(
    incidents.map((i) => {
      // Try to extract task ID from description or metadata
      return i.descripcion?.includes("Tarea:") ? i.descripcion.split("Tarea:")[1]?.trim() : null;
    })
  );

  return (
    <div className="flex flex-col gap-3 rounded-[14px] border border-app-border bg-white p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-base font-bold text-app-text">{title}</h3>
        <span className="rounded-full bg-app-bg px-3 py-1 text-sm font-bold text-app-dim">{tasks.length}</span>
      </div>

      {isEmpty ? (
        <p className="rounded-[10px] border border-dashed border-app-border bg-app-bg py-8 text-center text-sm text-app-dim">
          Sin tareas
        </p>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} hasIncident={taskIncidentMap.has(task.id)} />
          ))}
        </div>
      )}
    </div>
  );
};

export function ZoneKanbanView({
  tasks,
  incidents,
}: {
  tasks: Task[];
  incidents: Incident[];
}) {
  // Sort tasks by priority (if field exists), then by scheduled time
  const sortedTasks = [...tasks].sort((a, b) => {
    const aTime = new Date(a.fecha_programada || 0).getTime();
    const bTime = new Date(b.fecha_programada || 0).getTime();
    return aTime - bTime;
  });

  const pendingTasks = sortedTasks.filter((t) => t.estado === "programada" || t.estado === "retrasada");
  const inProgressTasks = sortedTasks.filter((t) => t.estado === "pausada");
  const completedTasks = sortedTasks.filter((t) => t.estado === "ejecutada");

  return (
    <div className="space-y-5">
      <div className="rounded-[10px] border border-state-info/30 bg-state-info/5 px-4 py-3 text-xs font-semibold text-state-info">
        Tablero Kanban del turno actual: visualiza el estado de las tareas en tiempo real.
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <KanbanColumn
          title="Tareas pendientes"
          tasks={pendingTasks}
          incidents={incidents}
          isEmpty={pendingTasks.length === 0}
        />
        <KanbanColumn
          title="En curso"
          tasks={inProgressTasks}
          incidents={incidents}
          isEmpty={inProgressTasks.length === 0}
        />
        <KanbanColumn
          title="Finalizadas"
          tasks={completedTasks}
          incidents={incidents}
          isEmpty={completedTasks.length === 0}
        />
      </div>
    </div>
  );
}
