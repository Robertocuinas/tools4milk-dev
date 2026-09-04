"use client";

import { Milk } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { TvClock, TvDate } from "@/components/tv/TvClock";
import { TvRefreshStatus, type QueryStatusInfo } from "@/components/tv/TvRefreshStatus";
import { useAppStore } from "@/store/app-store";

type TvShellProps = {
  title: string;
  subtitle?: string;
  /** Pass query results for the refresh-status indicator in the header */
  queryStatuses?: QueryStatusInfo[];
  backHref?: string;
  backLabel?: string;
  children: React.ReactNode;
};

export function TvShell({
  title,
  subtitle,
  queryStatuses,
  backHref,
  backLabel = "Gestión",
  children,
}: TvShellProps) {
  const router = useRouter();
  const hydrate = useAppStore((s) => s.hydrate);
  const isHydrated = useAppStore((s) => s.isHydrated);
  const token = useAppStore((s) => s.token);

  useEffect(() => { hydrate(); }, [hydrate]);

  useEffect(() => {
    if (isHydrated && !token) router.replace("/");
  }, [isHydrated, token, router]);

  if (!isHydrated || !token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-tv-bg">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-tv-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-tv-bg font-body text-tv-text">
      {/* ── TV Header ── */}
      <header className="flex shrink-0 items-center justify-between border-b border-tv-border bg-tv-surface px-8 py-4">
        <div className="flex items-center gap-4">
          <div className="t4m-logo grid h-9 w-9 shrink-0 place-items-center rounded-[10px]">
            <Milk className="h-4.5 w-4.5 text-tv-text" strokeWidth={2.4} />
          </div>
          <div>
            <div className="font-heading text-lg font-bold leading-tight text-tv-text">{title}</div>
            {subtitle && <div className="text-xs text-tv-dim">{subtitle}</div>}
          </div>
        </div>

        <div className="flex items-center gap-5">
          {queryStatuses && queryStatuses.length > 0 && (
            <TvRefreshStatus queries={queryStatuses} />
          )}
          <div className="hidden text-right lg:block">
            <TvClock />
            <div className="mt-0.5">
              <TvDate />
            </div>
          </div>
          {backHref && (
            <Link
              href={backHref}
              className="rounded-[10px] border border-tv-border bg-tv-surface2 px-3 py-2 text-xs font-semibold text-tv-text transition hover:bg-tv-border"
            >
              ← {backLabel}
            </Link>
          )}
        </div>
      </header>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  );
}
