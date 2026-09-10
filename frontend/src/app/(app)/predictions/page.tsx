"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import {
  BrainCircuit,
  CloudSun,
  ExternalLink,
  Minus,
  RefreshCw,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { DonutStat, SparkArea } from "@/components/charts/MiniCharts";
import { Pagination } from "@/components/common/Pagination";
import { WeatherCorrelationPanel } from "@/components/dss/WeatherCorrelationPanel";
import { api } from "@/lib/api";
import { DEFAULT_PAGE_SIZE, getSkip } from "@/lib/pagination";
import type {
  Animal,
  CompositionPrediction,
  HealthRiskPrediction,
  PredictionTrend,
  ProductionPrediction,
  RiskLevel,
} from "@/lib/types";

type Vista = "compuesta" | "produccion" | "composicion" | "riesgo" | "meteo";

const VISTAS: { id: Vista; label: string }[] = [
  { id: "compuesta", label: "Compuesta" },
  { id: "produccion", label: "Producción" },
  { id: "composicion", label: "Composición" },
  { id: "riesgo", label: "Riesgo sanitario" },
  { id: "meteo", label: "Asociación meteo" },
];

const trendIcon: Record<PredictionTrend, typeof TrendingUp> = {
  aumento: TrendingUp,
  descenso: TrendingDown,
  estable: Minus,
};

const trendColor: Record<PredictionTrend, string> = {
  aumento: "text-state-ok",
  descenso: "text-state-critica",
  estable: "text-app-dim",
};

const riskStyle: Record<RiskLevel, string> = {
  bajo: "border-state-ok/30 bg-state-ok/10 text-state-ok-ink",
  medio: "border-state-atencion/30 bg-state-atencion/10 text-state-atencion-ink",
  alto: "border-state-critica/30 bg-state-critica/10 text-state-critica-ink",
  critico: "border-state-critica bg-state-critica/20 text-state-critica-ink",
};

function isForbidden(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /403|permiso/i.test(message);
}

// Etiqueta honesta: las estimaciones son heurísticas aritméticas, no un modelo de ML.
// Por eso NO se muestra un "% de confianza" que pudiera sugerir un modelo predictivo entrenado.
function HeuristicTag() {
  return (
    <span
      className="rounded-full bg-app-bg px-2 py-0.5 text-[10px] font-bold text-app-dim"
      title="Estimación heurística aritmética, no un modelo de machine learning"
    >
      heurístico
    </span>
  );
}

function MetricBox({
  label,
  value,
  tone = "text-white",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-[10px] bg-app-bg p-3 text-center">
      <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-app-dim">{label}</div>
      <div className={`mt-1 font-heading text-lg font-bold capitalize ${tone}`}>{value}</div>
    </div>
  );
}

type CardData = {
  produccion?: ProductionPrediction | null;
  composicion?: CompositionPrediction | null;
  riesgo_sanitario?: HealthRiskPrediction | null;
  _mock?: boolean;
};

