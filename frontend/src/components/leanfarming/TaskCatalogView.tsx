"use client";

import { useState } from "react";
import { Edit2, Plus, Trash2 } from "lucide-react";
import type { Zone } from "@/lib/types";

interface TaskCatalog {
  id: string;
  nombre: string;
  descripcion?: string | null;
  zona_id?: string | null;
  duracion_estimada?: number | null;
  rol_requerido?: string | null;
  activa?: boolean;
}

interface TaskCatalogViewProps {
  catalog: TaskCatalog[];
  zones: Zone[];
  onCreateTask: (task: Partial<TaskCatalog>) => void;
  onUpdateTask: (id: string, updates: Partial<TaskCatalog>) => void;
  onDeleteTask: (id: string) => void;
}

interface EditingTask {
  id?: string;
  nombre: string;
  descripcion: string;
  zona_id: string;
  duracion_estimada: number;
  rol_requerido: string;
  activa: boolean;
}

export function TaskCatalogView({
  catalog,
  zones,
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
}: TaskCatalogViewProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EditingTask>({
    nombre: "",
    descripcion: "",
    zona_id: zones[0]?.id ?? "",
    duracion_estimada: 60,
    rol_requerido: "",
    activa: true,
  });

  const handleSave = () => {
    if (!form.nombre.trim()) return;

    if (form.id) {
      onUpdateTask(form.id, form);
    } else {
      onCreateTask(form);
    }

    setForm({
      nombre: "",
      descripcion: "",
      zona_id: zones[0]?.id ?? "",
      duracion_estimada: 60,
      rol_requerido: "",
      activa: true,
    });
    setIsCreating(false);
    setEditingId(null);
  };

  const handleEdit = (task: TaskCatalog) => {
    setForm({
      id: task.id,
      nombre: task.nombre,
      descripcion: task.descripcion ?? "",
      zona_id: task.zona_id ?? "",
      duracion_estimada: task.duracion_estimada ?? 60,
      rol_requerido: task.rol_requerido ?? "",
      activa: task.activa ?? true,
    });
    setEditingId(task.id);
    setIsCreating(true);
  };

  const handleCancel = () => {
    setForm({
      nombre: "",
      descripcion: "",
      zona_id: zones[0]?.id ?? "",
      duracion_estimada: 60,
      rol_requerido: "",
      activa: true,
    });
    setIsCreating(false);
    setEditingId(null);
  };

  const getZoneName = (id?: string | null) => zones.find((z) => z.id === id)?.nombre ?? "—";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl font-bold text-app-text">
          Catálogo de Tareas
        </h2>
        {!isCreating && (
          <button
            onClick={() => {
              setForm({
                nombre: "",
                descripcion: "",
                zona_id: zones[0]?.id ?? "",
                duracion_estimada: 60,
                rol_requerido: "",
                activa: true,
              });
              setEditingId(null);
              setIsCreating(true);
            }}
            className="flex items-center gap-2 rounded-[10px] bg-brand px-4 py-2 text-sm font-bold text-white transition hover:bg-brand/90"
          >
            <Plus className="h-4 w-4" />
            Nueva tarea
          </button>
        )}
      </div>

      {/* Create/Edit form */}
      {isCreating && (
        <div className="rounded-[10px] border border-brand bg-brand/5 p-4 space-y-4">
          <h3 className="font-bold text-app-text">
            {editingId ? "Editar tarea" : "Nueva tarea de catálogo"}
          </h3>

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase text-app-dim mb-2 block">
                Nombre *
              </label>
              <input
                type="text"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Ej: Revisar tratamientos"
                className="w-full rounded-[10px] border border-app-border px-3 py-2 text-sm bg-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-app-dim mb-2 block">
                Zona
              </label>
              <select
                value={form.zona_id}
                onChange={(e) => setForm({ ...form, zona_id: e.target.value })}
                className="w-full rounded-[10px] border border-app-border px-3 py-2 text-sm bg-white"
              >
                {zones.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-app-dim mb-2 block">
                Rol requerido
              </label>
              <input
                type="text"
                value={form.rol_requerido}
                onChange={(e) => setForm({ ...form, rol_requerido: e.target.value })}
                placeholder="Ej: veterinario"
                className="w-full rounded-[10px] border border-app-border px-3 py-2 text-sm bg-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-app-dim mb-2 block">
                Duración estimada (min)
              </label>
              <input
                type="number"
                min="1"
                value={form.duracion_estimada}
                onChange={(e) =>
                  setForm({ ...form, duracion_estimada: parseInt(e.target.value) || 60 })
                }
                className="w-full rounded-[10px] border border-app-border px-3 py-2 text-sm bg-white"
              />
            </div>

            <div className="lg:col-span-2">
              <label className="text-xs font-semibold uppercase text-app-dim mb-2 block">
                Descripción
              </label>
              <textarea
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                placeholder="Detalles de la tarea..."
                rows={3}
                className="w-full rounded-[10px] border border-app-border px-3 py-2 text-sm bg-white"
              />
            </div>

            <div className="lg:col-span-2 flex items-center gap-2">
              <input
                type="checkbox"
                id="activa"
                checked={form.activa}
                onChange={(e) => setForm({ ...form, activa: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="activa" className="text-sm font-semibold text-app-text">
                Tarea activa
              </label>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={!form.nombre.trim()}
              className="flex-1 rounded-[10px] bg-brand px-4 py-2 text-sm font-bold text-white transition hover:bg-brand/90 disabled:opacity-50"
            >
              Guardar
            </button>
            <button
              onClick={handleCancel}
              className="flex-1 rounded-[10px] border border-app-border px-4 py-2 text-sm font-bold text-app-text transition hover:bg-app-bg"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Tasks table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-app-border">
              <th className="text-left px-4 py-3 font-bold text-app-dim">Nombre</th>
              <th className="text-left px-4 py-3 font-bold text-app-dim">Zona</th>
              <th className="text-left px-4 py-3 font-bold text-app-dim">Rol</th>
              <th className="text-left px-4 py-3 font-bold text-app-dim">Duración</th>
              <th className="text-left px-4 py-3 font-bold text-app-dim">Estado</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {catalog.map((task) => (
              <tr key={task.id} className="border-b border-app-border hover:bg-app-bg/50">
                <td className="px-4 py-3 font-semibold text-app-text">{task.nombre}</td>
                <td className="px-4 py-3 text-app-dim">{getZoneName(task.zona_id)}</td>
                <td className="px-4 py-3 text-app-dim">{task.rol_requerido || "—"}</td>
                <td className="px-4 py-3 text-app-dim">{task.duracion_estimada || 60} min</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${
                      task.activa
                        ? "bg-state-ok/10 text-state-ok"
                        : "bg-app-bg text-app-dim"
                    }`}
                  >
                    {task.activa ? "Activa" : "Inactiva"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(task)}
                      className="text-app-dim hover:text-brand transition"
                      title="Editar"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onDeleteTask(task.id)}
                      className="text-app-dim hover:text-state-critica transition"
                      title="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {catalog.length === 0 && (
          <div className="text-sm text-app-dim text-center py-8">
            Sin tareas en el catálogo
          </div>
        )}
      </div>
    </div>
  );
}
