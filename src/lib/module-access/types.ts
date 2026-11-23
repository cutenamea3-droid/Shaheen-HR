/**
 * Cross-module permission model (Compliance + Admin only).
 * Backend ACL/RLS/RPC remains authoritative — this types the client policy layer.
 */

export const MODULE_IDS = ["compliance", "admin-hr"] as const;
export type ModuleId = (typeof MODULE_IDS)[number];

/** Least-privilege capabilities inside a module (never grant by nav alone). */
export const PRIVILEGES = ["drug", "rate", "finance"] as const;
export type Privilege = (typeof PRIVILEGES)[number];

export type ComplianceRole = "admin" | "standard";
export type AdminHrRole = "admin" | "standard";

export type ModuleSeat =
  | { module: "compliance"; role: ComplianceRole; active: boolean }
  | { module: "admin-hr"; role: AdminHrRole; active: boolean };

/** Auth projects used by this deployable app. */
export type AuthProject = "driver" | "admin-lovable";

export type ModuleGrants = {
  compliance: ComplianceRole | null;
  "admin-hr": AdminHrRole | null;
};

export type ResolvedAccess = {
  grants: ModuleGrants;
  /** Capabilities derived from seats (drug/rate/finance). */
  privileges: Privilege[];
  /** Modules the switcher may show. */
  selectableModules: ModuleId[];
  homePath: string;
};

export const EMPTY_GRANTS: ModuleGrants = {
  compliance: null,
  "admin-hr": null,
};

export const MODULE_PATH_PREFIX: Record<ModuleId, string> = {
  compliance: "/",
  "admin-hr": "/admin",
};

export const MODULE_LABEL: Record<ModuleId, string> = {
  compliance: "Driver Compliance",
  "admin-hr": "Admin & Attendance",
};
