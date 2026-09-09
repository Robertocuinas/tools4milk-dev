import { AlertCircle, CheckCircle2, Inbox, LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";

export type StatusStateKind = "loading" | "empty" | "error" | "success";

type StatusStateProps = {
  kind: StatusStateKind;
  title: string;
  description?: string;
  action?: ReactNode;
};

const icons = { loading: LoaderCircle, empty: Inbox, error: AlertCircle, success: CheckCircle2 };
const tones = { loading: "text-state-info", empty: "text-app-dim", error: "text-state-critica", success: "text-state-ok" };

export function StatusState({ kind, title, description, action }: StatusStateProps) {
  const Icon = icons[kind];
  return (
    <div role={kind === "error" ? "alert" : undefined} aria-live={kind === "loading" ? "polite" : undefined} className="flex flex-col items-center justify-center rounded-[14px] border border-app-border bg-white px-6 py-12 text-center">
      <Icon className={`h-8 w-8 ${tones[kind]} ${kind === "loading" ? "animate-spin" : ""}`} aria-hidden="true" />
      <p className="mt-3 font-heading text-base font-bold text-app-text">{title}</p>
      {description && <p className="mt-1.5 max-w-md text-sm text-app-dim">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
