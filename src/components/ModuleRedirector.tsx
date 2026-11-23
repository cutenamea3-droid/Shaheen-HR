import { useEffect, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
  homePathFor,
  moduleForPath,
  probeModuleGrants,
  shouldDenyModulePath,
  type ModuleGrants,
  EMPTY_GRANTS,
} from "@/lib/module-access";

/**
 * After sessions settle, bounce users away from Compliance URLs they lack seats for.
 * Admin keeps its own LoginGate — never Access-Deny `/admin` just because Compliance
 * was already probed.
 */
export function ModuleRedirector() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [grants, setGrants] = useState<ModuleGrants>(EMPTY_GRANTS);
  const [ready, setReady] = useState(false);
  /** Bumps when Driver Auth signs in/out so seats refresh without a path change. */
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
  }, [pathname, authEpoch]);

  useEffect(() => {
    if (!ready) return;
    const mod = moduleForPath(pathname);
    if (mod === "public" || mod === "access-denied" || !mod) return;

    // Compliance-only denial (Admin-only on Driver URLs).
    // Admin LoginGate is never hard-denied here.
    if (!shouldDenyModulePath(grants, pathname)) return;

    let alive = true;
    void (async () => {
      // Never bounce an authenticated Compliance session to Access Denied.
      // LockGate only mounts children after driver_portal_accounts succeeds;
      // a lagging seat probe must not sticky-deny the owner after login.
      if (mod === "compliance") {
        try {
          const { hasPortalSession } = await import("@/lib/cloud");
          if (!alive) return;
          if (await hasPortalSession()) return;
        } catch {
          /* fall through — re-probe once more before deny */
        }
        try {
          const fresh = await probeModuleGrants();
          if (!alive) return;
          if (fresh.compliance) {
            setGrants(fresh);
            return;
          }
        } catch {
          /* fall through to deny */
        }
      }
      if (!alive) return;
      void navigate({
        to: "/access-denied",
        search: { module: mod },
        replace: true,
      });
    })();
    return () => {
      alive = false;
    };
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
