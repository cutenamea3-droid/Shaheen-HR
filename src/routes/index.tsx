import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/tracker/AppShell";
import { Dashboard } from "@/components/tracker/Dashboard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Shaheen Driver Files Tracker" },
      { name: "description", content: "Driver compliance alerts, expirations and future plans for Shaheen Transport LLC." },
      { property: "og:title", content: "Dashboard — Shaheen Driver Files Tracker" },
      { property: "og:description", content: "Driver compliance alerts, expirations and future plans for Shaheen Transport LLC." },
    ],
  }),
  component: () => (
    <AppShell title="Compliance Dashboard" subtitle="Shaheen Transport LLC · every alert in one place — click a driver to jump to their row">
      <Dashboard />
    </AppShell>
  ),
});
