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
    set({ isHydrated: true });
  },

  setWorker: (w) => set({ worker: w }),

  clearWorker: () => set({ worker: null }),
}));
