"use client";

import { useEffect, useState } from "react";

export type QueryStatusInfo = {
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  dataUpdatedAt: number;
};

type TvRefreshStatusProps = {
  queries: QueryStatusInfo[];
  className?: string;
};

/**
 * Shows a dot + text indicator of data freshness for TV screens.
 * - Green dot: data is fresh, no active fetch
 * - Amber dot (pulsing): refetching data in background
 * - Red dot (pulsing): one or more queries are in error state
 * Re-renders every 10 s to keep the "X seconds ago" label current.
 */
export function TvRefreshStatus({ queries, className = "" }: TvRefreshStatusProps) {
  const [now, setNow] = useState(Date.now);

  // Tick every 10 s to update the "X s ago" label without hammering the DOM
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(t);
  }, []);

  const hasError = queries.some((q) => q.isError);
  const isFetching = queries.some((q) => q.isFetching || q.isLoading);
  const lastUpdate = Math.max(0, ...queries.map((q) => q.dataUpdatedAt));
  const secondsAgo = lastUpdate > 0 ? Math.round((now - lastUpdate) / 1000) : null;

  const dotClass = hasError
    ? "bg-state-critica animate-pulse"
    : isFetching
      ? "bg-state-atencion animate-pulse"
      : "bg-tv-accent";

  let label: string;
  if (hasError) {
    label = "Error en algunos datos";
  } else if (isFetching) {
    label = "Actualizando…";
  } else if (secondsAgo === null) {
    label = "Sin datos";
  } else if (secondsAgo < 60) {
    label = `Hace ${secondsAgo}s`;
  } else {
    label = `Hace ${Math.round(secondsAgo / 60)} min`;
  }

  return (
    <div className={`flex items-center gap-2 text-xs text-tv-dim ${className}`}>
      <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} />
      {label}
    </div>
  );
}
