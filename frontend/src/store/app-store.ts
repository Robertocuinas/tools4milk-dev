"use client";

import { create } from "zustand";
import { ACTIVE_ZONE_STORAGE_KEY } from "@/lib/config";
import type { AuthUser, UserRole } from "@/lib/types";

type AppState = {
  activeZoneId: string;
  /** Usuario autenticado solo en memoria; la sesión persistente es HttpOnly. */
  user: AuthUser | null;
  selectedRole: UserRole;
  isHydrated: boolean;
  hydrate: () => void;
  setActiveZone: (zoneId: string) => void;
  setSelectedRole: (role: UserRole) => void;
  setSession: (user: AuthUser) => void;
  setUser: (user: AuthUser) => void;
  logout: () => void;
};

export const useAppStore = create<AppState>((set) => ({
  activeZoneId: "ordeno",
  user: null,
  selectedRole: "operario",
  isHydrated: false,

  hydrate: () => {
    if (typeof window === "undefined") return;
    const activeZoneId = window.localStorage.getItem(ACTIVE_ZONE_STORAGE_KEY) ?? "ordeno";
    set({ activeZoneId, isHydrated: true });
  },

  setActiveZone: (zoneId) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ACTIVE_ZONE_STORAGE_KEY, zoneId);
    }
    set({ activeZoneId: zoneId });
  },

  setSelectedRole: (role) => set({ selectedRole: role }),

  setSession: (user) => {
    set({ user });
  },

  setUser: (user) => set({ user }),

  logout: () => set({ user: null }),
}));

// Auth store alias for convenience
export const useAuthStore = useAppStore;
