import { createFileRoute } from "@tanstack/react-router";
import { AdminOnly } from "@/components/tracker/AdminOnly";
import { AppShell } from "@/components/tracker/AppShell";
import { TeamManagement } from "@/components/tracker/TeamManagement";

export const Route = createFileRoute("/team")({
  component: () => (
    <AdminOnly>
      <AppShell title="User Accounts" subtitle="Manage Driver Compliance users">
        <TeamManagement />
      </AppShell>
    </AdminOnly>
  ),
});
