/**
 * Role capabilities declaration for Tools4Milk frontend.
 *
 * System roles from backend auth (Usuario.role):
 *   admin | veterinario | operario | alimentacion
 *
 * Employee operational roles (Empleado.rol — NOT tied to auth login yet):
 *   encargado | auxiliar | veterinario | mecanico
 *
 * Mapping strategy:
 *   - Auth role is the authoritative source (comes from JWT / /auth/me)
 *   - Employee role is informational for display only (for now)
 *   - Unrecognized roles fall back to minimal read-only access via `normalizeRole`
 *
 * Usage:
 *   import { can, normalizeRole } from "@/lib/role-capabilities";
 *   import { usePermissions } from "@/lib/use-permissions";
 *
 * TODO (Phase 12): When employee selection on login is implemented, map
 *   employee operational roles to expanded capability sets here.
 */

export type SystemRole = "admin" | "veterinario" | "operario" | "alimentacion";

export type Capability =
  // Dashboard & global
  | "view_dashboard"
  | "view_report"
  | "view_tv_global"
  // Operational
  | "manage_tasks"
  | "create_task"
  | "complete_task"
  | "manage_incidents"
  | "create_incident"
  | "manage_orders"
  | "create_order"
  | "manage_shifts"
  | "create_shift"
  | "view_handover"
  | "create_handover"
  // Animals & health
  | "view_animals"
  | "manage_animals"
  | "view_quality"
  | "view_predictions"
  | "manage_treatments"
  | "manage_lactations"
  // Zone management
  | "view_zones"
  | "manage_zones"
  | "use_tablet_zone"
  // Admin
  | "manage_users"
  | "manage_employees"
  | "view_audit_log"
  | "view_integration"
  | "manage_settings"
  | "view_settings"
  // Management page access
  | "view_management"
  // Alerts
  | "view_alerts"
  | "resolve_alert"
  // Employees & machinery
  | "manage_machinery";

const ALL_CAPABILITIES: Capability[] = [
  "view_dashboard", "view_report", "view_tv_global",
  "manage_tasks", "create_task", "complete_task",
  "manage_incidents", "create_incident",
  "manage_orders", "create_order",
  "manage_shifts", "create_shift",
  "view_handover", "create_handover",
  "view_animals", "manage_animals",
  "view_quality", "view_predictions",
  "manage_treatments", "manage_lactations",
  "view_zones", "manage_zones", "use_tablet_zone",
  "manage_users", "manage_employees",
  "view_audit_log", "view_integration", "manage_settings", "view_settings",
  "view_management",
  "view_alerts", "resolve_alert",
  "manage_machinery",
];

/**
 * Capabilities per system role.
 * Admin has all. Others have role-specific subsets.
 */
export const ROLE_CAPABILITIES: Record<SystemRole, Set<Capability>> = {
  admin: new Set(ALL_CAPABILITIES),

  veterinario: new Set<Capability>([
    "view_dashboard", "view_report", "view_tv_global",
    "view_animals", "manage_animals",
    "manage_treatments", "manage_lactations",
    "view_quality", "view_predictions",
    "view_alerts", "resolve_alert",
    "manage_incidents", "create_incident",
    "complete_task",
    "view_zones", "use_tablet_zone",
    "view_handover",
    "view_management",
  ]),

  operario: new Set<Capability>([
    "view_dashboard", "view_tv_global",
    "view_animals",
    "manage_tasks", "create_task", "complete_task",
    "manage_incidents", "create_incident",
    "view_alerts",
    "view_zones", "use_tablet_zone",
    "view_handover", "create_handover",
    "manage_machinery",
    "view_management",
  ]),

  alimentacion: new Set<Capability>([
    "view_dashboard", "view_report", "view_tv_global",
    "view_animals", "manage_animals",
    "manage_lactations", "view_quality",
    "manage_tasks", "create_task", "complete_task",
    "manage_incidents", "create_incident",
    "manage_orders", "create_order",
    "view_alerts",
    "view_zones", "use_tablet_zone",
    "view_handover",
    "manage_machinery",
    "view_management",
  ]),
};

/**
 * Normalize a raw role string to a known SystemRole.
 * Unknown roles map to "operario" (minimal read capabilities) rather than throwing.
 * This ensures the app doesn't break with unexpected role values from the backend.
 */
export function normalizeRole(role: string | undefined | null): SystemRole {
  if (!role) return "operario";
  if ((role as SystemRole) in ROLE_CAPABILITIES) return role as SystemRole;
  // Fallback: unknown roles get minimal access (equivalent to operario)
  return "operario";
}

/**
 * Check if a given role has a specific capability.
 * Safely handles undefined/unknown roles (returns false for unknown).
 */
export function can(role: string | undefined | null, capability: Capability): boolean {
  if (!role) return false;
  const normalized = normalizeRole(role);
  return ROLE_CAPABILITIES[normalized].has(capability);
}

/**
 * Check if a role has ANY of the given capabilities.
 */
export function canAny(role: string | undefined | null, ...capabilities: Capability[]): boolean {
  return capabilities.some((cap) => can(role, cap));
}

/**
 * Check if a role has ALL of the given capabilities.
 */
export function canAll(role: string | undefined | null, ...capabilities: Capability[]): boolean {
  return capabilities.every((cap) => can(role, cap));
}

/**
 * Human-readable label for a system role.
 */
export function roleDisplayName(role: string | undefined | null): string {
  const labels: Record<SystemRole, string> = {
    admin: "Administrador",
    veterinario: "Veterinario",
    operario: "Operario",
    alimentacion: "Responsable nutrición",
  };
  if (!role) return "Sin rol";
  return labels[normalizeRole(role)] ?? role;
}
