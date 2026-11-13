import { createFileRoute } from "@tanstack/react-router";
import { AccessDenied } from "@/components/AccessDenied";
import type { ModuleId } from "@/lib/module-access";
import { MODULE_IDS } from "@/lib/module-access";

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

function AccessDeniedPage() {
  const { module } = Route.useSearch();
  const mod = MODULE_IDS.includes(module as ModuleId) ? (module as ModuleId) : null;
  return <AccessDenied module={mod} />;
}
