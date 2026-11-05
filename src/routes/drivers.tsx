import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/tracker/AppShell";
import { DriverCards } from "@/components/tracker/DriverCards";

type DriversSearch = {
  driver?: string | undefined;
  scope?: "company" | "owner_operator" | "new" | undefined;
  exp?: "all" | "expired" | "d15" | "d30" | "compliant" | undefined;
  tempNotes?: string | undefined;
};

export const Route = createFileRoute("/drivers")({
  validateSearch: (s: Record<string, unknown>): DriversSearch => ({
    driver: typeof s.driver === "string" ? s.driver : undefined,
    scope:
      s.scope === "company" || s.scope === "owner_operator" || s.scope === "new"
        ? s.scope
        : undefined,
    exp:
      s.exp === "all" || s.exp === "expired" || s.exp === "d15" || s.exp === "d30" || s.exp === "compliant"
        ? s.exp
        : undefined,
    tempNotes: typeof s.tempNotes === "string" ? s.tempNotes : undefined,
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
  const search = Route.useSearch();
  return (
    <AppShell title="Driver Cards" subtitle="Open a driver to see and edit all their documents at once">
      <DriverCards
        {...(search.driver ? { focusDriver: search.driver } : {})}
        {...(search.scope ? { initialScope: search.scope } : {})}
        {...(search.exp ? { initialExp: search.exp } : {})}
        {...(search.tempNotes === "1" ? { initialTempNotes: true } : {})}
      />
    </AppShell>
  );
}
