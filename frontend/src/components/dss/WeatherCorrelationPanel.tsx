"use client";

import { useQuery } from "@tanstack/react-query";
import { CloudSun, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";

// Etiqueta honesta exigida por R4-3 (el backend la devuelve en `aviso`;
// se mantiene una copia local como respaldo si el contrato cambia).
const FALLBACK_AVISO =
  "Asociación descriptiva sobre datos sintéticos; no implica causalidad ni validez predictiva, clínica o productiva";

export function WeatherCorrelationPanel() {
  const corrQuery = useQuery({
    queryKey: ["weather-correlation"],
    queryFn: () => api.weatherCorrelation({ ventana_dias: 30 }),
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const data = corrQuery.data;
  const aviso = data?.aviso ?? FALLBACK_AVISO;

  return (
    <section
      aria-label="Asociación meteorológica descriptiva"
      className="rounded-[10px] border border-app-border bg-white p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.18em] text-app-dim">
          <CloudSun className="h-4 w-4 text-brand" aria-hidden="true" />
          Asociación meteo ↔ producción
        </div>
        <span className="rounded-full bg-app-bg px-2 py-0.5 text-[10px] font-bold text-app-dim">
          Datos de demo sintética
        </span>
      </div>

      <p role="note" className="mt-3 text-xs font-semibold text-app-dim">
        {aviso}
      </p>

      {corrQuery.isFetching && !data && (
        <div className="mt-4 flex justify-center py-6" aria-label="Cargando asociación">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        </div>
      )}

      {corrQuery.isError && (
        <div className="mt-4 space-y-2">
          <div
            role="alert"
            className="rounded-[10px] bg-state-critica/10 px-3 py-2 text-xs font-semibold text-state-critica"
          >
            Error al cargar la asociación descriptiva
          </div>
          <button
            type="button"
            onClick={() => corrQuery.refetch()}
            className="inline-flex items-center gap-2 rounded-[10px] bg-app-bg px-4 py-2 text-xs font-bold text-brand transition hover:bg-app-bg"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Reintentar
          </button>
        </div>
      )}

      {data && (
        <div className="mt-4 space-y-3" aria-live="polite">
          <div className="flex flex-wrap gap-2 text-[11px] text-app-dim">
            <span className="rounded-full bg-app-bg px-2.5 py-1 font-semibold">
              Método: {data.metodo}
            </span>
            <span className="rounded-full bg-app-bg px-2.5 py-1 font-semibold">
              Muestra: {data.sample_size} días emparejados (mínimo {data.min_sample_size})
            </span>
            <span className="rounded-full bg-app-bg px-2.5 py-1 font-semibold">
              Ventana: {data.ventana_dias} días · {data.ubicacion}
            </span>
          </div>
          <p className="font-mono text-[11px] text-app-dim" title="Fórmula de Pearson aplicada">
            {data.formula}
          </p>

          {data.status === "insufficient_data" ? (
            <div className="rounded-[10px] bg-app-bg px-4 py-6 text-center">
              <p className="text-sm font-bold text-app-text">Sin datos suficientes</p>
              <p className="mx-auto mt-1 max-w-md text-xs text-app-dim">
                Se necesitan al menos {data.min_sample_size} días con observación
                meteorológica y producción registradas (actual: {data.sample_size}).
                No se describen asociaciones sin soporte.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-xs">
                <caption className="py-2 text-left font-bold text-app-text">
                  Asociaciones observadas por día natural (medias diarias emparejadas)
                </caption>
                <thead>
                  <tr className="border-b border-app-border text-[10px] uppercase tracking-[0.12em] text-app-dim">
                    <th scope="col" className="py-2 pr-3">Variables observadas</th>
                    <th scope="col" className="py-2 pr-3">n</th>
                    <th scope="col" className="py-2 pr-3">r de Pearson</th>
                    <th scope="col" className="py-2">Lectura descriptiva</th>
                  </tr>
                </thead>
                <tbody>
                  {data.asociaciones.map((assoc) => (
                    <tr key={assoc.variable_meteo} className="border-b border-app-border last:border-0">
                      <td className="py-2 pr-3 font-mono text-[11px]">
                        {assoc.variable_meteo} ↔ {assoc.variable_productiva}
                        <span className="mt-0.5 block font-sans text-[11px] text-app-dim">
                          medias: {assoc.media_meteo ?? "n/d"} · {assoc.media_productiva ?? "n/d"} kg
                        </span>
                      </td>
                      <td className="py-2 pr-3 font-bold">{assoc.n}</td>
                      <td className="py-2 pr-3 font-bold">
                        {assoc.pearson_r == null ? "n/d" : assoc.pearson_r.toFixed(2)}
                      </td>
                      <td className="py-2 text-app-dim">{assoc.interpretacion}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
