"use client";

import { AlertOctagon, User } from "lucide-react";
import type { Task, Employee } from "@/lib/types";

interface TaskCardProps {
  task: Task;
  assignedEmployee?: Employee;
  onClick?: () => void;
  showAssigned?: boolean;
  variant?: "planning" | "compact";
}

const stateColors = {
  programada: "bg-state-info/10 border-state-info/30 text-state-info",
  retrasada: "bg-state-critica/10 border-state-critica/30 text-state-critica",
  pausada: "bg-brand/10 border-brand/30 text-brand",
  ejecutada: "bg-state-ok/10 border-state-ok/30 text-state-ok",
  cancelada: "bg-app-bg border-app-border text-app-dim",
};

export function TaskCard({
  task,
  assignedEmployee,
  onClick,
  showAssigned = true,
  variant = "planning",
}: TaskCardProps) {
  const bgClass = stateColors[task.estado as keyof typeof stateColors] || stateColors.programada;
  const isCompact = variant === "compact";

  return (
    <div
      onClick={onClick}
      className={`rounded-[10px] border cursor-pointer transition hover:shadow-sm ${bgClass} ${
        isCompact ? "p-3" : "p-4"
      } ${!onClick && "cursor-default"}`}
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className={`font-semibold truncate ${isCompact ? "text-sm" : "text-base"}`}>
              {task.tarea_catalogo?.nombre ?? "Tarea"}
            </p>
            {task.zona_id && (
              <p className="text-xs text-app-dim mt-1">
                Zona: {task.zona_id}
              </p>
            )}
          </div>
          {task.estado === "retrasada" && (
            <AlertOctagon className="h-4 w-4 shrink-0" />
          )}
        </div>

        {!isCompact && (
          <div className="space-y-1 text-xs text-app-dim">
            {task.fecha_programada && (
              <p>
                {new Date(task.fecha_programada).toLocaleString("es-ES", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            )}
          </div>
        )}

        {showAssigned && (
          <div className="flex items-center gap-1 text-xs">
            <User className="h-3 w-3" />
            <span>{assignedEmployee ? `${assignedEmployee.nombre}` : "Sin asignar"}</span>
          </div>
        )}

        <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-app-dim">
          {task.estado}
        </div>
      </div>
    </div>
  );
}
