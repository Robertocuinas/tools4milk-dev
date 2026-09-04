import type { LucideIcon } from "lucide-react";

type EmptyStateProps = {
  Icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
};

export function EmptyState({ Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[14px] border border-app-border bg-white px-6 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-app-bg">
        <Icon className="h-8 w-8 text-app-dim" strokeWidth={1.5} />
      </div>
      <p className="mt-4 font-heading text-lg font-bold text-app-text">{title}</p>
      {description && (
        <p className="mt-1.5 max-w-xs text-sm text-app-dim">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
