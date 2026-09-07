"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { onSessionExpired, refreshSession } from "@/lib/api";
import { useAppStore } from "@/store/app-store";

/**
 * Mantiene la sesión viva y maneja su expiración.
 *
 * - Llama a ``POST /auth/refresh`` cada 50 minutos para renovar el
 *   access antes de que caduque a los 60.
 * - Si ``onSessionExpired`` se dispara (refresh caducado, reuse
 *   detection, etc.), limpia el store y redirige a /login.
 *
 * Se monta en ``app/(app)/layout.tsx`` para que solo corra cuando
 * el usuario está autenticado.
 */
export function SessionKeeper() {
  const router = useRouter();

  useEffect(() => {
    const cleanupExpired = onSessionExpired(() => {
      // El refresh no pudo rotar: la sesión murió. Limpiamos y
      // mandamos al login. El layout padre ya hace el redirect
      // por su propio useEffect, pero forzamos aquí por si la
      // transición visual tarda.
      useAppStore.getState().logout();
      router.replace("/");
    });
    return cleanupExpired;
  }, [router]);

  useEffect(() => {
    // Solo rotamos si hay user en el store — equivalente a "hay
    // sesión activa que vale la pena mantener".
    const user = useAppStore.getState().user;
    if (!user) return;

    const FIFTY_MIN = 50 * 60_000;
    const tick = () => {
      refreshSession().catch(() => undefined);
    };
    const id = window.setInterval(tick, FIFTY_MIN);
    return () => window.clearInterval(id);
  }, []);

  return null;
}
