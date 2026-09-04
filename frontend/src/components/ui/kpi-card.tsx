import type { LucideIcon } from "lucide-react";

type KpiTone = "default" | "critical" | "warning" | "success" | "info" | "muted";

const toneStyles: Record<KpiTone, { value: string; icon: string; border: string }> = {
  default: { value: "text-app-text", icon: "text-brand", border: "border-app-border" },
  critical: { value: "text-state-critica", icon: "text-state-critica", border: "border-state-critica/20" },
  warning: { value: "text-state-atencion", icon: "text-state-atencion", border: "border-state-atencion/20" },
  success: { value: "text-state-ok", icon: "text-state-ok", border: "border-state-ok/20" },
  info: { value: "text-state-info", icon: "text-state-info", border: "border-state-info/20" },
  muted: { value: "text-app-dim", icon: "text-app-dim", border: "border-app-border" },
};

type KpiCardProps = {
  label: string;
  value: number | string;
  sublabel?: string;
  tone?: KpiTone;
  Icon?: LucideIcon;
  href?: string;
};

export function KpiCard({ label, value, sublabel, tone = "default", Icon }: KpiCardProps) {
  const styles = toneStyles[tone];
  return (
    <div className={`rounded-[14px] border bg-white p-5 shadow-card ${styles.border}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-app-dim">{label}</p>
        {Icon && <Icon className={`h-4 w-4 shrink-0 ${styles.icon}`} strokeWidth={2} />}
      </div>
      <p className={`mt-3 font-heading text-4xl font-bold leading-none ${styles.value}`}>
        {value}
      </p>
      {sublabel && (
        <p className="mt-1.5 text-xs font-semibold text-app-dim">{sublabel}</p>
      )}
    </div>
  );
}