// Componente autocontenido: gestiona su propia query cacheada por animal y vista.
// La vista granular consume el endpoint dedicado (/predictions/production/...,
// /predictions/composition/..., /predictions/health-risk/...); la compuesta
// usa /predictions/{id}.
function PredictionCard({
  animal,
  enabled,
  onEnable,
  vista,
}: {
  animal: Animal;
  enabled: boolean;
  onEnable: (id: string) => void;
  vista: Exclude<Vista, "meteo">;
}) {
  const predQuery = useQuery({
    queryKey: ["prediction", vista, animal.id],
    queryFn: async (): Promise<CardData> => {
      const params = { dias_adelante: 7 };
      if (vista === "produccion") {
        const produccion = await api.productionPrediction(animal.id, params);
        return { produccion };
      }
      if (vista === "composicion") {
        const composicion = await api.compositionPrediction(animal.id);
        return { composicion };
      }
      if (vista === "riesgo") {
        const riesgo_sanitario = await api.healthRiskPrediction(animal.id, params);
        return { riesgo_sanitario };
      }
      return api.predictions(animal.id, params);
    },
    enabled,
    staleTime: 5 * 60_000,   // 5 min: no refetch si los datos son frescos
    gcTime: 30 * 60_000,     // 30 min: mantener en caché aunque el componente se desmonte
    retry: 1,
  });

  const prediction = predQuery.data;
  const prod = prediction?.produccion;
  const comp = prediction?.composicion;
  const risk = prediction?.riesgo_sanitario;
  const riskLevel = risk?.riesgo_promedio ?? "bajo";
  const hasAlert = riskLevel === "alto" || riskLevel === "critico" || prod?.tendencia === "descenso";
  const TrendIcon = prod ? trendIcon[prod.tendencia] : Minus;
  const showProd = vista === "compuesta" || vista === "produccion";
  const showComp = vista === "compuesta" || vista === "composicion";
  const showRisk = vista === "compuesta" || vista === "riesgo";

  return (
    <div className={`rounded-[10px] border bg-white p-4 ${hasAlert ? "border-state-critica/35" : "border-app-border"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Link
              href={`/animals/${animal.id}`}
              className="font-mono text-sm font-bold text-brand hover:underline"
            >
              {animal.crotal_oficial}
            </Link>
            {animal.nombre && <span className="text-sm text-app-dim">{animal.nombre}</span>}
            <Link href={`/animals/${animal.id}`} className="text-app-dim hover:text-brand" title="Ver ficha">
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="mt-1 flex flex-wrap gap-2 text-xs text-app-dim">
            {animal.raza && <span>{animal.raza}</span>}
            <span className="capitalize">{animal.estado}</span>
          </div>
        </div>
        {prediction && showRisk && (
          <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase ${riskStyle[riskLevel]}`}>
            {riskLevel}
          </span>
        )}
        {/* Indicador de datos mock */}
        {prediction?._mock && (
          <span className="shrink-0 rounded-full bg-state-atencion/10 px-2 py-0.5 text-[10px] font-bold text-state-atencion-ink">
            demo
          </span>
        )}
      </div>

      {predQuery.isError && (
        <div className="mt-3 space-y-2">
          <div
            role="alert"
            className="rounded-[10px] bg-state-critica/10 px-3 py-2 text-xs font-semibold text-state-critica-ink"
          >
            {isForbidden(predQuery.error)
              ? "Sin permiso para ver predicciones (requiere admin, veterinario o alimentación)"
              : "Error al cargar prediccion"}
          </div>
          <button
            type="button"
            onClick={() => predQuery.refetch()}
            disabled={predQuery.isFetching}
            className="rounded-[10px] bg-app-bg px-4 py-2 text-xs font-bold text-brand transition hover:bg-app-bg disabled:opacity-50"
          >
            Reintentar
          </button>
        </div>
      )}

      {predQuery.isFetching && !prediction && (
        <div className="mt-4 flex justify-center py-6">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        </div>
      )}

      {prediction && (prod || comp || risk) ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-[10px] border border-state-atencion/30 bg-state-atencion/10 px-3 py-2 text-[11px] font-semibold text-state-atencion-ink">
            Demo sintética · heurística aritmética · no validada en campo · no es recomendación clínica/productiva
          </div>
          {vista !== "compuesta" && (
            <div className="text-[11px] font-semibold text-app-dim">
              Vista granular · endpoint dedicado{" "}
              <span className="font-mono">
                /predictions/{vista === "riesgo" ? "health-risk" : vista}/{animal.id}
              </span>
            </div>
          )}
          {showProd && prod && (
          <div className="rounded-[10px] bg-app-bg p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-app-dim">
                Produccion prevista
              </span>
              <HeuristicTag />
            </div>
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className={`font-heading text-3xl font-bold ${trendColor[prod.tendencia]}`}>
                  {prod.produccion_promedio_predicha.toFixed(1)} L/d
                </div>
                <div className="mt-1 flex items-center gap-1 text-xs text-app-dim">
                  <TrendIcon className={`h-4 w-4 ${trendColor[prod.tendencia]}`} />
                  <span className="capitalize">{prod.tendencia}</span>
                  {prod.produccion_minima_predicha != null && prod.produccion_maxima_predicha != null && (
                    <span className="ml-1 text-app-dim">
                      ({prod.produccion_minima_predicha.toFixed(1)}-{prod.produccion_maxima_predicha.toFixed(1)} L)
                    </span>
                  )}
                </div>
              </div>
              {prod.series_diaria && prod.series_diaria.length > 1 && (
                <div className="h-12 w-32">
                  <SparkArea
                    height={46}
                    color={prod.tendencia === "descenso" ? "#dc2626" : "#35E479"}
                    data={prod.series_diaria.map((value, index) => ({
                      label: String(index + 1),
                      value,
                    }))}
                  />
                </div>
              )}
            </div>
          </div>
          )}

          {showComp && comp && (
          <div className="rounded-[10px] bg-app-bg p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-app-dim">
                Composición prevista
              </span>
              <HeuristicTag />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <MetricBox label="Grasa" value={comp.grasa && comp.grasa.prediccion > 0 ? `${comp.grasa.prediccion.toFixed(2)}%` : "n/d"} />
              <MetricBox label="Proteína" value={comp.proteina && comp.proteina.prediccion > 0 ? `${comp.proteina.prediccion.toFixed(2)}%` : "n/d"} />
              <MetricBox
                label="Anomalía"
                value={comp.anomalia_detectada ? "sí" : "no"}
                tone={comp.anomalia_detectada ? "text-state-critica" : "text-state-ok"}
              />
            </div>
            <p className="mt-2 text-[11px] text-app-dim">
              La composición es un placeholder (0 → n/d): aún no se calcula a partir de datos.
            </p>
          </div>
          )}

          {showRisk && (vista === "riesgo" ? (
            <MetricBox
              label="Riesgo"
              value={riskLevel}
              tone={riskLevel === "bajo" ? "text-state-ok" : riskLevel === "medio" ? "text-state-atencion" : "text-state-critica"}
            />
          ) : (
          <div className="grid grid-cols-3 gap-2">
            <MetricBox label="Grasa" value={comp?.grasa && comp.grasa.prediccion > 0 ? `${comp.grasa.prediccion.toFixed(2)}%` : "n/d"} />
            <MetricBox label="Proteina" value={comp?.proteina && comp.proteina.prediccion > 0 ? `${comp.proteina.prediccion.toFixed(2)}%` : "n/d"} />
            <MetricBox
              label="Riesgo"
              value={riskLevel}
              tone={riskLevel === "bajo" ? "text-state-ok" : riskLevel === "medio" ? "text-state-atencion" : "text-state-critica"}
            />
          </div>
          ))}

          {showRisk && risk?.factores_riesgo && risk.factores_riesgo.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {risk.factores_riesgo.slice(0, 3).map((factor) => (
                <span key={factor} className="rounded-full bg-state-atencion/10 px-2.5 py-0.5 text-[11px] font-semibold text-state-atencion-ink">
                  {factor}
                </span>
              ))}
            </div>
          )}
        </div>
      ) : !predQuery.isFetching && !predQuery.isError && (
        <div className="py-8 text-center">
          <BrainCircuit className="mx-auto h-8 w-8 text-app-dim" strokeWidth={1.5} />
          <p className="mt-2 text-xs text-app-dim">Sin prediccion cargada</p>
          <button
            type="button"
            onClick={() => onEnable(animal.id)}
            disabled={predQuery.isFetching}
            className="mt-3 rounded-[10px] bg-app-bg px-4 py-2 text-xs font-bold text-brand transition hover:bg-app-bg disabled:opacity-50"
          >
            Obtener prediccion
          </button>
        </div>
      )}
    </div>
  );
}

