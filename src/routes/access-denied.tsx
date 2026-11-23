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

type Search = { module?: string | undefined; need?: string | undefined };

export const Route = createFileRoute("/access-denied")({
  validateSearch: (search: Record<string, unknown>): Search => {
    const out: Search = {};
    if (typeof search.module === "string") out.module = search.module;
    if (typeof search.need === "string") out.need = search.need;
    return out;
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
  const { module, need } = Route.useSearch();
  const navigate = useNavigate();
  const mod = MODULE_IDS.includes(module as ModuleId) ? (module as ModuleId) : null;
  const needAdmin = need === "admin";
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
    if (!ready || !mod || needAdmin) return;
    // Seat arrived after a stale deny (e.g. Compliance login while Personal/Dispatch
    // seats were already known) — leave Access Denied for the real home.
    // Do NOT auto-leave admin-only privilege denies (Drug Tests / Team / Activity).
    const home = homePathFor(grants);
    if (home === "/access-denied") return;
    if (mod === "compliance" && canAccessPath(grants, "/")) {
      void navigate({ to: home, replace: true });
    }
  }, [ready, grants, mod, needAdmin, navigate]);

  const home = homePathFor(grants);
  // Anonymous visitors who opened this URL manually: send them to Compliance login.
  // Admin-privilege denies keep Compliance home so the user stays in the module.
  const homePath = !ready || home === "/access-denied" ? "/" : home;
  return (
    <AccessDenied
      module={mod}
      homePath={homePath}
      {...(needAdmin
        ? {
            detail:
              "This page requires a Driver Compliance admin account. Your signed-in seat can still use the rest of Driver Compliance.",
          }
        : {})}
    />
  );
}
