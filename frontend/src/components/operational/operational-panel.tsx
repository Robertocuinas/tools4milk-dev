"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  CloudSun,
  DatabaseZap,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Timer,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { PanelCard, SectionTitle } from "@/components/ui/panel-card";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import type { SyntheticResetResult, WeatherSyncResult } from "@/lib/types";
import { usePermissions } from "@/lib/use-permissions";

function fmtDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
}

const BTN_PRIMARY =
  "flex items-center justify-center gap-2 rounded-[10px] bg-brand px-4 py-2.5 text-sm font-bold text-white shadow-brand hover:bg-[#135532] disabled:cursor-not-allowed disabled:opacity-50";
const BTN_GHOST =
  "flex items-center justify-center gap-2 rounded-[10px] border border-app-border bg-app-bg px-4 py-2.5 text-sm font-semibold text-app-dim hover:border-brand/30 hover:text-brand disabled:cursor-not-allowed disabled:opacity-50";
const BTN_DANGER =
  "flex items-center justify-center gap-2 rounded-[10px] bg-state-critica px-4 py-2.5 text-sm font-bold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50";

export function OperationalPanel() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { can: userCan } = usePermissions();
  const isAdmin = userCan("view_integration");

  // Doble confirmación del reset destructivo: armar → ejecutar/cancelar.
  const [resetArmed, setResetArmed] = useState(false);
  const [resetResult, setResetResult] = useState<SyntheticResetResult | null>(null);
  const [syncResult, setSyncResult] = useState<WeatherSyncResult | null>(null);

  // Guardia single-flight por acción: evita doble envío aunque el segundo clic
  // llegue antes del re-render que deshabilita el botón (isPending).
  const flight = useRef({ pause: false, resume: false, reset: false, sync: false });

  // Estado de ocupación explícito (fuente de `busy`): se activa en el clic y se
  // libera en onSettled, sin depender del timing de suscripción del observer.
  const [pendingAction, setPendingAction] = useState<keyof typeof flight.current | null>(null);

  function singleFlight<K extends keyof typeof flight.current>(key: K, run: () => void) {
    if (flight.current[key]) return;
    flight.current[key] = true;
    setPendingAction(key);
    run();
  }

  function settleFlight<K extends keyof typeof flight.current>(key: K) {
    flight.current[key] = false;
    setPendingAction((current) => (current === key ? null : current));
  }

  const statusQ = useQuery({
    queryKey: ["synthetic-scheduler-status"],
    queryFn: api.syntheticSchedulerStatus,
    enabled: isAdmin,
    refetchInterval: 30_000,
    retry: 1,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["synthetic-scheduler-status"] });

  const pauseM = useMutation({
    mutationFn: api.pauseSyntheticScheduler,
    onSuccess: () => {
      invalidate();
      toast.success("Scheduler sintético pausado");
    },
    onError: (err: Error) => toast.error(err.message || "No se pudo pausar el scheduler"),
    onSettled: () => settleFlight("pause"),
  });

  const resumeM = useMutation({
    mutationFn: api.resumeSyntheticScheduler,
    onSuccess: () => {
      invalidate();
      toast.success("Scheduler sintético reanudado");
    },
    onError: (err: Error) => toast.error(err.message || "No se pudo reanudar el scheduler"),
    onSettled: () => settleFlight("resume"),
  });

  const resetM = useMutation({
    mutationFn: api.resetSynthetic,
    onSuccess: (data) => {
      setResetResult(data);
      setResetArmed(false);
      invalidate();
      toast.success(`Dataset sintético reiniciado (${data.tasks} tareas eliminadas)`);
    },
    onError: (err: Error) => {
      setResetArmed(false);
      toast.error(err.message || "No se pudo reiniciar el dataset sintético");
    },
    onSettled: () => settleFlight("reset"),
  });

  const syncM = useMutation({
    mutationFn: api.weatherSync,
    onSuccess: (data) => {
      setSyncResult(data);
      if (data.status === "error") {
        toast.error(data.error || "La sincronización meteorológica devolvió error");
      } else if (data.modo === "generated") {
        toast.info("Sincronización completada con datos sintéticos (AEMET no configurado)");
      } else {
        toast.success("Sincronización meteorológica completada (AEMET)");
      }
    },
    onError: (err: Error) => toast.error(err.message || "No se pudo sincronizar la meteorología"),
    onSettled: () => settleFlight("sync"),
  });

  if (!isAdmin) return null;

  const paused = statusQ.data?.paused ?? null;
  const last = statusQ.data?.last_execution;
  const busy =
    pendingAction !== null || pauseM.isPending || resumeM.isPending || resetM.isPending || syncM.isPending;

  return (
    <section aria-labelledby="operational-panel-title" className="space-y-5">
      {/* Scheduler sintético */}
      <PanelCard>
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <Timer className="h-4 w-4 text-brand" />
          <SectionTitle>
            <span id="operational-panel-title">Scheduler sintético</span>
          </SectionTitle>
          {statusQ.isLoading && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-state-atencion/10 px-2.5 py-0.5 text-[11px] font-bold text-state-atencion">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Verificando
            </span>
          )}
          {paused === true && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-state-atencion/10 px-2.5 py-0.5 text-[11px] font-bold text-state-atencion">
              <Pause className="h-3.5 w-3.5" /> Pausado
            </span>
          )}
          {paused === false && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-state-ok/10 px-2.5 py-0.5 text-[11px] font-bold text-state-ok">
              <Play className="h-3.5 w-3.5" /> Activo
            </span>
          )}
        </div>
        <p className="mb-4 text-xs text-app-dim">
          Estado y control manual del generador de demostración. No edita cron ni usa colas externas.
        </p>

        {statusQ.isError && (
          <p className="mb-3 flex items-center gap-2 text-sm text-state-critica">
            <XCircle className="h-4 w-4" /> No se pudo obtener el estado del scheduler.
            <button type="button" onClick={() => statusQ.refetch()} className="font-bold underline">
              Reintentar
            </button>
          </p>
        )}

        {statusQ.isSuccess && last && (
          <dl className="mb-4 grid gap-x-8 gap-y-1 text-sm md:grid-cols-2">
            <div className="flex items-center justify-between gap-4 border-b border-app-border py-2">
              <dt className="text-app-dim">Último inicio</dt>
              <dd className="font-semibold text-app-text">{fmtDate(last.started_at)}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 border-b border-app-border py-2">
              <dt className="text-app-dim">Último fin</dt>
              <dd className="font-semibold text-app-text">{fmtDate(last.finished_at)}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 border-b border-app-border py-2">
              <dt className="text-app-dim">Creadas / omitidas</dt>
              <dd className="font-semibold text-app-text">
                {last.created ?? "—"} / {last.skipped ?? "—"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4 border-b border-app-border py-2">
              <dt className="text-app-dim">Errores</dt>
              <dd className={`font-semibold ${last.errors ? "text-state-critica" : "text-app-text"}`}>
                {last.errors ?? "—"}
                {last.error ? ` (${last.error})` : ""}
              </dd>
            </div>
          </dl>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          {paused ? (
            <button type="button" onClick={() => singleFlight("resume", () => resumeM.mutate())} disabled={busy} className={BTN_PRIMARY}>
              {pendingAction === "resume" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {pendingAction === "resume" ? "Reanudando…" : "Reanudar scheduler"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => singleFlight("pause", () => pauseM.mutate())}
              disabled={busy || statusQ.isLoading}
              className={BTN_GHOST}
            >
              {pendingAction === "pause" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pause className="h-4 w-4" />}
              {pendingAction === "pause" ? "Pausando…" : "Pausar scheduler"}
            </button>
          )}
          <button
            type="button"
            onClick={() => statusQ.refetch()}
            disabled={statusQ.isFetching}
            className={BTN_GHOST}
          >
            <RefreshCw className={`h-4 w-4 ${statusQ.isFetching ? "animate-spin" : ""}`} />
            Actualizar estado
          </button>
        </div>
      </PanelCard>

      {/* Reset sintético */}
      <PanelCard>
        <div className="mb-1 flex items-center gap-2">
          <DatabaseZap className="h-4 w-4 text-state-critica" />
          <SectionTitle>Reinicio del dataset sintético</SectionTitle>
        </div>
        <p className="mb-4 text-xs text-app-dim">
          Operación destructiva limitada al dataset de demostración (tareas, recurrencias y provenance
          sintéticas). Nunca reinicia infraestructura ni volúmenes.
        </p>

        {!resetArmed ? (
          <button
            type="button"
            onClick={() => {
              setResetResult(null);
              setResetArmed(true);
            }}
            disabled={busy}
            className={BTN_DANGER}
          >
            <DatabaseZap className="h-4 w-4" />
            Reiniciar datos sintéticos
          </button>
        ) : (
          <div
            role="alertdialog"
            aria-modal="false"
            aria-labelledby="reset-confirm-title"
            aria-describedby="reset-confirm-desc"
            className="rounded-[10px] border border-state-critica/30 bg-state-critica/5 px-4 py-3"
          >
            <p id="reset-confirm-title" className="flex items-center gap-2 text-sm font-bold text-state-critica">
              <AlertTriangle className="h-4 w-4" /> Confirmar reinicio destructivo
            </p>
            <p id="reset-confirm-desc" className="mt-1 text-xs text-app-dim">
              Se eliminarán solo las filas del dataset sintético de demostración. Esta acción no se puede
              deshacer y no toca infraestructura.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => singleFlight("reset", () => resetM.mutate())}
                disabled={pendingAction === "reset"}
                className={BTN_DANGER}
              >
                {pendingAction === "reset" ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
                {pendingAction === "reset" ? "Reiniciando…" : "Sí, reiniciar datos sintéticos"}
              </button>
              <button
                type="button"
                onClick={() => setResetArmed(false)}
                disabled={pendingAction === "reset"}
                className={BTN_GHOST}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        <div aria-live="polite">
          {resetResult && (
            <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-state-ok">
              <CheckCircle2 className="h-4 w-4" />
              Reinicio completado: {resetResult.tasks} tareas, {resetResult.recurrences} recurrencias,{" "}
              {resetResult.provenance} marcas de provenance eliminadas.
            </p>
          )}
        </div>
      </PanelCard>

      {/* Weather sync */}
      <PanelCard>
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <CloudSun className="h-4 w-4 text-state-info" />
          <SectionTitle>Sincronización meteorológica</SectionTitle>
          {syncResult?.modo === "generated" && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-state-atencion/10 px-2.5 py-0.5 text-[11px] font-bold text-state-atencion">
              <AlertTriangle className="h-3.5 w-3.5" /> AEMET no configurado · datos sintéticos
            </span>
          )}
          {syncResult?.modo === "aemet_real" && syncResult.status === "success" && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-state-ok/10 px-2.5 py-0.5 text-[11px] font-bold text-state-ok">
              <CheckCircle2 className="h-3.5 w-3.5" /> AEMET
            </span>
          )}
        </div>
        <p className="mb-4 text-xs text-app-dim">
          Sincronización opcional bajo demanda. Sin clave AEMET usa datos sintéticos de demostración; nunca
          muestra claves ni configuración sensible.
        </p>

        <button type="button" onClick={() => singleFlight("sync", () => syncM.mutate())} disabled={busy} className={BTN_PRIMARY}>
          {pendingAction === "sync" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudSun className="h-4 w-4" />}
          {pendingAction === "sync" ? "Sincronizando…" : "Sincronizar meteorología"}
        </button>

        <div aria-live="polite">
          {syncResult && syncResult.status === "success" && (
            <p className="mt-3 text-sm text-app-text">
              Sincronización completada: {syncResult.registros_insertados} insertados,{" "}
              {syncResult.registros_actualizados} actualizados
              {syncResult.modo === "generated"
                ? " (modo demostración: AEMET no configurado, datos sintéticos)"
                : " (AEMET)"}{" "}
              · {fmtDate(syncResult.timestamp)}
            </p>
          )}
          {syncResult && syncResult.status === "error" && (
            <p className="mt-3 flex items-center gap-2 text-sm text-state-critica">
              <XCircle className="h-4 w-4" /> Sincronización con error: {syncResult.error || "fallo del proveedor"}{" "}
              · {fmtDate(syncResult.timestamp)}
            </p>
          )}
        </div>
      </PanelCard>

      <p className="px-1 text-xs text-app-dim">
        Los resultados se muestran en línea tras cada operación. Los cambios en tablas de dominio auditadas
        pueden revisarse en el{" "}
        <Link href="/audit-log" className="font-semibold text-brand underline">
          registro de auditoría
        </Link>
        . La CLI segura (`tools4milk-cli`) sigue disponible para operación por terminal; esta UI no la
        sustituye.
      </p>
    </section>
  );
}
