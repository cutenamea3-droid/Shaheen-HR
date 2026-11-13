import { createFileRoute } from "@tanstack/react-router";
import { DispatchApp } from "@/dispatch/DispatchApp";

export const Route = createFileRoute("/dispatch")({
  head: () => ({
    meta: [
      { title: "Dispatch Operations — Shaheen Transport" },
      {
        name: "description",
        content: "Dispatch auth isolation landing for Shaheen Transport LLC.",
      },
      { property: "og:title", content: "Dispatch Operations — Shaheen Transport" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: () => (
    <div className="dispatch-theme">
      <DispatchApp />
    </div>
  ),
});
