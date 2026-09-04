"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Play, CheckCircle2, MessageSquare, AlertOctagon } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import type { Task, Zone } from "@/lib/types";

function formatTime(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}


const TaskActionButton = ({
  icon: Icon,
  label,
  onClick,
  disabled,
  variant = "secondary",
}: {
  icon: typeof Plus;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
}) => {
  const baseClass = "flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-xs font-bold transition";
  const variantClass = {
    primary: "bg-state-ok/10 text-state-ok hover:bg-state-ok/20",
    secondary: "bg-brand/10 text-brand hover:bg-brand/20",
    danger: "bg-state-critica/10 text-state-critica hover:bg-state-critica/20",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${baseClass} ${variantClass[variant]} disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
};

function TaskRow({
  task,
  onStart,
  onCreateIncident,
  onComplete,
  onAddNote,
  canStart,
  section,
}: {
  task: Task;
  onStart: (taskId: string) => void;
  onCreateIncident: (taskId: string) => void;
  onComplete: (taskId: string) => void;
  onAddNote: (taskId: string) => void;
  canStart: boolean;
  section: "pending" | "inProgress";
}) {
  return (
    <div className="rounded-[10px] border border-app-border bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="font-bold text-app-text">{task.tarea_catalogo?.nombre ?? "Tarea"}</p>
          <p className="mt-1 text-xs text-app-dim">
            {formatTime(task.fecha_programada)} · {task.estado}
          </p>
          {task.observaciones && <p className="mt-2 text-xs text-app-dim">{task.observaciones}</p>}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {section === "pending" && (
          <TaskActionButton
            icon={Play}
            label="Empezar"
            onClick={() => onStart(task.id)}
            disabled={!canStart}
            variant="primary"
          />
        )}

        {section === "inProgress" && (
          <>
            <TaskActionButton
              icon={AlertOctagon}
              label="Incidencia"
              onClick={() => onCreateIncident(task.id)}
              variant="danger"
            />
            <TaskActionButton
              icon={MessageSquare}
              label="Nota"
              onClick={() => onAddNote(task.id)}
            />
            <TaskActionButton
              icon={CheckCircle2}
              label="Finalizar"
              onClick={() => onComplete(task.id)}
              variant="primary"
            />
          </>
        )}
      </div>
    </div>
  );
}

export function ZoneTabletView({
  tasks,
  zones,
  zoneKey,
  canStartTasks,
  onCreateIncident,
  onShowTreatment,
}: {
  tasks: Task[];
  zones: Zone[];
  zoneKey: "recria" | "nave";
  canStartTasks: boolean;
  onCreateIncident: () => void;
  onShowTreatment: () => void;
}) {
  const queryClient = useQueryClient();
  const [selectedTaskForNote, setSelectedTaskForNote] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

  const startTaskMutation = useMutation({
    mutationFn: (taskId: string) =>
      api.updateTask(taskId, {
        estado: "pausada",
      } as Parameters<typeof api.updateTask>[1]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["zone-tasks"] });
    },
  });

  const completeTaskMutation = useMutation({
    mutationFn: (taskId: string) =>
      api.updateTask(taskId, {
        estado: "ejecutada",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["zone-tasks"] });
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: (taskId: string) =>
      api.updateTask(taskId, {
        observaciones: noteText,
      } as Parameters<typeof api.updateTask>[1]),
    onSuccess: () => {
      setSelectedTaskForNote(null);
      setNoteText("");
      queryClient.invalidateQueries({ queryKey: ["zone-tasks"] });
    },
  });

  const pendingTasks = tasks.filter((t) => t.estado === "programada" || t.estado === "retrasada");
  const inProgressTasks = tasks.filter((t) => t.estado === "pausada");
  const completedTasks = tasks.filter((t) => t.estado === "ejecutada");

  const showTreatmentSection = zoneKey === "recria";

  return (
    <div className="space-y-5">
      {/* Action Buttons */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <button
          type="button"
          onClick={onCreateIncident}
          className="flex min-h-[92px] flex-col items-center justify-center gap-2 rounded-[14px] border border-app-border bg-white font-bold text-state-atencion shadow-card hover:border-state-atencion/50 transition"
        >
          <Plus className="h-7 w-7" />
          Nueva incidencia
        </button>

        {showTreatmentSection && (
          <button
            type="button"
            onClick={onShowTreatment}
            className="flex min-h-[92px] flex-col items-center justify-center gap-2 rounded-[14px] border border-app-border bg-white font-bold text-brand shadow-card hover:border-brand/50 transition"
          >
            <Plus className="h-7 w-7" />
            Nuevo tratamiento
          </button>
        )}

        <div className="flex min-h-[92px] flex-col items-center justify-center gap-2 rounded-[14px] border border-app-border bg-white text-center text-xs font-semibold text-app-dim shadow-card">
          <span>Tareas totales</span>
          <span className="font-heading text-2xl font-bold text-app-text">{tasks.length}</span>
        </div>
      </div>

      {/* Pending Tasks */}
      <div>
        <h3 className="mb-3 font-heading text-base font-bold text-app-text">
          Tareas pendientes {pendingTasks.length > 0 && <span className="text-state-info">({pendingTasks.length})</span>}
        </h3>
        {pendingTasks.length === 0 ? (
          <p className="rounded-[10px] border border-dashed border-app-border bg-app-bg py-8 text-center text-sm text-app-dim">
            Sin tareas pendientes
          </p>
        ) : (
          <div className="space-y-3">
            {pendingTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onStart={() => startTaskMutation.mutate(task.id)}
                onCreateIncident={onCreateIncident}
                onComplete={() => completeTaskMutation.mutate(task.id)}
                onAddNote={() => setSelectedTaskForNote(task.id)}
                canStart={canStartTasks}
                section="pending"
              />
            ))}
          </div>
        )}
      </div>

      {/* In Progress Tasks */}
      <div>
        <h3 className="mb-3 font-heading text-base font-bold text-app-text">
          Tareas en curso {inProgressTasks.length > 0 && <span className="text-brand">({inProgressTasks.length})</span>}
        </h3>
        {inProgressTasks.length === 0 ? (
          <p className="rounded-[10px] border border-dashed border-app-border bg-app-bg py-8 text-center text-sm text-app-dim">
            Sin tareas en curso
          </p>
        ) : (
          <div className="space-y-3">
            {inProgressTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onStart={() => startTaskMutation.mutate(task.id)}
                onCreateIncident={onCreateIncident}
                onComplete={() => completeTaskMutation.mutate(task.id)}
                onAddNote={() => setSelectedTaskForNote(task.id)}
                canStart={false}
                section="inProgress"
              />
            ))}
          </div>
        )}
      </div>

      {/* Note Modal */}
      {selectedTaskForNote && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-[14px] bg-white shadow-panel">
            <div className="border-b border-app-border px-5 py-4">
              <h2 className="font-heading text-lg font-bold text-app-text">Añadir observación</h2>
            </div>
            <div className="space-y-4 p-5">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Describe lo que observaste..."
                rows={4}
                className="w-full resize-none rounded-[10px] border border-app-border px-3 py-2 text-sm"
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTaskForNote(null);
                    setNoteText("");
                  }}
                  className="flex-1 rounded-[10px] border border-app-border px-4 py-2 text-sm font-bold text-app-text transition hover:bg-app-bg"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => addNoteMutation.mutate(selectedTaskForNote)}
                  disabled={!noteText.trim() || addNoteMutation.isPending}
                  className="flex-1 rounded-[10px] bg-brand px-4 py-2 text-sm font-bold text-white transition hover:bg-brand/90 disabled:opacity-50"
                >
                  {addNoteMutation.isPending ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
