"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ChevronLeft, Monitor, Tablet, Wrench, X } from "lucide-react";
import Link from "next/link";
import { use, useMemo, useState } from "react";
import { LastHandoverCard } from "@/components/zone/LastHandoverCard";
import { ZoneKanbanView } from "@/components/zone/ZoneKanbanView";
import { ZoneTabletView } from "@/components/zone/ZoneTabletView";
import { api } from "@/lib/api";
import { TV_REFETCH, TV_STALE } from "@/lib/tv-constants";
import type { Animal, BoxRecria, CreateIncidentPayload, Incident, IncidentPriority, Task, VisualZoneKey, Zone } from "@/lib/types";

const VISUAL_ZONES: Record<VisualZoneKey, {
  title: string;
  description: string;
  codes: string[];
  subzones: { key: string; label: string; codes: string[]; description: string }[];
}> = {
  recria: {
    title: "Recria",
    description: "Gestion visual de boxes, novillas, tareas, tratamientos e incidencias de recria.",
    codes: ["boxes_terneros", "zona_recria", "recria", "becerrero"],
    subzones: [
      { key: "boxes", label: "Boxes de terneros", codes: ["boxes_terneros", "becerrero"], description: "Animales provisionales por numero de box." },
      { key: "zona_recria", label: "Zona de recria", codes: ["zona_recria", "recria"], description: "Terneras y novillas con ficha completa." },
    ],
  },
  nave: {
    title: "Nave",
    description: "Gestion visual de patio de alimentacion, enfermeria y maquinaria.",
    codes: ["patio_alimentacion", "enfermeria", "maquinaria", "robots", "sala_ordeno", "silos", "almacen", "oficina", "general"],
    subzones: [
      { key: "patio", label: "Patio de alimentacion", codes: ["patio_alimentacion", "silos", "almacen"], description: "Racion, bebederos, silos y pedidos de alimentacion." },
      { key: "enfermeria", label: "Enfermeria", codes: ["enfermeria"], description: "Tratamientos, retirada y revisiones sanitarias." },
      { key: "maquinaria", label: "Maquinaria", codes: ["maquinaria", "robots", "sala_ordeno", "general", "oficina"], description: "Averias, mantenimientos y estado de equipos." },
    ],
  },
};

function idsForCodes(zones: Zone[], codes: string[]) {
  const wanted = new Set(codes);
  return new Set(zones.filter((z) => wanted.has(z.codigo)).map((z) => z.id));
}

function zoneOptionsForSubzones(zones: Zone[], subzones: { label: string; codes: string[] }[]) {
  return subzones
    .map((subzone) => {
      const wanted = new Set(subzone.codes);
      const zone = zones.find((z) => wanted.has(z.codigo));
      return zone ? { ...zone, nombre: subzone.label } : null;
    })
    .filter((zone): zone is Zone => Boolean(zone));
}

