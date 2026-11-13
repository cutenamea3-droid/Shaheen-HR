import { createFileRoute, type ErrorComponentProps } from "@tanstack/react-router";
import { AdminApp } from "@/admin/AdminApp";
import { ModuleErrorPanel } from "@/components/ModuleErrorPanel";

function AdminError(props: ErrorComponentProps) {
  return (
    <div className="admin-theme">
      <ModuleErrorPanel
        {...props}
        moduleLabel="Admin & Attendance"
        homeTo="/"
        homeLabel="Driver Compliance"
      />
    </div>
  );
}

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "HR Attendance Dashboard — Shaheen Transport" },
      { name: "description", content: "Daily attendance, performance, overtime and CEO PDF reports." },
      { property: "og:title", content: "HR Attendance Dashboard — Shaheen Transport" },
      { property: "og:description", content: "Daily attendance, performance, overtime and CEO PDF reports." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  // Isolate Admin failures so they do not replace the root shell / AppSwitcher.
  errorComponent: AdminError,
  component: () => (
    <div className="admin-theme">
      <AdminApp />
    </div>
  ),
});
