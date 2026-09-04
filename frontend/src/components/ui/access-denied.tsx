import { ShieldX } from "lucide-react";
import Link from "next/link";
import type { Capability } from "@/lib/role-capabilities";

type AccessDeniedProps = {
  role?: string | null;
  requiredCapability?: Capability;
  title?: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
};

/**
 * AccessDenied — shown when a user lacks the required capability for a page.
 * Visual-only restriction; does not replace server-side auth.
 */
export function AccessDenied({
  role,
  requiredCapability,
  title = "Acceso restringido",
  description = "Tu rol actual no tiene acceso a esta sección.",
  backHref = "/dashboard",
  backLabel = "Volver al dashboard",
}: AccessDeniedProps) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-state-atencion/10">
        <ShieldX className="h-10 w-10 text-state-atencion" strokeWidth={1.5} />
      </div>

      <div className="max-w-sm">
        <h2 className="font-heading text-xl font-bold text-app-text">{title}</h2>
        <p className="mt-2 text-sm text-app-dim">{description}</p>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-app-dim">
          {role && (
            <span className="rounded-full border border-app-border bg-app-bg px-3 py-1 font-semibold capitalize">
              Rol: {role}
            </span>
          )}
          {requiredCapability && (
            <span className="rounded-full border border-state-atencion/30 bg-state-atencion/8 px-3 py-1 font-mono text-state-atencion">
              Requiere: {requiredCapability}
            </span>
          )}
        </div>
      </div>

      <Link
        href={backHref}
        className="mt-2 rounded-[10px] bg-brand px-5 py-2.5 text-sm font-bold text-white shadow-brand transition hover:bg-[#135532]"
      >
        {backLabel}
      </Link>
    </div>
  );
}
