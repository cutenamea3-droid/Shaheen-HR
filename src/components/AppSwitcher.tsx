import { useEffect, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { FileCheck2, UsersRound } from "lucide-react";
import {
  EMPTY_GRANTS,
  companySwitcherModules,
  probeModuleGrants,
  type ModuleGrants,
  type ModuleId,
} from "@/lib/module-access";
import { useHydrated } from "@/lib/use-hydrated";

/**
 * Top bar that switches between Compliance and Admin & Attendance only.
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
  const isCv = path === "/cv";
  // Access Denied is never a third switcher tab — only Compliance + Admin.
  const isDriver = !isAdmin && !isCv;

  const [grants, setGrants] = useState<ModuleGrants>(EMPTY_GRANTS);
  const [ready, setReady] = useState(false);
  const [authEpoch, setAuthEpoch] = useState(0);

  useEffect(() => {
    let alive = true;
    let unsub = () => {};
    void import("@/integrations/supabase/client")
      .then(({ supabase, isSupabaseConfigured }) => {
        if (!alive || !isSupabaseConfigured()) return;
        const { data } = supabase.auth.onAuthStateChange(() => {
          if (alive) setAuthEpoch((n) => n + 1);
        });
        unsub = () => data.subscription.unsubscribe();
      })
      .catch(() => {});
    const bump = () => {
      if (alive) setAuthEpoch((n) => n + 1);
    };
    window.addEventListener("shaheen-lock", bump);
    window.addEventListener("shaheen-portal-ready", bump);
    return () => {
      alive = false;
      unsub();
      window.removeEventListener("shaheen-lock", bump);
      window.removeEventListener("shaheen-portal-ready", bump);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    // Drop ready while re-probing so stale grants cannot hide LoginGate links.
    setReady(false);
    void probeModuleGrants().then((g) => {
      if (!alive) return;
      setGrants(g);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [pathname, authEpoch]);

  const hasAnySeat = Boolean(grants.compliance || grants["admin-hr"]);
  // Anonymous / unknown: both company login surfaces. After seats: Compliance + Admin.
  const selectable =
    ready && hasAnySeat
      ? companySwitcherModules(grants)
      : (["compliance", "admin-hr"] as ModuleId[]);

  const show = (id: ModuleId) => selectable.includes(id);

  // Personal CV / portfolio is a public surface — never show dashboard switcher chrome.
  if (hydrated && isCv) return null;

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
    to: "/" | "/admin";
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
      <nav
        aria-label="System switcher"
        className="ml-auto flex items-center gap-1 rounded-lg border border-border bg-background p-1 sm:ml-4"
      >
        {show("compliance") && (
          <NavLink to="/" label="Driver Compliance" title="Driver Compliance" current={isDriver}>
            <FileCheck2 className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Driver Compliance</span>
          </NavLink>
        )}
        {show("admin-hr") && (
          <NavLink
            to="/admin"
            label="Admin & Attendance"
            title="Admin & Attendance"
            current={isAdmin}
          >
            <UsersRound className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Admin &amp; Attendance</span>
          </NavLink>
        )}
      </nav>
    </header>
  );
}
