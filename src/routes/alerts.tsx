import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/tracker/AppShell";
import { AlertsWorkCenter } from "@/components/tracker/AlertsWorkCenter";

type AlertsSearch = {
  filter?: string | undefined;
  q?: string | undefined;
};

export const Route = createFileRoute("/alerts")({
  validateSearch: (s: Record<string, unknown>): AlertsSearch => ({
    filter: typeof s.filter === "string" ? s.filter : undefined,
    q: typeof s.q === "string" ? s.q : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Smart Alerts — Shaheen Driver Tracker" },
      {
        name: "description",
        content: "Compliance work center — review drivers needing attention and resolve routine tasks on one page.",
      },
      { property: "og:title", content: "Smart Alerts — Shaheen Driver Tracker" },
      {
        property: "og:description",
        content: "Driver-by-driver alerts with inline edit and Future Plan suggestions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell
      title="Smart Alerts"
      subtitle="Compliance work center — see every driver needing attention, edit and save here"
    >
      <div className="w-full min-w-0 max-w-none overflow-x-hidden">
        <AlertsWorkCenter />
      </div>
    </AppShell>
  ),
});
