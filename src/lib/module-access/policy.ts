import {
  EMPTY_GRANTS,
  type ModuleGrants,
  type ModuleId,
  type Privilege,
  type ResolvedAccess,
} from "./types";

function activeModules(grants: ModuleGrants): ModuleId[] {
  const out: ModuleId[] = [];
  if (grants.compliance) out.push("compliance");
  if (grants["admin-hr"]) out.push("admin-hr");
  if (grants.personal) out.push("personal");
  if (grants.dispatch) out.push("dispatch");
  return out;
}

/** Drug + rate: Compliance admin only. Finance: Admin-HR admin only. */
export function privilegesFor(grants: ModuleGrants): Privilege[] {
  const priv: Privilege[] = [];
  if (grants.compliance === "admin") {
    priv.push("drug", "rate");
  }
  if (grants["admin-hr"] === "admin") {
    priv.push("finance");
  }
  return priv;
}

export function hasPrivilege(grants: ModuleGrants, privilege: Privilege): boolean {
  return privilegesFor(grants).includes(privilege);
}

export function isDispatchOnly(grants: ModuleGrants): boolean {
  return Boolean(grants.dispatch) && !grants.compliance && !grants["admin-hr"] && !grants.personal;
}

/**
 * Modules shown in the company AppSwitcher.
 * Personal is never advertised on company routes (privacy) — only while already on /personal.
 */
export function selectableModulesFor(
  grants: ModuleGrants,
  opts: { pathname: string },
): ModuleId[] {
  const modules: ModuleId[] = activeModules(grants).filter((m) => m !== "personal");
  const onPersonal = opts.pathname === "/personal" || opts.pathname.startsWith("/personal/");
  if (onPersonal && grants.personal) modules.push("personal");
  return modules;
}

export function homePathFor(grants: ModuleGrants): string {
  if (isDispatchOnly(grants)) return "/dispatch";
  if (grants.compliance) return "/";
  if (grants["admin-hr"]) return "/admin";
  if (grants.dispatch) return "/dispatch";
  if (grants.personal) return "/personal";
  return "/access-denied";
}

export function moduleForPath(pathname: string): ModuleId | "public" | "access-denied" | null {
  if (pathname === "/cv" || pathname.startsWith("/cv/")) return "public";
  if (pathname === "/access-denied" || pathname.startsWith("/access-denied/")) return "access-denied";
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return "admin-hr";
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
  return Boolean(grants[mod]);
}

export function resolveAccess(grants: ModuleGrants, pathname = "/"): ResolvedAccess {
  const normalized = { ...EMPTY_GRANTS, ...grants };
  return {
    grants: normalized,
    privileges: privilegesFor(normalized),
    dispatchOnly: isDispatchOnly(normalized),
    selectableModules: selectableModulesFor(normalized, { pathname }),
    homePath: homePathFor(normalized),
  };
}

/** Where to send a user who hit a URL they are not entitled to. */
export function denialRedirect(grants: ModuleGrants): string {
  const home = homePathFor(grants);
  if (home === "/access-denied") return "/access-denied";
  return `/access-denied?from=${encodeURIComponent(home)}`;
}

export function seatsToGrants(
  seats: Array<{ module: ModuleId; role: string; active: boolean }>,
): ModuleGrants {
  const grants: ModuleGrants = { ...EMPTY_GRANTS };
  for (const seat of seats) {
    if (!seat.active) continue;
    if (seat.module === "compliance" && (seat.role === "admin" || seat.role === "standard")) {
      grants.compliance = seat.role;
    } else if (seat.module === "admin-hr" && (seat.role === "admin" || seat.role === "standard")) {
      grants["admin-hr"] = seat.role;
    } else if (seat.module === "personal" && seat.role === "owner") {
      grants.personal = "owner";
    } else if (seat.module === "dispatch" && (seat.role === "admin" || seat.role === "dispatcher")) {
      grants.dispatch = seat.role;
    }
  }
  return grants;
}
