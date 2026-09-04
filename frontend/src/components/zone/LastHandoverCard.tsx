"use client";

import { Check } from "lucide-react";
import type { ShiftHandover } from "@/lib/types";

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getHandoverMarkedAsRead(handoverId: string): boolean {
  if (typeof window === "undefined") return false;
  const key = `handover_read_${handoverId}`;
  return localStorage.getItem(key) === "true";
}

function markHandoverAsRead(handoverId: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem(`handover_read_${handoverId}`, "true");
  }
}

export function LastHandoverCard({
  handover,
  onMarkAsRead,
  readOnly = false,
}: {
  handover: ShiftHandover;
  onMarkAsRead: () => void;
  readOnly?: boolean;
}) {
  // Check localStorage regardless of readOnly — all modes should hide after Tablet validation
  const isRead = getHandoverMarkedAsRead(handover.id);

  if (isRead) return null;

  const handleMarkAsRead = () => {
    markHandoverAsRead(handover.id);
    onMarkAsRead();
  };

  return (
    <div className="mb-6 rounded-[14px] border-2 border-state-info/50 bg-state-info/5 p-5 shadow-card">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-heading text-base font-bold text-state-info">Último cambio de turno</h3>
            <span className="rounded-full bg-state-info/20 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-state-info">
              Nuevo
            </span>
          </div>
          <p className="mt-1 text-xs text-app-dim">Generado: {formatDate(handover.ts_generacion)}</p>
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={handleMarkAsRead}
            className="ml-auto flex shrink-0 items-center gap-2 rounded-[10px] bg-state-ok px-4 py-2 text-sm font-bold text-white transition hover:bg-state-ok/90"
          >
            <Check className="h-4 w-4" />
            OK, visto
          </button>
        )}
      </div>

      {/* Content */}
      <div className="mt-4 space-y-3">
        {/* Notes */}
        {handover.notas_saliente && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-app-dim">Comentarios:</p>
            <p className="mt-1 text-sm text-app-text">{handover.notas_saliente}</p>
          </div>
        )}

        {/* Incidents */}
        {handover.incidencias_abiertas && handover.incidencias_abiertas.length > 0 && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-state-atencion">
              Incidencias comunicadas:
            </p>
            <ul className="mt-1 space-y-1 text-sm text-app-text">
              {handover.incidencias_abiertas.map((incident: unknown, idx: number) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-state-atencion" />
                  <span>
                    {typeof incident === "string"
                      ? incident
                      : typeof incident === "object" && incident !== null && "descripcion" in incident
                        ? (incident as Record<string, string>).descripcion || "Incidencia"
                        : "Incidencia"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Pending tasks */}
        {handover.tareas_pendientes && handover.tareas_pendientes.length > 0 && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-state-info">Tareas pendientes:</p>
            <ul className="mt-1 space-y-1 text-sm text-app-text">
              {handover.tareas_pendientes.map((task: unknown, idx: number) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-state-info" />
                  <span>
                    {typeof task === "string"
                      ? task
                      : typeof task === "object" && task !== null && "nombre" in task
                        ? (task as Record<string, string>).nombre || "Tarea"
                        : "Tarea"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
