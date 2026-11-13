import { useEffect, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
  canAccessPath,
  homePathFor,
  isDispatchOnly,
  moduleForPath,
  probeModuleGrants,
  type ModuleGrants,
  EMPTY_GRANTS,
} from "@/lib/module-access";

/**
 * After sessions settle, bounce users away from modules they lack seats for.
 * Dispatch-only accounts auto-land on /dispatch when they hit Compliance URLs.
 */
export function ModuleRedirector() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
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

  useEffect(() => {
    if (!ready) return;
    const mod = moduleForPath(pathname);
    if (mod === "public" || mod === "access-denied" || !mod) return;

    // Dispatch-only: never keep them on Compliance LockGate URLs.
    if (isDispatchOnly(grants) && mod === "compliance") {
      void navigate({ to: "/dispatch", replace: true });
      return;
    }

    // If we already know seats and this path is forbidden, send to Access Denied
    // (skip while anonymous on compliance/admin/dispatch/personal — those modules show their own login).
    const hasAnySeat = Boolean(
      grants.compliance || grants["admin-hr"] || grants.personal || grants.dispatch,
    );
    if (!hasAnySeat) return;
    if (!canAccessPath(grants, pathname)) {
      void navigate({
        to: "/access-denied",
        search: { module: mod },
        replace: true,
      });
    }
  }, [ready, grants, pathname, navigate]);

  return null;
}

export function useHomePathAfterProbe(): string {
  const [home, setHome] = useState("/");
  useEffect(() => {
    void probeModuleGrants().then((g) => setHome(homePathFor(g)));
  }, []);
  return home;
}
