import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AccessDenied } from "@/components/AccessDenied";
import {
  MODULE_IDS,
  canAccessPath,
  homePathFor,
  probeModuleGrants,
  type ModuleId,
  type ModuleGrants,
  EMPTY_GRANTS,
} from "@/lib/module-access";

type Search = { module?: string | undefined };

export const Route = createFileRoute("/access-denied")({
  validateSearch: (search: Record<string, unknown>): Search => {
    if (typeof search.module === "string") return { module: search.module };
    return {};
  },
  head: () => ({
    meta: [
      { title: "Access denied — Shaheen Transport" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AccessDeniedPage,
});

/**
 * Access Denied must send "Go to your home module" to the caller's real home
 * (e.g. Admin-only → /admin), not always `/`. Defaulting to `/` re-triggers
 * ModuleRedirector → /access-denied?module=compliance (sticky loop) and on
 * Production the access-denied URL also threw React #418 on refresh.
 *
 * Also re-probes on Driver Auth changes: signing into Compliance while another
 * seat (Personal/Dispatch) was already probed used to leave a sticky false deny
 * until a manual path change.
 */
function AccessDeniedPage() {
  const { module } = Route.useSearch();
  const navigate = useNavigate();
  const mod = MODULE_IDS.includes(module as ModuleId) ? (module as ModuleId) : null;
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
    const onLock = () => {
      if (alive) setAuthEpoch((n) => n + 1);
    };
    window.addEventListener("shaheen-lock", onLock);
    return () => {
      alive = false;
      unsub();
      window.removeEventListener("shaheen-lock", onLock);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    setReady(false);
    void probeModuleGrants().then((g) => {
      if (!alive) return;
      setGrants(g);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [authEpoch]);

  useEffect(() => {
    if (!ready || !mod) return;
    // Seat arrived after a stale deny (e.g. Compliance login while Personal/Dispatch
    // seats were already known) — leave Access Denied for the real home.
    const home = homePathFor(grants);
    if (home === "/access-denied") return;
    if (mod === "compliance" && canAccessPath(grants, "/")) {
      void navigate({ to: home, replace: true });
    }
  }, [ready, grants, mod, navigate]);

  const home = homePathFor(grants);
  // Anonymous visitors who opened this URL manually: send them to Compliance login.
  const homePath = !ready || home === "/access-denied" ? "/" : home;

  return <AccessDenied module={mod} homePath={homePath} />;
}
