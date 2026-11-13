import { useEffect, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { FileCheck2, ShieldX, Truck, UserRound, UsersRound } from "lucide-react";
import {
  EMPTY_GRANTS,
  probeModuleGrants,
  selectableModulesFor,
  type ModuleGrants,
  type ModuleId,
} from "@/lib/module-access";
import { shouldShowPersonalSwitcherLink } from "@/personal/lib/auth-probe";
import { useHydrated } from "@/lib/use-hydrated";

/**
 * Top bar that switches between isolated systems.
 * After seats resolve, only permitted modules remain visible
 * (Dispatch-only users do not see Compliance / Admin).
 * Personal appears only when already on `/personal` or seat probe allows (Batch 2 / #26).
 *
 * SPA shell is prerendered for `/` only (vite spa.prerender). Path-dependent
 * active/`aria-current` markup — including TanStack Link's built-in
 * `data-status`/`aria-current` — must not differ on the first client paint or
 * React 19 throws hydration #418. Until hydrated we render a static `/` shell
 * with plain anchors (Driver current); after mount we switch to real Links.
 */
export function AppSwitcher() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hydrated = useHydrated();
  // Match the prerendered `/` shell until after hydration (not the real deep path).
  const path = hydrated ? pathname : "/";
  const isAdmin = path.startsWith("/admin");
  const isDispatch = path.startsWith("/dispatch");
  const isPersonal = path.startsWith("/personal");
  const isCv = path === "/cv";
  const isDenied = path.startsWith("/access-denied");
  const isDriver = !isAdmin && !isDispatch && !isPersonal && !isCv && !isDenied;

  const [grants, setGrants] = useState<ModuleGrants>(EMPTY_GRANTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    void probeModuleGrants().then((g) => {
      if (!alive) return;
      setGrants(g);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [pathname]);

  const hasAnySeat = Boolean(
    grants.compliance || grants["admin-hr"] || grants.personal || grants.dispatch,
  );
  // Anonymous / unknown: keep company login surfaces visible. Once seats resolve, filter strictly.
  const selectable =
    ready && hasAnySeat
      ? selectableModulesFor(grants, { pathname })
      : (["compliance", "admin-hr", "dispatch"] as ModuleId[]);

  const show = (id: ModuleId) => {
    if (id === "personal") {
      return shouldShowPersonalSwitcherLink(isPersonal) && Boolean(grants.personal || isPreviewOrUnknown());
    }
    return selectable.includes(id);
  };

  function isPreviewOrUnknown() {
    return !ready || !hasAnySeat;
  }

  const base =
    "ui-press inline-flex h-8 items-center justify-center gap-2 rounded-md px-2.5 text-[13px] font-semibold tracking-tight transition-colors sm:px-3";
  const on = "bg-primary text-primary-foreground shadow-sm";
  const off = "text-muted-foreground hover:bg-muted hover:text-foreground";

  /** Plain anchors until hydrated — avoids TanStack Link injecting real-path aria-current. */
  function ShellLink({
    href,
    label,
    title,
    current,
    children,
  }: {
    href: string;
    label: string;
    title: string;
    current: boolean;
    children: ReactNode;
  }) {
    return (
      <a
        href={href}
        aria-label={label}
        title={title}
        aria-current={current ? "page" : undefined}
        className={`${base} ${current ? on : off}`}
      >
        {children}
      </a>
    );
  }

  function NavLink({
    to,
    label,
    title,
    current,
    children,
  }: {
    to: "/" | "/admin" | "/dispatch" | "/personal";
    label: string;
    title: string;
    current: boolean;
    children: ReactNode;
  }) {
    if (!hydrated) {
      return (
        <ShellLink href={to} label={label} title={title} current={current}>
          {children}
        </ShellLink>
      );
    }
    return (
      <Link
        to={to}
        aria-label={label}
        title={title}
        aria-current={current ? "page" : undefined}
        className={`${base} ${current ? on : off}`}
      >
        {children}
      </Link>
    );
  }

  return (
    <header
      className="app-switcher sticky top-0 z-50 flex items-center gap-3 border-b border-border bg-card px-3"
      style={{ height: 44, fontSize: 13 }}
    >
      <img src="/logo.jpg" alt="Shaheen Transport LLC" className="h-8 w-8 rounded object-contain" />
      <div className="min-w-0 leading-tight">
        <span className="hidden font-display text-[13px] font-bold tracking-tight text-foreground sm:inline">
          Shaheen Transport
        </span>
        <span className="ml-2 hidden text-[11px] font-semibold text-muted-foreground lg:inline">
          Management Portal
        </span>
      </div>
      <nav aria-label="System switcher" className="ml-auto flex items-center gap-1 rounded-lg border border-border bg-background p-1 sm:ml-4">
        {show("compliance") && (
          <NavLink to="/" label="Driver Compliance" title="Driver Compliance" current={isDriver}>
            <FileCheck2 className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Driver Compliance</span>
          </NavLink>
        )}
        {show("admin-hr") && (
          <NavLink to="/admin" label="Admin & Attendance" title="Admin & Attendance" current={isAdmin}>
            <UsersRound className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Admin &amp; Attendance</span>
          </NavLink>
        )}
        {show("dispatch") && (
          <NavLink to="/dispatch" label="Dispatch Operations" title="Dispatch Operations" current={isDispatch}>
            <Truck className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Dispatch</span>
          </NavLink>
        )}
        {show("personal") && (
          <NavLink to="/personal" label="HR Personal" title="HR Personal" current={isPersonal}>
            <UserRound className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Personal</span>
          </NavLink>
        )}
        {isDenied && (
          <span className={`${base} ${on}`} aria-current="page">
            <ShieldX className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Access denied</span>
          </span>
        )}
      </nav>
    </header>
  );
}
