import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/tracker/AppShell";
import { Records } from "@/components/tracker/Records";

export const Route = createFileRoute("/records")({
  head: () => ({
    meta: [
      { title: "Other Records — Shaheen Driver Tracker" },
      { name: "description", content: "Manual records for extra driver documents, owner operators and mechanics." },
      { property: "og:title", content: "Other Records — Shaheen Driver Tracker" },
      { property: "og:description", content: "Extra driver documents, owner operators and mechanics." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell title="Other Records" subtitle="Extra driver documents, owner operators and mechanics — for your records">
      <Records />
    </AppShell>
  ),
});
