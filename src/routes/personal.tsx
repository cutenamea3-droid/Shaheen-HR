import { createFileRoute, type ErrorComponentProps } from "@tanstack/react-router";
import { PersonalApp } from "@/personal/PersonalApp";
import { ModuleErrorPanel } from "@/components/ModuleErrorPanel";

/**
 * Client route gate for /personal.
 * Honesty: with static Cloudflare Pages (nitro: false), beforeLoad runs in the SPA —
 * it is not an edge/httpOnly ACL. Secure Personal cloud needs dedicated project + flags.
 */
function PersonalError(props: ErrorComponentProps) {
  return (
    <ModuleErrorPanel {...props} moduleLabel="HR Personal" homeTo="/" homeLabel="Driver Compliance" />
  );
}

export const Route = createFileRoute("/personal")({
  head: () => ({
    meta: [
      { title: "HR Personal" },
      { name: "description", content: "HR Personal" },
      { property: "og:title", content: "HR Personal" },
      { property: "og:description", content: "HR Personal" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  // Ensure Personal never inherits Driver LockGate context; study UI still waits on PersonalApp auth.
  beforeLoad: () => ({ personalRoute: true as const }),
  errorComponent: PersonalError,
  component: () => <PersonalApp />,
});
