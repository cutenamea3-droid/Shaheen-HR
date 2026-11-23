import {
  EMPTY_GRANTS,
  type ModuleGrants,
  type ModuleId,
  type Privilege,
  type ResolvedAccess,
} from "./types";

function asGrants(grants: ModuleGrants | null | undefined): ModuleGrants {
  return grants && typeof grants === "object" && !Array.isArray(grants)
    ? { ...EMPTY_GRANTS, ...grants }
    : { ...EMPTY_GRANTS };
}

function activeModules(grants: ModuleGrants): ModuleId[] {
  const g = asGrants(grants);
  const out: ModuleId[] = [];
  if (g.compliance) out.push("compliance");
  if (g["admin-hr"]) out.push("admin-hr");
  // personal / dispatch seats are ignored in this Compliance + Attendance app
  return out;
}

/** Drug + rate: Compliance admin only. Finance: Admin-HR admin only. */
export function privilegesFor(grants: ModuleGrants): Privilege[] {
  const g = asGrants(grants);
  const priv: Privilege[] = [];
  if (g.compliance === "admin") {
    priv.push("drug", "rate");
  }
  if (g["admin-hr"] === "admin") {
    priv.push("finance");
  }
  return priv;
}

export function hasPrivilege(grants: ModuleGrants, privilege: Privilege): boolean {
  return privilegesFor(grants).includes(privilege);
}

/** @deprecated Dispatch portal removed from this app — always false. */
export function isDispatchOnly(_grants: ModuleGrants): boolean {
  return false;
}

/**
 * Modules shown in the company AppSwitcher (Compliance + Admin only).
 */
export function selectableModulesFor(
  grants: ModuleGrants,
  _opts: { pathname: string },
): ModuleId[] {
  return activeModules(grants);
}

export function homePathFor(grants: ModuleGrants): string {
  const g = asGrants(grants);
  if (g.compliance) return "/";
  if (g["admin-hr"]) return "/admin";
  return "/access-denied";
}

export function moduleForPath(pathname: string): ModuleId | "public" | "access-denied" | null {
  if (pathname === "/cv" || pathname.startsWith("/cv/")) return "public";
  if (pathname === "/access-denied" || pathname.startsWith("/access-denied/")) return "access-denied";
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return "admin-hr";
  // Soft-landing routes remain classified so ModuleRedirector can skip denial.
  if (pathname === "/personal" || pathname.startsWith("/personal/")) return "personal";
  if (pathname === "/dispatch" || pathname.startsWith("/dispatch/")) return "dispatch";
  // Driver Compliance owns remaining app routes (/, /drivers, /s/*, …)
  if (
    pathname === "/" ||
    pathname.startsWith("/drivers") ||
    pathname.startsWith("/drug-tests") ||
    pathname.startsWith("/records") ||
    pathname.startsWith("/account") ||
    pathname.startsWith("/team") ||
    pathname.startsWith("/activity") ||
    pathname.startsWith("/s/")
  ) {
    return "compliance";
  }
  return null;
}

export function canAccessPath(grants: ModuleGrants, pathname: string): boolean {
  const mod = moduleForPath(pathname);
  if (mod === "public" || mod === "access-denied") return true;
  if (!mod) return false;
  // Retired portals: soft landing is always reachable (no seat required).
  if (mod === "personal" || mod === "dispatch") return true;
  return Boolean(asGrants(grants)[mod]);
}

/**
 * Admin keeps its own LoginGate + auth storage.
 * Missing an Admin seat must NOT mean Access Denied — the user still needs
 * `/admin` login. Compliance is different: seats without Compliance are bounced
 * off Driver URLs. Personal/Dispatch soft landings are never hard-denied.
 */
export function isIndependentLoginModule(mod: ModuleId | "public" | "access-denied" | null): boolean {
  return mod === "admin-hr" || mod === "personal" || mod === "dispatch";
}

/**
 * Whether ModuleRedirector should send the user to /access-denied for this path.
 * Pure + testable. Returns false while anonymous (no seats) so LoginGates can run.
 */
export function shouldDenyModulePath(grants: ModuleGrants, pathname: string): boolean {
  const mod = moduleForPath(pathname);
  if (mod === "public" || mod === "access-denied" || !mod) return false;
  // Independent portals / soft landings: never hard-deny.
  if (isIndependentLoginModule(mod)) return false;

  const g = asGrants(grants);
  const hasAnySeat = Boolean(g.compliance || g["admin-hr"]);
  if (!hasAnySeat) return false;

  // Compliance URLs only: Admin-only without a Compliance seat → Access Denied.
  return !canAccessPath(grants, pathname);
}

/**
 * Company AppSwitcher links after seats resolve.
 * Always keep Compliance + Admin as login surfaces so independent Admin
 * LoginGate remains reachable even when that module's seat is not probed yet.
 */
export function companySwitcherModules(_grants: ModuleGrants): ModuleId[] {
  return ["compliance", "admin-hr"];
}

export function resolveAccess(grants: ModuleGrants, pathname = "/"): ResolvedAccess {
  const normalized = asGrants(grants);
  return {
    grants: normalized,
    privileges: privilegesFor(normalized),
    dispatchOnly: false,
    selectableModules: selectableModulesFor(normalized, { pathname }),
    homePath: homePathFor(normalized),
  };
}

/** Where to send a user who hit a URL they are not entitled to. */
export function denialRedirect(grants: ModuleGrants): string {
  const home = homePathFor(asGrants(grants));
  if (home === "/access-denied") return "/access-denied";
  return `/access-denied?from=${encodeURIComponent(home)}`;
}

export function seatsToGrants(
  seats: Array<{ module: ModuleId; role: string; active: boolean }>,
): ModuleGrants {
  const grants: ModuleGrants = { ...EMPTY_GRANTS };
  const list = Array.isArray(seats) ? seats : [];
  for (const seat of list) {
    if (!seat?.active) continue;
    if (seat.module === "compliance" && (seat.role === "admin" || seat.role === "standard")) {
      grants.compliance = seat.role;
    } else if (seat.module === "admin-hr" && (seat.role === "admin" || seat.role === "standard")) {
      grants["admin-hr"] = seat.role;
    }
    // personal / dispatch seats ignored in this app
  }
  return grants;
}
