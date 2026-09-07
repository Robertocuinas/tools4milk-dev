"use client";

import { create } from "zustand";
import { ACTIVE_ZONE_STORAGE_KEY, USER_STORAGE_KEY } from "@/lib/config";
import type { AuthUser, UserRole } from "@/lib/types";

type AppState = {
  activeZoneId: string;
  /** Usuario autenticado en la sesión actual. Persistido en localStorage
   *  para sobrevivir a recargas. El JWT NO vive aquí — está en una cookie
   *  HttpOnly que emite el backend en ``POST /api/v1/auth/login`` y que el
   *  navegador adjunta automáticamente con ``credentials: "include"``. */
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

const readStoredUser = (): AuthUser | null => {
  const raw = window.localStorage.getItem(USER_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    window.localStorage.removeItem(USER_STORAGE_KEY);
    return null;
  }
};

export const useAppStore = create<AppState>((set) => ({
  activeZoneId: "ordeno",
  user: null,
  selectedRole: "operario",
  isHydrated: false,

  hydrate: () => {
    if (typeof window === "undefined") return;
    const activeZoneId = window.localStorage.getItem(ACTIVE_ZONE_STORAGE_KEY) ?? "ordeno";
    const user = readStoredUser();

    set({ user, activeZoneId, isHydrated: true });
  },

  setActiveZone: (zoneId) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ACTIVE_ZONE_STORAGE_KEY, zoneId);
    }
    set({ activeZoneId: zoneId });
  },

  setSelectedRole: (role) => set({ selectedRole: role }),

  setSession: (user) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    }
    set({ user });
  },

  setUser: (user) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    }
    set({ user });
  },

  logout: () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(USER_STORAGE_KEY);
    }
    set({ user: null });
  },
}));

// Auth store alias for convenience
export const useAuthStore = useAppStore;
