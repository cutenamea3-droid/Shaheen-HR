import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AccessDenied } from "@/components/AccessDenied";
import {
  MODULE_IDS,
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
 */
function AccessDeniedPage() {
  const { module } = Route.useSearch();
  const mod = MODULE_IDS.includes(module as ModuleId) ? (module as ModuleId) : null;
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
  }, []);

  const home = homePathFor(grants);
  // Anonymous visitors who opened this URL manually: send them to Compliance login.
  const homePath = !ready || home === "/access-denied" ? "/" : home;

  return <AccessDenied module={mod} homePath={homePath} />;
}
