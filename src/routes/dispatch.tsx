import { createFileRoute, type ErrorComponentProps } from "@tanstack/react-router";
import { DispatchApp } from "@/dispatch/DispatchApp";
import { ModuleErrorPanel } from "@/components/ModuleErrorPanel";

function DispatchError(props: ErrorComponentProps) {
  return (
    <div className="dispatch-theme">
      <ModuleErrorPanel
        {...props}
        moduleLabel="Dispatch Operations"
        homeTo="/"
        homeLabel="Driver Compliance"
      />
    </div>
  );
}

export const Route = createFileRoute("/dispatch")({
  head: () => ({
    meta: [
      { title: "Dispatch Operations — Shaheen Transport" },
      {
        name: "description",
        content: "Manual dispatch ops tracker for Shaheen Transport LLC — loads, check-calls, and shift handover.",
      },
      { property: "og:title", content: "Dispatch Operations — Shaheen Transport" },
      {
        property: "og:description",
        content: "Manual dispatch ops tracker for Shaheen Transport LLC — loads, check-calls, and shift handover.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  errorComponent: DispatchError,
  component: () => (
    <div className="dispatch-theme">
      <DispatchApp />
    </div>
  ),
});
