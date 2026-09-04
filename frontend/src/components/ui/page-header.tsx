import type { LucideIcon } from "lucide-react";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  EyebrowIcon?: LucideIcon;
  children?: React.ReactNode;
};

export function PageHeader({ eyebrow, title, EyebrowIcon, children }: PageHeaderProps) {
  return (
    <div className="border-b border-app-border bg-white px-6 py-5 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          {eyebrow && (
            <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-[0.18em] text-app-dim">
              {EyebrowIcon && <EyebrowIcon className="h-3.5 w-3.5" />}
              {eyebrow}
            </div>
          )}
          <h1 className="mt-0.5 font-heading text-2xl font-bold text-app-text">{title}</h1>
        </div>
        {children && (
          <div className="flex flex-wrap items-center gap-3">{children}</div>
        )}
      </div>
    </div>
  );
}