export default function PredictionsPage() {
  // Set de IDs cuya prediccion debe cargarse (persistido en el componente)
  const [enabledIds, setEnabledIds] = useState<Set<string>>(() => new Set());
  const [page, setPage] = useState(1);
  const [vista, setVista] = useState<Vista>("compuesta");
  const pageSize = DEFAULT_PAGE_SIZE;
  // En la vista meteo las tarjetas muestran el contexto de producción.
  const cardVista: Exclude<Vista, "meteo"> = vista === "meteo" ? "produccion" : vista;

  const animalsQuery = useQuery({
    queryKey: ["animals-produccion", page],
    queryFn: () =>
      api.animals({
        estado: "produccion",
        skip: getSkip(page, pageSize),
        limit: pageSize + 1,
      }),
    staleTime: 60_000,
  });

  const fetchedAnimals = animalsQuery.data ?? [];
  const hasNext = fetchedAnimals.length > pageSize;
  const pageAnimals = fetchedAnimals.slice(0, pageSize);

  const enableAnimal = useCallback((id: string) => {
    setEnabledIds((prev) => new Set([...prev, id]));
  }, []);

  function loadPage() {
    const ids = pageAnimals.slice(0, 10).map((a) => a.id);
    setEnabledIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      return next;
    });
  }

  // useQueries para estadísticas reactivas — comparte caché con cada PredictionCard
  // (React Query deduplica: no genera peticiones extra cuando el card ya hizo la suya)
  const enabledIdsList = useMemo(() => Array.from(enabledIds), [enabledIds]);

  const predictionResults = useQueries({
    queries: enabledIdsList.map((id) => ({
      queryKey: ["prediction", id],
      queryFn: () => api.predictions(id, { dias_adelante: 7 }),
      staleTime: 5 * 60_000,
      gcTime: 30 * 60_000,
      retry: 1,
    })),
  });

  const stats = useMemo(() => {
    const loaded = predictionResults.filter((q) => q.isSuccess).length;
    const withAlert = predictionResults.filter(
      (q) =>
        q.data?.riesgo_sanitario?.riesgo_promedio === "alto" ||
        q.data?.riesgo_sanitario?.riesgo_promedio === "critico" ||
        q.data?.produccion?.tendencia === "descenso",
    ).length;
    return { loaded, withAlert };
  }, [predictionResults]);

  const sparkData = useMemo(
    () =>
      predictionResults
        .filter((q) => q.isSuccess && q.data?.produccion)
        .slice(0, 8)
        .map((q, i) => ({
          label: String(i + 1),
          value: q.data!.produccion!.produccion_promedio_predicha,
        })),
    [predictionResults],
  );

  return (
    <div className="min-h-full">
      <div className="border-b border-app-border px-6 py-5 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.18em] text-app-dim">
              <BrainCircuit className="h-4 w-4 text-brand" />
              Prediccion DSS
            </div>
            <h1 className="mt-1 font-heading text-2xl font-bold text-app-text">Predicciones</h1>
          </div>
          <button
            type="button"
            onClick={loadPage}
            disabled={animalsQuery.isLoading || pageAnimals.length === 0}
            className="inline-flex items-center gap-2 rounded-[10px] bg-brand px-4 py-2 text-sm font-bold text-white shadow-brand transition hover:bg-[#135532] disabled:opacity-50"
          >
            <RefreshCw className="h-4 w-4" />
            Cargar pagina
          </button>
        </div>
        <div role="tablist" aria-label="Vista de predicción" className="mt-4 flex flex-wrap gap-2">
          {VISTAS.map(({ id, label }) => {
            const selected = vista === id;
            const Icon = id === "meteo" ? CloudSun : id === "riesgo" ? ShieldAlert : BrainCircuit;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setVista(id)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold transition ${
                  selected
                    ? "border-brand bg-brand text-white"
                    : "border-app-border bg-white text-app-dim hover:text-app-text"
                }`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-6 px-6 py-6 lg:px-8">
        <div className="grid gap-3 md:grid-cols-3">
          {[
            { label: "Cargadas", value: stats.loaded, color: "text-white", Icon: BrainCircuit },
            { label: "Con alerta", value: stats.withAlert, color: "text-state-atencion", Icon: ShieldAlert },
            { label: "Animales", value: pageAnimals.length, color: "text-brand", Icon: RefreshCw },
          ].map(({ label, value, color, Icon }) => (
            <div key={label} className="rounded-[10px] border border-app-border bg-white p-4">
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${color}`} />
                <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-app-dim">
                  {label}
                </span>
              </div>
              <div className={`mt-2 font-heading text-4xl font-bold ${color}`}>{value}</div>
            </div>
          ))}
        </div>

        {/*
          Banner explícito de transparencia: las predicciones son heurísticas
          aritméticas, no un modelo ML. Se muestra siempre que la página está
          abierta (incluso si no hay predicciones cargadas todavía) para que
          el operario no confunda un número con una proyección entrenada.
        */}
        <div
          role="note"
          className="flex items-start gap-2 rounded-[10px] border border-state-info/30 bg-state-info/5 px-4 py-3 text-xs font-semibold text-state-info-ink"
        >
          <BrainCircuit className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div>
            Estimaciones calculadas mediante <strong>heurísticas aritméticas</strong>{" "}
            (no modelos de machine learning). La composición de leche (grasa/proteína) es
            un placeholder y se muestra como «n/d». Horizonte orientativo de 7 días; las
            recomendaciones no sustituyen el criterio veterinario.
          </div>
        </div>

        {vista === "meteo" && <WeatherCorrelationPanel />}

        {stats.loaded > 0 && (
          <div className="grid gap-4 xl:grid-cols-[1.4fr_280px]">
            <div className="rounded-[10px] border border-app-border bg-white p-5">
              <div className="mb-4 text-xs font-extrabold uppercase tracking-[0.18em] text-app-dim">
                Produccion prevista por animal
              </div>
              <div className="h-28">
                <SparkArea data={sparkData} />
              </div>
            </div>
            <div className="rounded-[10px] border border-app-border bg-white p-5">
              <DonutStat value={stats.loaded ? Math.round(((stats.loaded - stats.withAlert) / stats.loaded) * 100) : 0} label="sin alerta" />
            </div>
          </div>
        )}

        {animalsQuery.isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-64 animate-pulse rounded-[10px] bg-white" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {pageAnimals.map((animal) => (
              <PredictionCard
                key={`${cardVista}-${animal.id}`}
                animal={animal}
                enabled={enabledIds.has(animal.id)}
                onEnable={enableAnimal}
                vista={cardVista}
              />
            ))}
          </div>
        )}

        {!animalsQuery.isLoading && pageAnimals.length > 0 && (
          <Pagination
            page={page}
            pageSize={pageSize}
            currentCount={pageAnimals.length}
            hasNext={hasNext}
            isLoading={animalsQuery.isFetching}
            onPageChange={setPage}
          />
        )}
      </div>
    </div>
  );
}
