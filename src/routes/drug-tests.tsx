import { createFileRoute } from "@tanstack/react-router";
import { AdminOnly } from "@/components/tracker/AdminOnly";
import { AppShell } from "@/components/tracker/AppShell";
import { DrugTestRecordsPage } from "@/components/tracker/driver-hr/DrugTestRecordsPage";

export const Route = createFileRoute("/drug-tests")({
  head: () => ({
    meta: [
      { title: "Drug Test Records — Shaheen Driver Tracker" },
      {
        name: "description",
        content: "Federal Drug (CCF) and Medical Review (MRO) testing-event register for drivers.",
      },
      { property: "og:title", content: "Drug Test Records — Shaheen Driver Tracker" },
      {
        property: "og:description",
        content: "Searchable drug test records — unlimited events per driver.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AdminOnly>
      <AppShell
        title="Drug Test Records"
        subtitle="Federal Drug (CCF) · Medical Review (MRO) — paperwork pairing only, not clearance"
      >
        {/* Full-width after sidebar: no max-width/center; ~16–24px via shell-main-pad */}
        <div className="w-full min-w-0 max-w-none overflow-x-hidden">
          <DrugTestRecordsPage />
        </div>
      </AppShell>
    </AdminOnly>
  ),
});
