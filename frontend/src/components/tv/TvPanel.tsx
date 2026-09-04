import type { LucideIcon } from "lucide-react";

type TvPanelProps = {
  title: string;
  count?: number;
  Icon?: LucideIcon;
  iconTone?: string;
  children: React.ReactNode;
  className?: string;
};

export function TvPanel({ title, count, Icon, iconTone = "text-tv-dim", children, className = "" }: TvPanelProps) {
  return (
    <section className={`flex flex-col rounded-2xl border border-tv-border bg-tv-surface overflow-hidden ${className}`}>
      <div className="flex items-center justify-between gap-3 border-b border-tv-border px-5 py-3">
        <div className="flex items-center gap-2">
          {Icon && <Icon className={`h-4 w-4 ${iconTone}`} strokeWidth={2} />}
          <h2 className="text-xs font-extrabold uppercase tracking-[0.18em] text-tv-dim">{title}</h2>
        </div>
        {count !== undefined && (
          <span className="rounded-full bg-tv-surface2 px-2.5 py-0.5 text-sm font-bold text-tv-text">
            {count}
          </span>
        )}
      </div>
      <div className="flex-1 overflow-hidden p-4">{children}</div>
    </section>
  );
}

export function TvEmptyRow({ text }: { text: string }) {
  return (
    <div className="flex h-full items-center justify-center text-sm font-semibold text-tv-dim">
      {text}
    </div>
  );
}
