"use client";

import { create } from "zustand";
import {
  ACTIVE_ZONE_STORAGE_KEY,
  TOKEN_STORAGE_KEY,
  USER_STORAGE_KEY,
} from "@/lib/config";
import type { AuthUser, UserRole } from "@/lib/types";

type AppState = {
  activeZoneId: string;
  token: string | null;
  user: AuthUser | null;
  selectedRole: UserRole;
  isHydrated: boolean;
  hydrate: () => void;
  setActiveZone: (zoneId: string) => void;
  setSelectedRole: (role: UserRole) => void;
  setSession: (token: string, user: AuthUser) => void;
  setToken: (token: string) => void;
  setUser: (user: AuthUser) => void;
  logout: () => void;
};

const AUTH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 8;

const setAuthCookie = (token: string) => {
  if (typeof document === "undefined") return;
  document.cookie = `${TOKEN_STORAGE_KEY}=${encodeURIComponent(token)}; path=/; max-age=${AUTH_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
};

const clearAuthCookie = () => {
  if (typeof document === "undefined") return;
  document.cookie = `${TOKEN_STORAGE_KEY}=; path=/; max-age=0; SameSite=Lax`;
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
  token: null,
  user: null,
  selectedRole: "operario",
  isHydrated: false,

  hydrate: () => {
    if (typeof window === "undefined") return;
    const token = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    const activeZoneId = window.localStorage.getItem(ACTIVE_ZONE_STORAGE_KEY) ?? "ordeno";
    const user = readStoredUser();

    set({ token, user, activeZoneId, isHydrated: true });
  },

  setActiveZone: (zoneId) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ACTIVE_ZONE_STORAGE_KEY, zoneId);
    }
    set({ activeZoneId: zoneId });
  },

  setSelectedRole: (role) => set({ selectedRole: role }),

  setSession: (token, user) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
      window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
      setAuthCookie(token);
    }
    set({ token, user });
  },

  setToken: (token) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
      setAuthCookie(token);
    }
    set({ token });
  },

  setUser: (user) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    }
    set({ user });
  },

  logout: () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
      window.localStorage.removeItem(USER_STORAGE_KEY);
      clearAuthCookie();
    }
    set({ token: null, user: null });
  },
}));

// Auth store alias for convenience
export const useAuthStore = useAppStore;
