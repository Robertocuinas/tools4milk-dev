"use client";

import {
  Activity,
  AlertOctagon,
  ArrowLeftRight,
  BarChart3,
  Beef,
  Bell,
  BrainCircuit,
  CalendarClock,
  Droplets,
  LayoutDashboard,
  ListTodo,
  LogOut,
  MapPin,
  Milk,
  Package,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { Capability } from "@/lib/role-capabilities";
import { roleDisplayName } from "@/lib/role-capabilities";
import { useActiveWorkerStore } from "@/lib/active-worker-store";
import { usePermissions } from "@/lib/use-permissions";
import { SessionKeeper } from "@/components/providers/session-keeper";
import { useAppStore } from "@/store/app-store";
import { api } from "@/lib/api";

type NavItem = {
  href: string;
  label: string;
  Icon: typeof LayoutDashboard;
  /** If set, item is only shown when the user has this capability */
  capability?: Capability;
};

function subscribeToConnectivity(callback: () => void): () => void {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getOnlineSnapshot(): boolean {
  return window.navigator.onLine;
}

function getServerOnlineSnapshot(): boolean {
  return true;
}

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "",
    items: [
      { href: "/dashboard", label: "Control de explotación", Icon: LayoutDashboard },
      { href: "/report", label: "Informe", Icon: BarChart3 },
    ],
  },
  {
    label: "Operativa",
    items: [
      { href: "/leanfarming", label: "LeanFarming", Icon: ListTodo },
      { href: "/alerts", label: "Alertas", Icon: Bell, capability: "view_alerts" },
      { href: "/incidents", label: "Incidencias", Icon: AlertOctagon },
      { href: "/shifts", label: "Turnos", Icon: CalendarClock },
      { href: "/quality", label: "Calidad", Icon: Droplets },
      { href: "/predictions", label: "Predicciones", Icon: BrainCircuit },
    ],
  },
  {
    label: "Explotación",
    items: [
      { href: "/zones", label: "Zonas", Icon: MapPin },
      { href: "/handover", label: "Relevos", Icon: ArrowLeftRight },
      { href: "/orders", label: "Pedidos", Icon: Package },
      { href: "/animals", label: "Animales", Icon: Beef },
    ],
  },
  {
    label: "Sistema",
    items: [
      { href: "/profile", label: "Perfil", Icon: UserRound },
      // Items below require specific capabilities — hidden for non-admin roles
      { href: "/management", label: "Gestión", Icon: Settings2, capability: "view_management" },
      { href: "/settings", label: "Configuración", Icon: SlidersHorizontal, capability: "manage_settings" },
      { href: "/integration", label: "Integración", Icon: Activity, capability: "view_integration" },
      { href: "/audit-log", label: "Audit Log", Icon: ShieldCheck, capability: "view_audit_log" },
    ],
  },
];

