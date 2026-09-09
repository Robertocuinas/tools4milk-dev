import type { ReactNode } from "react";

export type BadgeTone = "neutral" | "info" | "success" | "warning" | "critical";

type BadgeProps = {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
};

const tones: Record<BadgeTone, string> = {
  neutral: "border-app-border bg-app-bg text-app-dim",
  info: "border-state-info/30 bg-state-info/10 text-state-info",
  success: "border-state-ok/30 bg-state-ok/10 text-state-ok",
  warning: "border-state-atencion/30 bg-state-atencion/10 text-state-atencion",
  critical: "border-state-critica/30 bg-state-critica/10 text-state-critica",
};

export function Badge({ children, tone = "neutral", className = "" }: BadgeProps) {
  return (
    <span className={`inline-flex min-h-7 items-center rounded-full border px-2.5 py-1 text-[11px] font-bold leading-none ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}
