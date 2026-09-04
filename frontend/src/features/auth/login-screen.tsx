"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import {
  HeartPulse,
  Loader2,
  Milk,
  ShieldCheck,
  Sprout,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { UserRole } from "@/lib/types";
import { useAppStore } from "@/store/app-store";

const roles: {
  value: UserRole;
  label: string;
  short: string;
  Icon: typeof ShieldCheck;
}[] = [
  { value: "admin", label: "Gestor / Administrador", short: "Control", Icon: ShieldCheck },
  { value: "veterinario", label: "Veterinario", short: "Sanidad", Icon: HeartPulse },
  { value: "alimentacion", label: "Responsable alimentación", short: "Nutrición", Icon: Sprout },
];

const demoUsers = [
  { username: "admin", role: "admin" as const, label: "Administrador", password: "testpass123" },
  { username: "roberto.castro", role: "admin" as const, label: "Gestor", password: "testpass123" },
  { username: "operario.zona", role: "operario" as const, label: "Sala ordeño", password: "testpass123" },
  { username: "laura.fernandez", role: "alimentacion" as const, label: "Alimentación", password: "testpass123" },
  { username: "dr.mendez", role: "veterinario" as const, label: "Veterinario", password: "testpass123" },
];

function StatusDot({ online, loading = false }: { online: boolean; loading?: boolean }) {
  return (
    <span className={`h-2.5 w-2.5 rounded-full ${
      loading ? "animate-pulse bg-state-atencion"
      : online ? "bg-tv-accent"
      : "bg-state-critica"
    }`} />
  );
}

