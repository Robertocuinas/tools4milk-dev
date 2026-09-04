/**
 * Active worker store — local/experimental mode for worker selection.
 *
 * This store holds the currently selected "worker" (empleado) for the session.
 * It is PURELY LOCAL — not persisted to the backend, not used for real auth.
 *
 * Purpose: Preview how the app would behave if the current user is operating
 * as a specific employee, before backend implements user↔employee linking.
 *
 * TODO (Phase 13): When backend exposes POST /auth/select-worker or similar,
 * replace this local store with a real server-side session capability.
 *
 * Usage:
 *   const { worker, setWorker, clearWorker } = useActiveWorkerStore();
 */

import { create } from "zustand";

const WORKER_KEY = "t4m-active-worker";

export type ActiveWorker = {
  id: string;
  name: string;
  role: string;  // employee rol: encargado | auxiliar | veterinario | mecanico
};

type ActiveWorkerState = {
  worker: ActiveWorker | null;
  isHydrated: boolean;
  hydrate: () => void;
  setWorker: (w: ActiveWorker) => void;
  clearWorker: () => void;
};

export const useActiveWorkerStore = create<ActiveWorkerState>((set) => ({
  worker: null,
  isHydrated: false,

  hydrate: () => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(WORKER_KEY);
      const worker = raw ? (JSON.parse(raw) as ActiveWorker) : null;
      set({ worker, isHydrated: true });
    } catch {
      set({ worker: null, isHydrated: true });
    }
  },

  setWorker: (w) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(WORKER_KEY, JSON.stringify(w));
    }
    set({ worker: w });
  },

  clearWorker: () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(WORKER_KEY);
    }
    set({ worker: null });
  },
}));
