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
 * After sessions settle, bounce users away from non-independent module URLs they
 * lack seats for. Compliance + Admin keep their own LoginGates — never Access-Deny
 * one because the other module's seat was already probed (dual-auth).
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

    // Compliance + Admin are independent LoginGates — never hard-deny either
    // from the other module's seat (fixes sticky /access-denied?module=compliance).
    if (!shouldDenyModulePath(grants, pathname)) return;

    void navigate({
      to: "/access-denied",
      search: { module: mod },
      replace: true,
    });
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
