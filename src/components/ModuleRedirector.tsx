import { useEffect, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
  homePathFor,
  isDispatchOnly,
  moduleForPath,
  probeModuleGrants,
  shouldDenyModulePath,
  type ModuleGrants,
  EMPTY_GRANTS,
} from "@/lib/module-access";

/**
 * After sessions settle, bounce users away from Compliance URLs they lack seats for.
 * Admin / Personal / Dispatch keep their own LoginGates — never Access-Deny those
 * paths just because another module's seat (e.g. Compliance) is already probed.
 * Dispatch-only accounts auto-land on /dispatch when they hit Compliance URLs.
 */
export function ModuleRedirector() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [grants, setGrants] = useState<ModuleGrants>(EMPTY_GRANTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    // Drop ready while re-probing so a prior path's grants cannot deny the new URL.
    setReady(false);
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

    // Compliance-only denial (Admin-only / Personal-only on Driver URLs).
    // Independent LoginGate modules are never hard-denied here.
    if (shouldDenyModulePath(grants, pathname)) {
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