function formatDate(iso?: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function openIncident(i: Incident) {
  return i.estado === "abierta" || i.estado === "en_gestion";
}

function pendingTask(t: Task) {
  return t.estado === "programada" || t.estado === "retrasada";
}

function Panel({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <section className="rounded-[14px] border border-app-border bg-white p-5 shadow-card">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-heading text-base font-bold text-app-text">{title}</h2>
        {count !== undefined && <span className="rounded-full bg-app-bg px-2.5 py-1 text-xs font-bold text-app-dim">{count}</span>}
      </div>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-[10px] border border-dashed border-app-border bg-app-bg px-4 py-8 text-center text-sm text-app-dim">{text}</p>;
}

function CreateIncidentModal({ zones, onClose }: { zones: Zone[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [zonaId, setZonaId] = useState(zones[0]?.id ?? "");
  const [tipo, setTipo] = useState("sanidad_animal");
  const [prioridad, setPrioridad] = useState<IncidentPriority>("media");
  const [descripcion, setDescripcion] = useState("");

  const mutation = useMutation({
    mutationFn: (payload: CreateIncidentPayload) => api.createIncident(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["zone-incidents"] });
      queryClient.invalidateQueries({ queryKey: ["tv-incidents"] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-[14px] bg-white shadow-panel">
        <div className="flex items-center justify-between border-b border-app-border px-5 py-4">
          <h2 className="font-heading text-lg font-bold text-app-text">Nueva incidencia</h2>
          <button type="button" onClick={onClose} className="text-app-dim hover:text-app-text"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4 p-5">
          <select value={zonaId} onChange={(e) => setZonaId(e.target.value)} className="h-11 w-full rounded-[10px] border border-app-border px-3 text-sm">
            {zones.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}
          </select>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="h-11 w-full rounded-[10px] border border-app-border px-3 text-sm">
            <option value="sanidad_animal">Sanidad animal</option>
            <option value="alimentacion">Alimentacion</option>
            <option value="averia_maquinaria">Averia maquinaria</option>
            <option value="infraestructura">Infraestructura</option>
          </select>
          <select value={prioridad} onChange={(e) => setPrioridad(e.target.value as IncidentPriority)} className="h-11 w-full rounded-[10px] border border-app-border px-3 text-sm">
            <option value="baja">Baja</option>
            <option value="media">Media</option>
            <option value="alta">Alta</option>
            <option value="critica">Critica</option>
          </select>
          <textarea rows={4} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Describe la incidencia" className="w-full resize-none rounded-[10px] border border-app-border px-3 py-2 text-sm" />
          {mutation.isError && <p className="text-sm font-semibold text-state-critica">{mutation.error.message}</p>}
          <button type="button" disabled={!zonaId || !descripcion.trim() || mutation.isPending} onClick={() => mutation.mutate({ zona_id: zonaId, tipo, prioridad, descripcion })} className="w-full rounded-[10px] bg-brand py-3 font-bold text-white disabled:opacity-50">
            {mutation.isPending ? "Registrando..." : "Registrar incidencia"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TreatmentModal({ animals, onClose }: { animals: Animal[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [animalId, setAnimalId] = useState(animals[0]?.id ?? "");
  const [medicamento, setMedicamento] = useState("");
  const [motivo, setMotivo] = useState("");
  const [fechaFin, setFechaFin] = useState(() => new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10));

  const mutation = useMutation({
    mutationFn: () => api.createTreatment({ animal_id: animalId, medicamento, motivo, fecha_inicio: new Date().toISOString().slice(0, 10), fecha_fin: fechaFin, activo: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["zone-treatments"] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-[14px] bg-white shadow-panel">
        <div className="flex items-center justify-between border-b border-app-border px-5 py-4">
          <h2 className="font-heading text-lg font-bold text-app-text">Nuevo tratamiento</h2>
          <button type="button" onClick={onClose} className="text-app-dim hover:text-app-text"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4 p-5">
          <select value={animalId} onChange={(e) => setAnimalId(e.target.value)} className="h-11 w-full rounded-[10px] border border-app-border px-3 text-sm">
            {animals.map((a) => <option key={a.id} value={a.id}>{a.crotal_oficial} {a.nombre ? `· ${a.nombre}` : ""}</option>)}
          </select>
          <input value={medicamento} onChange={(e) => setMedicamento(e.target.value)} placeholder="Farmaco o tratamiento" className="h-11 w-full rounded-[10px] border border-app-border px-3 text-sm" />
          <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo o patologia" className="h-11 w-full rounded-[10px] border border-app-border px-3 text-sm" />
          <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className="h-11 w-full rounded-[10px] border border-app-border px-3 text-sm" />
          {mutation.isError && <p className="text-sm font-semibold text-state-critica">{mutation.error.message}</p>}
          <button type="button" disabled={!animalId || !medicamento.trim() || mutation.isPending} onClick={() => mutation.mutate()} className="w-full rounded-[10px] bg-brand py-3 font-bold text-white disabled:opacity-50">
            {mutation.isPending ? "Guardando..." : "Crear tratamiento"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TaskList({ tasks, canComplete }: { tasks: Task[]; canComplete: boolean }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (taskId: string) => api.completeTask(taskId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["zone-tasks"] }),
  });

  if (tasks.length === 0) return <Empty text="Sin tareas pendientes" />;
  return (
    <div className="space-y-2">
      {tasks.slice(0, 10).map((task) => (
        <div key={task.id} className={`rounded-[10px] border px-4 py-3 ${task.estado === "retrasada" ? "border-state-critica/30 bg-state-critica/5" : "border-app-border bg-app-bg"}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-app-text">{task.tarea_catalogo?.nombre ?? "Tarea"}</p>
              <p className="mt-0.5 text-xs text-app-dim">{task.estado} · {formatDate(task.fecha_programada)}</p>
              {task.observaciones && <p className="mt-1 text-xs text-app-dim">{task.observaciones}</p>}
            </div>
            {canComplete && (
              <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate(task.id)} className="rounded-[10px] bg-state-ok/10 px-3 py-2 text-xs font-bold text-state-ok">
                Completar
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ZoneDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const zoneKey: VisualZoneKey = id === "nave" ? "nave" : "recria";
  const config = VISUAL_ZONES[zoneKey];
  const [mode, setMode] = useState<"management" | "tv" | "tablet">("management");
  const [showIncident, setShowIncident] = useState(false);
  const [showTreatment, setShowTreatment] = useState(false);

  const [lastHandoverRead, setLastHandoverRead] = useState(false);

  const zonesQ = useQuery({ queryKey: ["zones"], queryFn: api.zones, staleTime: TV_STALE.CATALOG });
  const tasksQ = useQuery({ queryKey: ["zone-tasks", zoneKey], queryFn: () => api.tasks({ limit: 500 }), staleTime: TV_STALE.NORMAL, refetchInterval: TV_REFETCH.NORMAL });
  const incidentsQ = useQuery({ queryKey: ["zone-incidents", zoneKey], queryFn: () => api.incidents({ limit: 300 }), staleTime: TV_STALE.NORMAL, refetchInterval: TV_REFETCH.NORMAL });
  const treatmentsQ = useQuery({ queryKey: ["zone-treatments"], queryFn: () => api.treatments({ activo: true, limit: 100 }), staleTime: TV_STALE.NORMAL });
  const animalsQ = useQuery({ queryKey: ["animals-lookup"], queryFn: () => api.animals({ limit: 500 }), staleTime: TV_STALE.CATALOG });
  const machineryQ = useQuery({ queryKey: ["machinery-all"], queryFn: () => api.machinery({ limit: 200 }), staleTime: TV_STALE.CATALOG });
  const boxesQ = useQuery({ queryKey: ["boxes-recria"], queryFn: () => api.boxesRecria(), staleTime: TV_STALE.CATALOG });
  const meQ = useQuery({ queryKey: ["me"], queryFn: api.me, staleTime: TV_STALE.CATALOG });
  const handoversQ = useQuery({ queryKey: ["zone-handovers"], queryFn: () => api.shiftHandovers({ limit: 10 }), staleTime: TV_STALE.NORMAL });

  const zones = zonesQ.data ?? [];
  const groupIds = idsForCodes(zones, config.codes);
  const incidentZones = zoneOptionsForSubzones(zones, config.subzones);
  const tasks = (tasksQ.data ?? []).filter((t) => t.zona_id && groupIds.has(t.zona_id));
  const pendingTasks = tasks.filter(pendingTask);
  const incidents = (incidentsQ.data ?? []).filter((i) => i.zona_id && groupIds.has(i.zona_id));
  const openIncidents = incidents.filter(openIncident);
  const machinery = (machineryQ.data ?? []).filter((m) => m.zona_id && groupIds.has(m.zona_id));
  const animals = useMemo(() => animalsQ.data ?? [], [animalsQ.data]);
  const animalsById = useMemo(() => new Map(animals.map((a) => [a.id, a])), [animals]);
  const boxes: BoxRecria[] = boxesQ.data ?? [];
  const groupAnimalIds = new Set([
    ...animals.filter((a) => zoneKey === "recria" ? ["recria", "gestante"].includes(a.estado) : ["produccion", "seca"].includes(a.estado)).map((a) => a.id),
    ...boxes.map((b) => b.ternero_id).filter(Boolean) as string[],
  ]);
  const treatments = (treatmentsQ.data ?? []).filter((t) => groupAnimalIds.has(t.animal_id));

  const role = meQ.data?.role;
  const canManageTreatments = role === "admin" || role === "veterinario";
  const canCompleteTasks = role === "admin" || role === "operario" || role === "alimentacion";
  const canCreateIncidents = !!role;
  const isTvMode = mode === "tv";

  return (
    <div className={`min-h-full ${isTvMode ? "bg-tv-bg text-tv-text" : "bg-app-bg"}`}>
      {showIncident && <CreateIncidentModal zones={incidentZones} onClose={() => setShowIncident(false)} />}
      {showTreatment && <TreatmentModal animals={animals.filter((a) => groupAnimalIds.has(a.id))} onClose={() => setShowTreatment(false)} />}

      <div className={`border-b px-4 py-3 lg:px-8 lg:py-4 ${isTvMode ? "border-tv-border" : "border-app-border bg-white"}`}>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/zones" className={`flex shrink-0 items-center gap-1 text-sm ${isTvMode ? "text-tv-dim hover:text-tv-text" : "text-app-dim hover:text-app-text"}`}>
            <ChevronLeft className="h-4 w-4" /> Zonas
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className={`truncate font-heading text-xl font-bold lg:text-2xl ${isTvMode ? "text-tv-text" : "text-app-text"}`}>{config.title}</h1>
            <p className={`hidden truncate text-sm sm:block ${isTvMode ? "text-tv-dim" : "text-app-dim"}`}>{config.description}</p>
          </div>
          <div className="flex shrink-0 overflow-hidden rounded-[10px] border border-app-border bg-white">
            {[{ key: "management", label: "Gestión" }, { key: "tv", label: "TV" }, { key: "tablet", label: "Tablet" }].map((item) => (
              <button key={item.key} type="button" onClick={() => setMode(item.key as typeof mode)} className={`px-3 py-2 text-xs font-bold transition ${mode === item.key ? "bg-brand/10 text-brand" : "text-app-dim hover:bg-app-bg"}`}>
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-5 px-6 py-6 lg:px-8">
        {/* Handover: only Tablet can confirm; Management and TV are read-only */}
        {handoversQ.data?.resumenes?.[0] && (
          <LastHandoverCard
            handover={handoversQ.data.resumenes[0]}
            onMarkAsRead={() => setLastHandoverRead(true)}
            readOnly={mode !== "tablet"}
          />
        )}

        {mode === "management" && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Panel title="Tareas pendientes"><p className="font-heading text-3xl font-bold text-state-info">{pendingTasks.length}</p></Panel>
            <Panel title="Incidencias abiertas"><p className="font-heading text-3xl font-bold text-state-atencion">{openIncidents.length}</p></Panel>
            <Panel title="Tratamientos activos"><p className="font-heading text-3xl font-bold text-brand">{treatments.length}</p></Panel>
            <Panel title="Subzonas"><p className="font-heading text-3xl font-bold text-app-text">{config.subzones.length}</p></Panel>
            <Panel title="Maquinaria"><p className="font-heading text-3xl font-bold text-app-text">{machinery.length}</p></Panel>
          </div>
        )}

        {/* Mode: TV Kanban */}
        {mode === "tv" && (
          <ZoneKanbanView tasks={tasks} incidents={openIncidents} />
        )}

        {/* Mode: Tablet Operative */}
        {mode === "tablet" && (
          <ZoneTabletView
            tasks={tasks}
            zones={incidentZones}
            zoneKey={zoneKey}
            canStartTasks={canCompleteTasks}
            onCreateIncident={() => setShowIncident(true)}
            onShowTreatment={() => setShowTreatment(true)}
          />
        )}

        {mode === "management" && (
          <div className="grid gap-5 xl:grid-cols-3">
            {config.subzones.map((subzone) => {
            const ids = idsForCodes(zones, subzone.codes);
            const subTasks = tasks.filter((t) => t.zona_id && ids.has(t.zona_id) && pendingTask(t));
            const subInc = incidents.filter((i) => i.zona_id && ids.has(i.zona_id) && openIncident(i));
            return (
              <Panel key={subzone.key} title={subzone.label}>
                <p className="mb-3 text-sm text-app-dim">{subzone.description}</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="rounded-[10px] bg-app-bg px-3 py-2">{subTasks.length} tareas</span>
                  <span className="rounded-[10px] bg-app-bg px-3 py-2">{subInc.length} incidencias</span>
                </div>
              </Panel>
            );
          })}
        </div>
        )}

        {mode === "management" && zoneKey === "recria" && (
          <Panel title="Boxes de terneros" count={boxes.length}>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {boxes.slice(0, 12).map((box) => {
                const animal = box.ternero_id ? animalsById.get(box.ternero_id) : undefined;
                return (
                  <div key={box.id} className="rounded-[10px] border border-app-border bg-app-bg px-4 py-3">
                    <p className="font-bold text-app-text">Box {box.box_numero}</p>
                    <p className="text-xs text-app-dim">{animal ? `${animal.crotal_oficial} · ${animal.nombre ?? "Ternero"}` : "Ternero sin crotal"}</p>
                  </div>
                );
              })}
            </div>
          </Panel>
        )}

        {mode === "management" && (
          <div className="grid gap-5 xl:grid-cols-3">
            <Panel title="Tareas pendientes" count={pendingTasks.length}>
            <TaskList tasks={pendingTasks} canComplete={false} />
          </Panel>

          <Panel title="Tratamientos activos" count={treatments.length}>
            {treatments.length === 0 ? <Empty text="Sin tratamientos activos" /> : (
              <div className="space-y-2">
                {treatments.slice(0, 10).map((t) => {
                  const animal = animalsById.get(t.animal_id);
                  const box = boxes.find((b) => b.ternero_id === t.animal_id);
                  return (
                    <div key={t.id} className="rounded-[10px] border border-app-border bg-app-bg px-4 py-3">
                      <p className="text-sm font-bold text-app-text">{box ? `Box ${box.box_numero}` : animal?.crotal_oficial ?? "Animal"} · {t.medicamento}</p>
                      <p className="text-xs text-app-dim">{t.motivo ?? t.observaciones ?? "Tratamiento activo"} · desde {formatDate(t.fecha_inicio)}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          <Panel title={zoneKey === "nave" ? "Averias e incidencias" : "Incidencias de recria"} count={openIncidents.length}>
            {openIncidents.length === 0 ? <Empty text="Sin incidencias abiertas" /> : (
              <div className="space-y-2">
                {openIncidents.slice(0, 10).map((i) => (
                  <div key={i.id} className="rounded-[10px] border border-app-border bg-app-bg px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-state-atencion/10 px-2 py-0.5 text-[10px] font-bold uppercase text-state-atencion">{i.prioridad}</span>
                      <span className="text-xs text-app-dim">{i.tipo.replace(/_/g, " ")}</span>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-app-text">{i.descripcion}</p>
                  </div>
                ))}
              </div>
            )}
          </Panel>
            </div>
          )}

        {mode === "management" && zoneKey === "nave" && (
          <Panel title="Estado de maquinaria" count={machinery.length}>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {machinery.map((m) => (
                <div key={m.id} className="rounded-[10px] border border-app-border bg-app-bg px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-app-dim" />
                    <p className="font-bold text-app-text">{m.nombre}</p>
                  </div>
                  <p className="mt-1 text-xs capitalize text-app-dim">{m.tipo.replace(/_/g, " ")} · {m.estado}</p>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {mode === "tv" && (
          <div className="flex gap-2 text-xs font-semibold text-app-text">
            <span className="inline-flex items-center gap-1 rounded-full bg-state-info/10 px-2 py-1"><Monitor className="h-3 w-3" /> Vista TV de {config.title}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-state-ok/10 px-2 py-1"><Tablet className="h-3 w-3" /> Tablet disponible</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-state-ok/10 px-2 py-1"><CheckCircle2 className="h-3 w-3" /> Alertas integradas como incidencias</span>
          </div>
        )}
      </div>
    </div>
  );
}
