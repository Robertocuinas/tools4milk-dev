"use client";

import { useEffect, useState } from "react";
import { canQueueOffline, listOutbox } from "@/lib/offline-outbox";

export function ConnectivityBanner() {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [indexedDbAvailable] = useState(() => canQueueOffline());

  useEffect(() => {
    const refresh = () => {
      setOnline(navigator.onLine);
      void listOutbox().then((items) => setPending(items.filter((item) => item.state !== "synced").length)).catch(() => undefined);
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
      {label}
    </div>
  );
}
