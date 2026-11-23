import { sectionById } from "@/lib/sections";

/** Title + subtitle for Driver Compliance chrome, derived from the URL. */
export function shellMeta(pathname: string): { title: string; subtitle?: string } {
  if (pathname === "/") {
    return {
      title: "Compliance Dashboard",
      subtitle:
        "Shaheen Transport LLC · every alert in one place — click a driver to jump to their row",
    };
  }
  if (pathname.startsWith("/s/")) {
    const id = pathname.slice(3).split(/[/?#]/)[0] ?? "";
    const def = sectionById(id);
    return {
      title: def?.title ?? "Section",
      subtitle: "Click any cell to edit · changes save automatically",
    };
  }
  if (pathname === "/drivers") {
    return {
      title: "Driver Cards",
      subtitle: "Open a driver to see and edit all their documents at once",
    };
  }
  if (pathname === "/alerts") {
    return {
      title: "My Compliance Today",
      subtitle: "Drivers and issues that need attention today",
    };
  }
  if (pathname === "/drug-tests") {
    return {
      title: "Drug Test Records",
      subtitle: "Federal Drug (CCF) · Medical Review (MRO) — paperwork pairing only, not clearance",
    };
  }
  if (pathname === "/records") {
    return {
      title: "Other Records",
      subtitle: "Extra driver documents, owner operators and mechanics — for your records",
    };
  }
  if (pathname === "/account") {
    return { title: "My Account", subtitle: "Profile and password settings" };
  }
  if (pathname === "/team") {
    return { title: "User Accounts", subtitle: "Manage Driver Compliance users" };
  }
  if (pathname === "/activity") {
    return { title: "Activity Logs", subtitle: "Compliance changes saved by portal users" };
  }
  return { title: "Driver Compliance" };
}

/** True while the router has a newer location than the last resolved paint. */
export function navIsPending(state: {
  status: string;
  isLoading: boolean;
  location: { pathname: string };
  resolvedLocation?: { pathname: string } | undefined;
}): boolean {
  if (state.status === "pending" || state.isLoading) return true;
  const resolved = state.resolvedLocation?.pathname;
  return resolved != null && resolved !== state.location.pathname;
}
