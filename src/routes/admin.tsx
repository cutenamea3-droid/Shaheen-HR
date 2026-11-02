import { createFileRoute } from "@tanstack/react-router";
import { AdminApp } from "@/admin/AdminApp";

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
  component: () => (
    <div className="admin-theme">
      <AdminApp />
    </div>
  ),
});