export function LoginScreen() {
  const router = useRouter();
  const hydrate = useAppStore((state) => state.hydrate);
  const token = useAppStore((state) => state.token);
  const isHydrated = useAppStore((state) => state.isHydrated);
  const selectedRole = useAppStore((state) => state.selectedRole);
  const setSelectedRole = useAppStore((state) => state.setSelectedRole);
  const setSession = useAppStore((state) => state.setSession);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => { hydrate(); }, [hydrate]);
  useEffect(() => {
    if (isHydrated && token) router.replace("/dashboard");
  }, [isHydrated, token, router]);

  const health = useQuery({
    queryKey: ["health"],
    queryFn: api.health,
    retry: 1,
    refetchInterval: 30_000,
  });

  const activeRole = useMemo(
    () => roles.find((r) => r.value === selectedRole) ?? roles[2],
    [selectedRole],
  );

  const loginMutation = useMutation({
    mutationFn: api.login,
    onSuccess: (data) => {
      const realRole = data.user.role ?? selectedRole;
      setSelectedRole(realRole);
      setSession(data.token.access_token, data.user);
      setRedirecting(true);
      router.push("/dashboard");
    },
  });

  const backendOnline = health.isSuccess && health.data.status === "ok";
  const isLoading = loginMutation.isPending || redirecting;

  function submitLogin() {
    if (!username.trim() || password.length < 3 || isLoading) return;
    loginMutation.mutate({ username: username.trim(), password });
  }

  if (redirecting) {
    return (
      <main className="grid min-h-screen place-items-center bg-tv-bg px-6 font-body text-white">
        <section className="text-center">
          <div className="t4m-logo mx-auto grid h-20 w-20 place-items-center rounded-[22px] font-heading font-extrabold text-white shadow-brand">
            <Milk className="h-9 w-9" strokeWidth={2.4} />
          </div>
          <div className="mx-auto mt-8 flex h-14 w-14 items-center justify-center rounded-full bg-tv-accent/20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-tv-accent border-t-transparent" />
          </div>
          <h1 className="mt-6 font-heading text-3xl font-bold">Bienvenido/a, {username}</h1>
          <p className="mt-2 text-sm text-tv-dim">
            Abriendo panel de {activeRole.label.toLowerCase()}…
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-hidden font-body">
      <div className="grid min-h-screen w-full grid-cols-1 lg:grid-cols-[58fr_42fr]">

        {/* ── Left panel — Visual brand showcase ────────────────────────── */}
        <section className="relative hidden flex-col justify-between bg-gradient-to-br from-[#1f5a35] via-[#2f6f45] to-[#12351f] p-10 lg:flex lg:p-12">
          {/* Decorative elements */}
          <div className="absolute inset-0 overflow-hidden opacity-10">
            <div className="absolute left-10 top-20 text-9xl font-bold text-white/30">»</div>
            <div className="absolute bottom-32 right-20 text-8xl font-bold text-white/20">»</div>
            <div className="absolute left-1/3 top-1/2 text-7xl font-bold text-white/15">»</div>
          </div>

          {/* Content */}
          <div className="relative z-10">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-[#4ee787] to-[#2f6f45] font-heading text-3xl font-bold text-white shadow-lg">
                T
              </div>
              <div>
                <div className="font-heading text-2xl font-bold text-white">Tools4 Milk</div>
                <div className="text-sm font-semibold text-white/70">Centro de control ganadero</div>
              </div>
            </div>
          </div>

          {/* Main content */}
          <div className="relative z-10 space-y-6">
            <div>
              <div className="text-xs font-extrabold uppercase tracking-widest text-white/60">
                Sistema de gestión
              </div>
              <h1 className="mt-4 max-w-md font-heading text-5xl font-bold leading-tight text-white">
                Gestión integral de explotación lechera
              </h1>
            </div>
            <p className="max-w-md text-white/80">
              Producción, sanidad, alimentación y operaciones — coordinadas en una sola plataforma para tu granja.
            </p>
          </div>

          {/* Footer */}
          <div className="relative z-10 border-t border-white/20 pt-6">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-semibold text-white/70">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#6ee787]"></span>
                Plataforma operativa
              </span>
              <span className="text-xs font-semibold text-white/50">TFM · 2026</span>
            </div>
          </div>
        </section>

        {/* ── Right panel — Login form ────────────────────────────────── */}
        <section className="flex flex-col items-center justify-center bg-[#eef4ef] px-6 py-12 sm:px-8 lg:bg-[#eef4ef]">
          <div className="w-full max-w-md">
            {/* Mobile logo — visible only on small screens */}
            <div className="mb-8 flex lg:hidden flex-col items-center">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-[#4ee787] to-[#2f6f45] font-heading text-2xl font-bold text-white shadow-lg">
                T
              </div>
              <h1 className="mt-3 font-heading text-2xl font-bold text-[#1f5a35]">Tools4 Milk</h1>
            </div>

            {/* Form title */}
            <h2 className="mb-8 font-heading text-3xl font-bold text-[#1f5a35]">
              Iniciar sesión
            </h2>

            {/* Login form */}
            <form
              className="space-y-4"
              onSubmit={(e) => { e.preventDefault(); submitLogin(); }}
            >
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#2f6f45]">
                  Usuario
                </label>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="nombre.apellido"
                  autoComplete="username"
                  className="w-full rounded-2xl border-2 border-[#d0e8d8] bg-white px-5 py-3 text-sm font-semibold text-[#1f5a35] outline-none transition placeholder:text-[#9db5a6] focus:border-[#4ee787] focus:ring-4 focus:ring-[#4ee787]/20"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wide text-[#2f6f45]">
                    Contraseña
                  </label>
                  <a href="#" className="text-xs font-semibold text-[#2f6f45] hover:underline">
                    ¿Olvidaste tu contraseña?
                  </a>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Contraseña"
                  autoComplete="current-password"
                  className="w-full rounded-2xl border-2 border-[#d0e8d8] bg-white px-5 py-3 text-sm font-semibold text-[#1f5a35] outline-none transition placeholder:text-[#9db5a6] focus:border-[#4ee787] focus:ring-4 focus:ring-[#4ee787]/20"
                />
              </div>

              {loginMutation.isError && (
                <div className="rounded-2xl border-2 border-[#ef4444] bg-[#fee2e2] px-4 py-3 text-sm font-semibold text-[#991b1b]">
                  {loginMutation.error.message}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || !username.trim() || password.length < 3}
                className="mt-6 w-full rounded-2xl bg-gradient-to-br from-[#2f6f45] to-[#1f5a35] px-6 py-4 font-heading text-lg font-bold text-white shadow-lg transition hover:from-[#1f5a35] hover:to-[#12351f] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Autenticando…
                  </span>
                ) : (
                  "Entrar"
                )}
              </button>
            </form>

            {/* Demo access */}
            <div className="mt-8 rounded-2xl border-2 border-[#d0e8d8] bg-white p-5">
              <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-[#2f6f45]">
                Accesos de prueba
              </h3>
              <p className="mb-4 text-xs text-[#7a9b8a]">
                Selecciona un usuario para rellenar automáticamente.
              </p>
              <div className="space-y-2">
                {demoUsers.slice(1, 4).map((demo) => (
                  <button
                    key={demo.username}
                    type="button"
                    onClick={() => {
                      setUsername(demo.username);
                      setPassword(demo.password);
                      setSelectedRole(demo.role);
                    }}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition hover:bg-[#f0f8f4]"
                  >
                    <span className="font-mono text-sm font-semibold text-[#1f5a35]">{demo.username}</span>
                    <span className="text-xs text-[#7a9b8a]">{demo.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Backend status — small indicator */}
            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-[#7a9b8a]">
              <StatusDot online={backendOnline} loading={health.isLoading} />
              {health.isLoading ? "Verificando conexión…"
                : backendOnline ? "Sistema conectado"
                : "Sistema desconectado"}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
