"use client";

import { useAppStore } from "@/store/app-store";
import { can, canAny, canAll, type Capability, type SystemRole } from "@/lib/role-capabilities";

/**
 * usePermissions — hook to check capabilities for the current authenticated user.
 *
 * Usage:
 *   const { can, isAdmin, role } = usePermissions();
 *   if (!can("view_audit_log")) return <AccessDenied />;
 */
export function usePermissions() {
  const role = useAppStore((s) => s.user?.role) as SystemRole | undefined;
  const user = useAppStore((s) => s.user);

  return {
    role,
    user,
    isAdmin: role === "admin",
    /** Check if user has a single capability */
    can: (capability: Capability) => can(role, capability),
    /** Check if user has any of the given capabilities */
    canAny: (...caps: Capability[]) => canAny(role, ...caps),
    /** Check if user has all of the given capabilities */
    canAll: (...caps: Capability[]) => canAll(role, ...caps),
  };
}