function LogoMark() {
  return (
    <div className="t4m-logo grid h-9 w-9 shrink-0 place-items-center rounded-[10px] text-white shadow-brand">
      <Milk className="h-4.5 w-4.5" strokeWidth={2.4} />
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const hydrate = useAppStore((state) => state.hydrate);
  const isHydrated = useAppStore((state) => state.isHydrated);
  const user = useAppStore((state) => state.user);
  const setSession = useAppStore((state) => state.setSession);
  const logout = useAppStore((state) => state.logout);
  const { can, role } = usePermissions();
  const workerHydrate = useActiveWorkerStore((s) => s.hydrate);
  const activeWorker = useActiveWorkerStore((s) => s.worker);
  const online = useSyncExternalStore(
    subscribeToConnectivity,
    getOnlineSnapshot,
    getServerOnlineSnapshot,
  );
  const offline = !online;
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    hydrate();
    workerHydrate();
  }, [hydrate, workerHydrate]);

  useEffect(() => {
    if (!isHydrated || user || offline) return;
    let mounted = true;
    api.me()
      .then(setSession)
      .catch(() => router.replace("/"))
      .finally(() => {
        if (mounted) setSessionChecked(true);
      });
    return () => {
      mounted = false;
    };
  }, [isHydrated, user, offline, router, setSession]);

  useEffect(() => {
    // El JWT vive en una cookie HttpOnly; el ``proxy.ts`` ya redirige si
    // la cookie no está presente. Aquí solo necesitamos ``user`` para
    // renderizar la sidebar. Si la cookie está caducada, la primera
    // llamada a la API (en una página hija) recibirá 401 y se manejará
    // allí; en este layout basta con no redirigir dos veces.
    if (isHydrated && !user && !offline && sessionChecked) router.replace("/");
  }, [isHydrated, user, offline, sessionChecked, router]);

  // Tras una recarga offline la identidad en memoria se pierde, pero la
  // cookie HttpOnly sigue siendo válida y la shell debe poder mostrar la
  // página cacheada/degradada para que la outbox siga siendo utilizable.
  // En online mantenemos el gate estricto y redirigimos si no hay sesión.
  if (!isHydrated || (!user && !offline && !sessionChecked)) {
    return (
      <div className="grid min-h-screen place-items-center bg-app-bg">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    );
  }

  function handleLogout() {
    // Llamamos al backend para borrar la cookie HttpOnly antes de limpiar
    // el estado local. Si la llamada falla igualmente limpiamos local
    // y redirigimos — el objetivo UX es sacar al usuario.
    fetch("/api/v1/auth/logout", {
      method: "POST",
      credentials: "include",
    }).catch(() => undefined).finally(() => {
      logout();
      router.replace("/");
    });
  }

  return (
    <div className="flex min-h-screen bg-app-bg font-body text-app-text">
      {/* Mantiene la sesión viva: rota el access cada 50 min y maneja
          la expiración (refreshSession fallido → store limpio + redirect). */}
      <SessionKeeper />
      {/* ── Sidebar ── */}
      <aside className="flex w-16 shrink-0 flex-col overflow-hidden border-r border-[#1e3a26] bg-[#0d1a10] md:w-56">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 border-b border-[#1e3a26] px-2 py-4 md:justify-start md:px-4">
          <LogoMark />
          <div className="min-w-0 md:block hidden">
            <div className="font-heading text-[15px] font-bold leading-none text-white">
              Tools4 Milk
            </div>
            <div className="mt-0.5 text-[11px] font-semibold text-[#7fa18d]">
              Centro de control
            </div>
          </div>
        </div>

        {/* Navigation — items filtered by capability */}
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {navGroups.map((group) => {
            // Filter items: show if no capability required, or user has the capability
            const visibleItems = group.items.filter(
              (item) => !item.capability || can(item.capability),
            );
            if (visibleItems.length === 0) return null;
            return (
              <div key={group.label} className="mb-4">
                {group.label && (
                  <p className="mb-1 hidden px-3 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#79a88b] md:block">
                    {group.label}
                  </p>
                )}
                {visibleItems.map(({ href, label, Icon }) => {
                  const active = pathname === href || pathname.startsWith(`${href}/`);
                  return (
                    <Link
                      key={href}
                      href={href}
                      aria-label={label}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center justify-center gap-2.5 rounded-[10px] px-3 py-3 text-sm font-semibold transition-colors md:justify-start md:py-2.5 ${
                        active
                          ? "bg-[#1e3a26] text-[#35e479]"
                          : "text-[#7fa18d] hover:bg-[#1a2e1f] hover:text-white"
                      }`}
                    >
                      <Icon
                        className={`h-4 w-4 shrink-0 ${active ? "text-[#35e479]" : "text-[#79a88b]"}`}
                        strokeWidth={2}
                      />
                      <span className="hidden md:inline">{label}</span>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="space-y-1.5 border-t border-[#1e3a26] px-2 py-3">
          <Link href="/profile" aria-label="Abrir perfil" className="block rounded-[10px] bg-[#132219] px-3 py-2.5 text-center transition hover:bg-[#1a2e1f] md:text-left">
            <div className="hidden truncate text-xs font-bold text-white md:block">
              {user?.username ?? "Usuario"}
            </div>
            <div className="mt-0.5 hidden text-[11px] capitalize text-[#7fa18d] md:block">
              {roleDisplayName(role)}
            </div>
            {activeWorker && (
              <div className="mt-1 hidden items-center gap-1 md:flex">
                <span className="text-[9px] text-[#79a88b]">▸</span>
                <span className="truncate text-[10px] font-semibold text-[#7fa18d]">
                  {activeWorker.name}
                </span>
                <span className="shrink-0 rounded bg-[#1e3a26] px-1 text-[9px] text-[#79a88b]">local</span>
              </div>
            )}
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Cerrar sesión"
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-[10px] px-3 py-2 text-sm font-semibold text-[#7fa18d] transition hover:bg-[#3d1010]/40 hover:text-state-critica md:justify-start"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden md:inline">Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="min-w-0 flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
