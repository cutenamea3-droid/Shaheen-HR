/**
 * Cross-project auth honesty (Compliance + Attendance app).
 *
 * Auth backends in this deployable:
 * - Driver Supabase (`VITE_SUPABASE_*`) — Compliance ACL
 * - Admin Lovable Cloud — separate hardcoded client in `src/admin/integrations/supabase/client.ts`
 *
 * Personal / Dispatch UIs are retired from this app; their cloud projects/tables
 * remain untouched. Do not reintroduce Personal/Dispatch JWT probes here.
 *
 * Forbidden:
 * - Copying JWT / session storage keys across projects
 * - Using Driver session to call Admin APIs (or vice versa)
 * - Treating localStorage roles / AppSwitcher visibility as source of truth
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
  if ((from === "driver" && to === "admin-lovable") || (from === "admin-lovable" && to === "driver")) {
    throw new Error("Unsafe token bridge: Driver Auth and Admin Lovable Cloud must not share JWTs.");
  }
  if (from === "personal" || to === "personal") {
    throw new Error("Unsafe token bridge: Personal Auth must stay on the Personal project only.");
  }
}

export function describeAuthBoundaries(): string[] {
  return [
    "Driver Compliance JWT unlocks only Driver Supabase (tracker / portal).",
    "Admin & Attendance JWT unlocks only the Lovable Admin Cloud client — never Driver tables.",
    "Personal / Dispatch UIs are not served by this app; their cloud data is left intact.",
    "localStorage role directories and AppSwitcher hide/show are UX only — RLS/RPC/ACL enforce access.",
  ];
}

export function isLocalRoleSourceOfTruth(): false {
  return false;
}
