/**
 * Cross-module permission model (Batch 2).
 * Backend ACL/RLS/RPC remains authoritative — this types the client policy layer.
 */

export const MODULE_IDS = ["compliance", "admin-hr", "personal", "dispatch"] as const;
export type ModuleId = (typeof MODULE_IDS)[number];

/** Least-privilege capabilities inside a module (never grant by nav alone). */
export const PRIVILEGES = ["drug", "rate", "finance"] as const;
export type Privilege = (typeof PRIVILEGES)[number];

export type ComplianceRole = "admin" | "standard";
export type AdminHrRole = "admin" | "standard";
export type PersonalRole = "owner";
export type DispatchRole = "admin" | "dispatcher";

export type ModuleSeat =
  | { module: "compliance"; role: ComplianceRole; active: boolean }
  | { module: "admin-hr"; role: AdminHrRole; active: boolean }
  | { module: "personal"; role: PersonalRole; active: boolean }
  | { module: "dispatch"; role: DispatchRole; active: boolean };

export type AuthProject = "driver" | "admin-lovable" | "personal";

export type ModuleGrants = {
  compliance: ComplianceRole | null;
  "admin-hr": AdminHrRole | null;
  personal: PersonalRole | null;
  dispatch: DispatchRole | null;
};

export type ResolvedAccess = {
  grants: ModuleGrants;
  /** Capabilities derived from seats (drug/rate/finance). */
  privileges: Privilege[];
  /** True when the only active company module seat is Dispatch. */
  dispatchOnly: boolean;
  /** Modules the switcher may show (Personal is privacy-gated separately). */
  selectableModules: ModuleId[];
  homePath: string;
};

export const EMPTY_GRANTS: ModuleGrants = {
  compliance: null,
  "admin-hr": null,
  personal: null,
  dispatch: null,
};

export const MODULE_PATH_PREFIX: Record<ModuleId, string> = {
  compliance: "/",
  "admin-hr": "/admin",
  personal: "/personal",
  dispatch: "/dispatch",
};

export const MODULE_LABEL: Record<ModuleId, string> = {
  compliance: "Driver Compliance",
  "admin-hr": "Admin & Attendance",
  personal: "HR Personal",
  dispatch: "Dispatch",
};
