import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/tracker/AppShell";
import { DriverCards } from "@/components/tracker/DriverCards";

export const Route = createFileRoute("/drivers")({
  validateSearch: (s: Record<string, unknown>): { driver?: string | undefined } => ({
    driver: typeof s.driver === "string" ? s.driver : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Driver Cards — Shaheen Driver Tracker" },
      { name: "description", content: "Every driver's documents in one card — view and edit all at once." },
      { property: "og:title", content: "Driver Cards — Shaheen Driver Tracker" },
      { property: "og:description", content: "Every driver's documents in one card." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DriversPage,
});

function DriversPage() {
  const { driver } = Route.useSearch();
  return (
    <AppShell title="Driver Cards" subtitle="Open a driver to see and edit all their documents at once">
      <DriverCards {...(driver ? { focusDriver: driver } : {})} />
    </AppShell>
  );
}
