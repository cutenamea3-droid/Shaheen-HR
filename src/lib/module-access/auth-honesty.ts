/**
 * Cross-project auth honesty (Compliance + Attendance app).
 *
 * Auth backends in this deployable:
 * - Driver Supabase (`VITE_SUPABASE_*`) — Compliance ACL
 * - Admin Lovable Cloud — separate hardcoded client in `src/admin/integrations/supabase/client.ts`
 *
 * Forbidden:
 * - Copying JWT / session storage keys across projects
 * - Using Driver session to call Admin APIs (or vice versa)
 * - Treating localStorage roles / AppSwitcher visibility as source of truth
 */

import type { AuthProject } from "./types";

export const AUTH_STORAGE_KEYS = {
  driver: "sb-", // supabase-js default prefix; Driver client may use preview broker
  adminSession: "shaheen-hr-account-session-v1",
  adminSecrets: "shaheen-hr-account-secrets-v1",
} as const;

export type AuthBoundaryViolation =
  | "bridge_driver_jwt_to_admin"
  | "bridge_admin_jwt_to_driver"
  | "use_localstorage_role_as_sot";

/** Pure guard used by tests and call sites — never "fix" a cross-project token. */
export function assertNoTokenBridge(from: AuthProject, to: AuthProject): void {
  if (from === to) return;
  if ((from === "driver" && to === "admin-lovable") || (from === "admin-lovable" && to === "driver")) {
    throw new Error("Unsafe token bridge: Driver Auth and Admin Lovable Cloud must not share JWTs.");
  }
}

export function describeAuthBoundaries(): string[] {
  return [
    "Driver Compliance JWT unlocks only Driver Supabase (tracker / portal).",
    "Admin & Attendance JWT unlocks only the Lovable Admin Cloud client — never Driver tables.",
    "This app serves Compliance + Admin only; Personal/Dispatch UIs are not in the repo.",
    "localStorage role flags and AppSwitcher hide/show are UX only — RLS/RPC/ACL enforce access.",
  ];
}

export function isLocalRoleSourceOfTruth(): false {
  return false;
}
