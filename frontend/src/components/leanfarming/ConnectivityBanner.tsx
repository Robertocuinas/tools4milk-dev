"use client";

import { useEffect, useState } from "react";
import { canQueueOffline, getSyncMetrics, listOutbox, syncOutbox } from "@/lib/offline-outbox";

export function ConnectivityBanner() {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [indexedDbAvailable] = useState(() => canQueueOffline());
  const [metrics, setMetrics] = useState({ queued: 0, synced: 0, deduplicated: 0, conflicts: 0, failed: 0, retry_count: 0 });

  useEffect(() => {
    const refresh = () => {
      setOnline(navigator.onLine);
      void listOutbox().then((items) => setPending(items.filter((item) => item.state !== "synced").length)).catch(() => undefined);
      if (navigator.onLine) void syncOutbox();
      void getSyncMetrics().then(setMetrics);
    };
    refresh();
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    const timer = window.setInterval(refresh, 15_000);
    return () => {
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", refresh);
      window.clearInterval(timer);
    };
  }, []);

  const label = !indexedDbAvailable
    ? "Modo degradado: este navegador no permite guardar cambios offline"
    : !online
      ? `Sin conexión: los cambios se guardarán en este dispositivo${pending ? ` (${pending} pendientes)` : ""}`
      : pending
        ? `${pending} cambios pendientes de sincronizar`
        : "Conectado";

  return (
    <div role="status" aria-live="polite" className="border-b border-app-border bg-white px-6 py-2 text-xs font-semibold text-app-dim lg:px-8">
      <span aria-hidden="true" className={`mr-2 inline-block h-2 w-2 rounded-full ${online && indexedDbAvailable ? "bg-state-ok" : "bg-state-atencion"}`} />
      {label}. Cola: {metrics.queued} encoladas, {metrics.synced} sincronizadas, {metrics.deduplicated} replay, {metrics.conflicts} conflictos, {metrics.failed} fallidas, {metrics.retry_count} reintentos.
    </div>
  );
}
