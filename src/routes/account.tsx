import { createFileRoute } from "@tanstack/react-router";
import { AccountSettings } from "@/components/tracker/AccountSettings";
import { AppShell } from "@/components/tracker/AppShell";

export const Route = createFileRoute("/account")({
  component: () => (
    <AppShell title="My Account" subtitle="Profile and password settings">
      <AccountSettings />
    </AppShell>
  ),
});
