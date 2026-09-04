"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/toast";
import { usePermissions } from "@/lib/use-permissions";
import {
  AlertTriangle,
  CheckCircle2,
  Monitor,
  Save,
  SlidersHorizontal,
  Tablet,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { PanelCard } from "@/components/ui/panel-card";
import { api } from "@/lib/api";
import type { Zone } from "@/lib/types";
import { displayZoneName, visualZoneOptions } from "@/lib/visual-zones";

// ── Local-only zone config (stored in localStorage per zone) ─────────────────
// NOTE: These settings are NOT persisted to backend. For full persistence,
// a backend endpoint like PUT /zones/{id}/config would be needed.
// Only tiene_tv and tiene_tablet are persisted via PUT /zones/{id}.

const TV_MODULES_KEY = "t4m-tv-modules";
const TV_INTERVAL_KEY = "t4m-tv-interval";
const TABLET_ACTIONS_KEY = "t4m-tablet-actions";

const TV_MODULES = [
  { id: "incidencias_criticas", label: "Incidencias criticas" },
  { id: "animales_prioritarios", label: "Animales prioritarios" },
  { id: "tareas_en_curso", label: "Tareas en curso" },
  { id: "metricas_zona", label: "Métricas de zona" },
  { id: "proximas_acciones", label: "Próximas acciones" },
];

const TABLET_ACTIONS = [
  { id: "registrar_produccion", label: "Registrar producción" },
  { id: "buscar_animal", label: "Buscar animal" },
  { id: "confirmar_tarea", label: "Confirmar tarea" },
  { id: "nueva_incidencia", label: "Nueva incidencia" },
  { id: "crear_pedido", label: "Crear pedido" },
  { id: "cambio_turno", label: "Cambio de turno" },
];

function loadLocalConfig() {
  if (typeof window === "undefined") return { modules: new Set<string>(TV_MODULES.map(m => m.id)), interval: 30, actions: new Set<string>(TABLET_ACTIONS.map(a => a.id)) };
  try {
    const modules = JSON.parse(localStorage.getItem(TV_MODULES_KEY) ?? "null") ?? TV_MODULES.map(m => m.id);
    const interval = Number(localStorage.getItem(TV_INTERVAL_KEY) ?? "30");
    const actions = JSON.parse(localStorage.getItem(TABLET_ACTIONS_KEY) ?? "null") ?? TABLET_ACTIONS.map(a => a.id);
    return { modules: new Set<string>(modules), interval, actions: new Set<string>(actions) };
  } catch {
    return { modules: new Set<string>(TV_MODULES.map(m => m.id)), interval: 30, actions: new Set<string>(TABLET_ACTIONS.map(a => a.id)) };
  }
}

// ── Zone row ─────────────────────────────────────────────────────────────────

function ZoneRow({
  zone,
  onEdit,
}: {
  zone: Zone;
  onEdit: (zone: Zone) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-app-border py-4 last:border-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold text-brand">{zone.codigo}</span>
          <span className="font-heading text-sm font-bold text-app-text">{displayZoneName(zone) ?? zone.nombre}</span>
          {zone.activa === false && (
            <span className="rounded-full bg-state-neutral/10 px-2 py-0.5 text-[10px] font-bold text-state-neutral">
              Inactiva
            </span>
          )}
        </div>
        <div className="mt-1 flex items-center gap-3 text-xs text-app-dim">
          {zone.tipo && <span className="capitalize">{zone.tipo}</span>}
          {zone.descripcion && <span>{zone.descripcion}</span>}
        </div>
        <div className="mt-1.5 flex gap-2">
          <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${zone.tiene_pantalla_tv ? "bg-state-info/10 text-state-info" : "bg-app-bg text-app-dim"}`}>
            <Monitor className="h-3 w-3" />
            TV
          </span>
          <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${zone.tiene_tablet ? "bg-state-ok/10 text-state-ok" : "bg-app-bg text-app-dim"}`}>
            <Tablet className="h-3 w-3" />
            Tablet
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Link
          href={`/zones/${["boxes_terneros", "zona_recria", "recria", "becerrero"].includes(zone.codigo) ? "recria" : "nave"}`}
          className="rounded-[10px] border border-app-border bg-app-bg px-3 py-1.5 text-xs font-semibold text-app-dim hover:border-brand/30 hover:text-brand"
        >
          Ver zona
        </Link>
        {zone.tiene_pantalla_tv && (
          <Link
            href="/tv"
            className="flex items-center gap-1.5 rounded-[10px] border border-app-border bg-app-bg px-3 py-1.5 text-xs font-semibold text-app-dim hover:border-brand/30 hover:text-brand"
          >
            <Monitor className="h-3.5 w-3.5" />
            TV
          </Link>
        )}
        <button
          type="button"
          onClick={() => onEdit(zone)}
          className="rounded-[10px] bg-brand px-3 py-1.5 text-xs font-bold text-white hover:bg-[#135532]"
        >
          Configurar
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { can: userCan } = usePermissions();
  const canEdit = userCan("manage_settings");

  const zonesQ = useQuery({
    queryKey: ["zones"],
    queryFn: api.zones,
    staleTime: 60_000,
  });
  const zones = zonesQ.data ?? [];
  const visibleZones = visualZoneOptions(zones).map((zone) => zones.find((raw) => raw.id === zone.id) ?? zone as Zone);

  // Selected zone for editing
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [editTv, setEditTv] = useState(false);
  const [editTablet, setEditTablet] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Local-only visual config
  const [localConfig] = useState(loadLocalConfig);
  const [tvModules, setTvModules] = useState<Set<string>>(localConfig.modules);
  const [tvInterval, setTvInterval] = useState(localConfig.interval);
  const [tabletActions, setTabletActions] = useState<Set<string>>(localConfig.actions);

  function handleZoneEdit(zone: Zone) {
    setEditingZone(zone);
    setEditTv(zone.tiene_pantalla_tv);
    setEditTablet(zone.tiene_tablet);
    setSaveSuccess(false);
  }

  const zoneMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<Zone> }) => api.updateZone(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["zones"] });
      setSaveSuccess(true);
      toast.success("Configuración de zona guardada");
      setTimeout(() => setSaveSuccess(false), 3000);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Error al guardar la configuración");
    },
  });

  function saveZoneConfig() {
    if (!editingZone || !canEdit) return;
    zoneMutation.mutate({
      id: editingZone.id,
      body: { tiene_pantalla_tv: editTv, tiene_tablet: editTablet },
    });
  }

  function saveLocalConfig() {
    localStorage.setItem(TV_MODULES_KEY, JSON.stringify([...tvModules]));
    localStorage.setItem(TV_INTERVAL_KEY, String(tvInterval));
    localStorage.setItem(TABLET_ACTIONS_KEY, JSON.stringify([...tabletActions]));
    toast.info("Preferencias guardadas localmente");
  }

  function toggleModule(id: string) {
    setTvModules((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAction(id: string) {
    setTabletActions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div className="min-h-full">
      <PageHeader eyebrow="Administración del sistema" title="Configuración" EyebrowIcon={SlidersHorizontal}>
        {!canEdit && (
          <span className="flex items-center gap-1.5 rounded-full border border-state-atencion/30 bg-state-atencion/8 px-3 py-1.5 text-xs font-semibold text-state-atencion">
            <AlertTriangle className="h-3.5 w-3.5" />
            Solo lectura para tu rol
          </span>
        )}
      </PageHeader>

      <div className="space-y-5 px-6 py-6 lg:px-8">
        {/* Zones list */}
        <PanelCard>
          <h2 className="mb-4 font-heading text-base font-bold text-app-text">
            Zonas de la explotación
          </h2>

          {zonesQ.isLoading && (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-[10px] bg-app-surface2" />
              ))}
            </div>
          )}

          {zonesQ.isError && (
            <p className="text-sm text-state-critica">Error al cargar las zonas.</p>
          )}

          {visibleZones.length === 0 && !zonesQ.isLoading && (
            <p className="text-sm text-app-dim">No hay zonas registradas.</p>
          )}

          <div>
            {visibleZones.map((zone) => (
              <ZoneRow key={zone.id} zone={zone} onEdit={handleZoneEdit} />
            ))}
          </div>
        </PanelCard>

        {/* Zone config editor */}
        {editingZone && (
          <div className="grid gap-5 lg:grid-cols-2">
            {/* TV + Tablet hardware config (persists via API) */}
            <PanelCard>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="font-heading text-base font-bold text-app-text">
                  {editingZone.nombre} — Dispositivos
                </h2>
                <span className="rounded-full bg-brand/8 px-2.5 py-0.5 text-[11px] font-bold text-brand">
                  Se guarda en sistema
                </span>
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setEditTv(!editTv)}
                  disabled={!canEdit}
                  className={`flex w-full items-center justify-between rounded-[10px] border px-4 py-3.5 text-sm font-bold transition ${editTv ? "border-state-info/30 bg-state-info/8 text-state-info" : "border-app-border bg-app-bg text-app-dim"} disabled:opacity-50`}
                >
                  <span className="flex items-center gap-2">
                    <Monitor className="h-4 w-4" />
                    Tiene pantalla TV
                  </span>
                  <span className={`h-3.5 w-3.5 rounded-full ${editTv ? "bg-state-info" : "bg-app-dim"}`} />
                </button>

                <button
                  type="button"
                  onClick={() => setEditTablet(!editTablet)}
                  disabled={!canEdit}
                  className={`flex w-full items-center justify-between rounded-[10px] border px-4 py-3.5 text-sm font-bold transition ${editTablet ? "border-state-ok/30 bg-state-ok/8 text-state-ok" : "border-app-border bg-app-bg text-app-dim"} disabled:opacity-50`}
                >
                  <span className="flex items-center gap-2">
                    <Tablet className="h-4 w-4" />
                    Tiene tablet operativa
                  </span>
                  <span className={`h-3.5 w-3.5 rounded-full ${editTablet ? "bg-state-ok" : "bg-app-dim"}`} />
                </button>
              </div>

              {zoneMutation.isError && (
                <p className="mt-3 text-sm text-state-critica">{zoneMutation.error.message}</p>
              )}

              {saveSuccess && (
                <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-state-ok">
                  <CheckCircle2 className="h-4 w-4" />
                  Guardado correctamente
                </div>
              )}

              {canEdit && (
                <button
                  type="button"
                  disabled={zoneMutation.isPending}
                  onClick={saveZoneConfig}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-[10px] bg-brand py-3 text-sm font-bold text-white shadow-brand hover:bg-[#135532] disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {zoneMutation.isPending ? "Guardando…" : "Guardar configuración de zona"}
                </button>
              )}
            </PanelCard>

            {/* Visual config (local-only) */}
            {(
              <div className="space-y-5">
                <PanelCard>
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h2 className="font-heading text-base font-bold text-app-text">TV — Módulos visibles</h2>
                    <span className="rounded-full bg-state-atencion/10 px-2.5 py-0.5 text-[10px] font-bold text-state-atencion">
                      Solo local
                    </span>
                  </div>
                  <p className="mb-3 text-xs text-app-dim">
                    Esta configuración se guarda localmente en tu navegador. Pendiente de persistencia backend.
                  </p>

                  <div className="space-y-2">
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-app-dim">
                      Intervalo de actualización (segundos)
                    </label>
                    <input
                      type="range"
                      min={10}
                      max={120}
                      step={10}
                      value={tvInterval}
                      onChange={(e) => setTvInterval(Number(e.target.value))}
                      className="w-full accent-brand"
                    />
                    <p className="text-sm font-semibold text-brand">Cada {tvInterval}s</p>
                  </div>

                  <div className="mt-4 space-y-2">
                    {TV_MODULES.map((m) => (
                      <label key={m.id} className="flex cursor-pointer items-center gap-3">
                        <input
                          type="checkbox"
                          checked={tvModules.has(m.id)}
                          onChange={() => toggleModule(m.id)}
                          className="h-4 w-4 accent-brand"
                        />
                        <span className="text-sm text-app-text">{m.label}</span>
                      </label>
                    ))}
                  </div>
                </PanelCard>

                <PanelCard>
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h2 className="font-heading text-base font-bold text-app-text">Tablet — Acciones rápidas</h2>
                    <span className="rounded-full bg-state-atencion/10 px-2.5 py-0.5 text-[10px] font-bold text-state-atencion">
                      Solo local
                    </span>
                  </div>
                  <div className="space-y-2">
                    {TABLET_ACTIONS.map((a) => (
                      <label key={a.id} className="flex cursor-pointer items-center gap-3">
                        <input
                          type="checkbox"
                          checked={tabletActions.has(a.id)}
                          onChange={() => toggleAction(a.id)}
                          className="h-4 w-4 accent-brand"
                        />
                        <span className="text-sm text-app-text">{a.label}</span>
                      </label>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={saveLocalConfig}
                    className="mt-4 w-full rounded-[10px] border border-app-border bg-app-bg py-2.5 text-sm font-semibold text-app-dim hover:border-brand/30 hover:text-brand"
                  >
                    Guardar preferencias locales
                  </button>
                </PanelCard>
              </div>
            )}
          </div>
        )}

        {!editingZone && zones.length > 0 && (
          <div className="rounded-[14px] border border-state-info/20 bg-state-info/5 px-4 py-3 text-sm text-state-info">
            Selecciona una zona pulsando <strong>Configurar</strong> para editarla.
          </div>
        )}
      </div>
    </div>
  );
}
