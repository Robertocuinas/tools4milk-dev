"use client";

import { useQuery } from "@tanstack/react-query";
import { CloudSun, Droplets, Wind } from "lucide-react";
import { api } from "@/lib/api";
import { TV_REFETCH, TV_STALE } from "@/lib/tv-constants";
import type { WeatherForecastDay } from "@/lib/types";

function formatTemp(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${v.toFixed(0)}°C`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("es-ES", { weekday: "short", day: "2-digit", month: "short" });
}

type WeatherPanelProps = {
  /** compact = single row of current conditions, no forecast */
  compact?: boolean;
  /** dark = use TV dark theme (for use inside dark panels) */
  dark?: boolean;
};

export function WeatherPanel({ compact = false, dark = false }: WeatherPanelProps) {
  const currentQ = useQuery({
    queryKey: ["weather-current"],
    queryFn: api.weather,
    staleTime: TV_STALE.VERY_SLOW,
    refetchInterval: TV_REFETCH.VERY_SLOW,
  });

  const forecastQ = useQuery({
    queryKey: ["weather-forecast"],
    queryFn: api.weatherForecast,
    staleTime: TV_STALE.VERY_SLOW,
    refetchInterval: TV_REFETCH.VERY_SLOW,
    enabled: !compact,
  });

  const w = currentQ.data;
  const forecast = forecastQ.data?.dias ?? [];
  const location = currentQ.data?.ubicacion ?? forecastQ.data?.ubicacion ?? "Villalba, Lugo";

  // Theme classes
  const card = dark
    ? "rounded-xl border border-tv-border bg-tv-surface"
    : "rounded-[10px] border border-app-border bg-white";
  const title = dark ? "text-tv-dim" : "text-app-dim";
  const value = dark ? "text-white" : "text-app-text";
  const sub = dark ? "text-tv-dim" : "text-app-dim";

  if (currentQ.isLoading) {
    return (
      <div className={`${card} p-4`}>
        <div className="flex items-center gap-2">
          <CloudSun className="h-4 w-4 text-state-info" />
          <span className={`text-[11px] font-extrabold uppercase tracking-[0.16em] ${title}`}>Meteorología</span>
        </div>
        <div className="mt-2 h-8 animate-pulse rounded bg-app-surface2" />
      </div>
    );
  }

  if (currentQ.isError) {
    return (
      <div className={`${card} p-4`}>
        <p className={`text-xs ${sub}`}>Datos meteorológicos no disponibles.</p>
      </div>
    );
  }

  const temp = w?.temperatura_actual ?? w?.temperatura;
  const noData = temp == null && !w?.humedad;

  if (compact) {
    return (
      <div className={`${card} flex items-center gap-4 px-4 py-3`}>
        <CloudSun className="h-5 w-5 shrink-0 text-state-info" />
        <div>
          <p className={`text-[11px] font-extrabold uppercase tracking-[0.14em] ${title}`}>
            {location}
          </p>
          <p className={`text-sm font-semibold ${value}`}>
            {noData ? "Sin datos" : `${formatTemp(temp)}${w?.humedad != null ? ` · ${w.humedad.toFixed(0)}% HR` : ""}`}
          </p>
        </div>
        {w?.impacto_productivo && (
          <span className={`ml-auto text-xs ${sub}`}>{w.impacto_productivo}</span>
        )}
      </div>
    );
  }

  return (
    <div className={`${card} overflow-hidden`}>
      {/* Current conditions */}
      <div className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CloudSun className="h-4 w-4 text-state-info" />
            <span className={`text-[11px] font-extrabold uppercase tracking-[0.16em] ${title}`}>
              Meteorología · {location}
            </span>
          </div>
          {w?.fecha && (
            <span className={`text-[11px] ${sub}`}>
              {new Date(w.fecha).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>

        {noData ? (
          <p className={`mt-3 text-sm ${sub}`}>
            Sin lecturas meteorológicas recientes. Usa el botón &quot;Sincronizar AEMET&quot; en Integration.
          </p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-4">
            <div>
              <p className={`text-[10px] font-semibold uppercase ${title}`}>Temperatura</p>
              <p className={`font-heading text-3xl font-bold ${value}`}>{formatTemp(temp)}</p>
            </div>
            {w?.humedad != null && (
              <div>
                <p className={`text-[10px] font-semibold uppercase ${title}`}>Humedad</p>
                <div className={`flex items-center gap-1 font-heading text-xl font-bold ${value}`}>
                  <Droplets className="h-4 w-4 text-state-info" />
                  {w.humedad.toFixed(0)}%
                </div>
              </div>
            )}
            {w?.impacto_productivo && (
              <div>
                <p className={`text-[10px] font-semibold uppercase ${title}`}>Impacto</p>
                <p className={`text-sm font-semibold capitalize ${value}`}>{w.impacto_productivo}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Forecast */}
      {forecast.length > 0 && (
        <div className={`border-t ${dark ? "border-tv-border" : "border-app-border"} p-4`}>
          <p className={`mb-3 text-[11px] font-extrabold uppercase tracking-[0.14em] ${title}`}>
            Previsión disponible · {forecast.length} lecturas
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {forecast.slice(0, 7).map((day: WeatherForecastDay, i: number) => (
              <div
                key={day.fecha ?? i}
                className={`flex min-w-[80px] shrink-0 flex-col items-center rounded-[10px] p-2.5 text-center ${dark ? "bg-tv-surface2" : "bg-app-bg"}`}
              >
                <p className={`text-[10px] font-semibold capitalize ${sub}`}>{formatDate(day.fecha)}</p>
                <p className={`mt-1 font-heading text-base font-bold ${value}`}>
                  {formatTemp(day.temperatura_media)}
                </p>
                {day.prob_precipitacion_pct != null && day.prob_precipitacion_pct > 0 ? (
                  <p className="mt-0.5 text-[10px] text-state-info">
                    <Droplets className="mr-0.5 inline h-2.5 w-2.5" />{day.prob_precipitacion_pct.toFixed(0)}% lluvia
                  </p>
                ) : day.precipitacion != null && day.precipitacion > 0 ? (
                  <p className="mt-0.5 text-[10px] text-state-info">
                    <Droplets className="mr-0.5 inline h-2.5 w-2.5" />{day.precipitacion.toFixed(0)} mm
                  </p>
                ) : null}
                {day.viento != null && (
                  <p className={`mt-0.5 text-[10px] ${sub}`}>
                    <Wind className="mr-0.5 inline h-2.5 w-2.5" />{day.viento.toFixed(0)}
                  </p>
                )}
                {day.humedad != null && (
                  <p className={`mt-0.5 text-[10px] ${sub}`}>{day.humedad.toFixed(0)}%</p>
                )}
              </div>
            ))}
          </div>
          <p className={`mt-2 text-[10px] ${sub}`}>
            Fuente: {forecast[0]?.fuente ?? "AEMET"} · Datos de sensores locales
          </p>
        </div>
      )}

      {!compact && forecast.length === 0 && !forecastQ.isLoading && (
        <div className={`border-t ${dark ? "border-tv-border" : "border-app-border"} px-4 py-3`}>
          <p className={`text-xs ${sub}`}>
            Previsión no disponible. Sincroniza datos AEMET desde Integración.
          </p>
        </div>
      )}
    </div>
  );
}
