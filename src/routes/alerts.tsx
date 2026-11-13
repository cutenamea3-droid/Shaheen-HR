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
      { title: "My Compliance Today — Shaheen Driver Tracker" },
      {
        name: "description",
        content:
          "My Compliance Today — work center, follow-up tracker, and Future Plan calendar with inline edit.",
      },
      { property: "og:title", content: "My Compliance Today — Shaheen Driver Tracker" },
      {
        property: "og:description",
        content: "Driver-by-driver alerts, durable follow-ups, and Intelligent Future Plan Calendar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell
      title="My Compliance Today"
      subtitle="Work center · Follow-Up Tracker · Future Plan Calendar — edit and save on this page"
    >
      <div className="w-full min-w-0 max-w-none overflow-x-hidden">
        <AlertsWorkCenter />
      </div>
    </AppShell>
  ),
});
