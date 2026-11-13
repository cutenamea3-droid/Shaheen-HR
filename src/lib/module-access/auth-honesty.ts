/**
 * Cross-project auth honesty (Batch 2).
 *
 * Three Auth backends exist:
 * - Driver Supabase (`VITE_SUPABASE_*`) — Compliance ACL + (optional) Dispatch ACL
 * - Admin Lovable Cloud — separate hardcoded client in `src/admin/integrations/supabase/client.ts`
 * - Personal Supabase (`VITE_PERSONAL_*`) — PR #16; not required on main until approved
 *
 * Forbidden:
 * - Copying JWT / session storage keys across projects
 * - Using Driver session to call Admin APIs (or vice versa)
 * - Treating localStorage roles / AppSwitcher visibility as source of truth
 *
 * Allowed:
 * - Dispatch reusing the Driver *project* with a dedicated auth storage key + `dispatch_portal_accounts`
 * - Deriving module grants by reading each project's own session independently
 */

import type { AuthProject } from "./types";

export const AUTH_STORAGE_KEYS = {
  driver: "sb-", // supabase-js default prefix; Driver client may use preview broker
  dispatch: "shaheen-dispatch-auth-v1",
  adminSession: "shaheen-hr-account-session-v1",
  adminSecrets: "shaheen-hr-account-secrets-v1",
  personal: "hr-personal-sb-auth-v1",
  personalLocal: "hr-personal-auth-",
} as const;

export type AuthBoundaryViolation =
  | "bridge_driver_jwt_to_admin"
  | "bridge_admin_jwt_to_driver"
  | "bridge_personal_jwt_to_company"
  | "bridge_company_jwt_to_personal"
  | "use_localstorage_role_as_sot";

/** Pure guard used by tests and call sites — never "fix" a cross-project token. */
export function assertNoTokenBridge(from: AuthProject, to: AuthProject): void {
  if (from === to) return;
  // Driver ↔ Dispatch share the Driver Auth project by design (separate storage + ACL).
  // That is not a bridge to Admin or Personal.
  if ((from === "driver" && to === "admin-lovable") || (from === "admin-lovable" && to === "driver")) {
    throw new Error("Unsafe token bridge: Driver Auth and Admin Lovable Cloud must not share JWTs.");
  }
  if (from === "personal" || to === "personal") {
    throw new Error("Unsafe token bridge: Personal Auth must stay on the Personal project only.");
  }
}

export function describeAuthBoundaries(): string[] {
  return [
    "Driver Compliance JWT unlocks only Driver Supabase (tracker / portal / optional dispatch_* with Dispatch ACL).",
    "Admin & Attendance JWT unlocks only the Lovable Admin Cloud client — never Driver tables.",
    "Personal JWT (when #16 + Personal project enabled) unlocks only Personal tables.",
    "Dispatch uses dedicated auth storage (`shaheen-dispatch-auth-v1`) even when URL/key match Driver.",
    "localStorage role directories and AppSwitcher hide/show are UX only — RLS/RPC/ACL enforce access.",
  ];
}

export function isLocalRoleSourceOfTruth(): false {
  return false;
}
