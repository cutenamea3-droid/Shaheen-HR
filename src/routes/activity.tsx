import { createFileRoute } from "@tanstack/react-router";
import { ActivityLogs } from "@/components/tracker/ActivityLogs";
import { AdminOnly } from "@/components/tracker/AdminOnly";
import { AppShell } from "@/components/tracker/AppShell";

export const Route = createFileRoute("/activity")({
  component: () => (
    <AdminOnly>
      <AppShell title="Activity Logs" subtitle="Compliance changes saved by portal users">
        <ActivityLogs />
      </AppShell>
    </AdminOnly>
  ),
});
