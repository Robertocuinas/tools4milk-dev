import type { LucideIcon } from "lucide-react";

type TvTone = "critical" | "warning" | "ok" | "info" | "accent" | "neutral";

const toneMap: Record<TvTone, { value: string; icon: string; bg: string; border: string }> = {
  critical: { value: "text-state-critica", icon: "text-state-critica", bg: "bg-state-critica/10", border: "border-state-critica/30" },
  warning:  { value: "text-state-atencion", icon: "text-state-atencion", bg: "bg-state-atencion/10", border: "border-state-atencion/30" },
  ok:       { value: "text-state-ok",  icon: "text-state-ok",  bg: "bg-state-ok/10",  border: "border-state-ok/30" },
  info:     { value: "text-state-info", icon: "text-state-info", bg: "bg-state-info/10", border: "border-state-info/30" },
  accent:   { value: "text-tv-accent", icon: "text-tv-accent", bg: "bg-tv-accent/10", border: "border-tv-accent/20" },
  neutral:  { value: "text-tv-text",    icon: "text-tv-dim",   bg: "bg-tv-surface",    border: "border-tv-border" },
};

type TvKpiCardProps = {
  label: string;
  value: number | string;
  sublabel?: string;
  tone?: TvTone;
  Icon?: LucideIcon;
};

export function TvKpiCard({ label, value, sublabel, tone = "neutral", Icon }: TvKpiCardProps) {
  const t = toneMap[tone];
  return (
    <div className={`rounded-2xl border ${t.border} ${t.bg} px-6 py-5`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-tv-dim">{label}</p>
        {Icon && <Icon className={`h-5 w-5 ${t.icon}`} strokeWidth={2} />}
      </div>
      <p className={`mt-3 font-heading text-5xl font-bold leading-none ${t.value}`}>
        {value}
      </p>
      {sublabel && (
        <p className="mt-2 text-sm font-semibold text-tv-dim">{sublabel}</p>
      )}
    </div>
  );
}
