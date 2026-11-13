import { createFileRoute } from "@tanstack/react-router";
import { PersonalLanding } from "@/personal/PersonalLanding";

/**
 * Client route for /personal.
 * Honesty: static Cloudflare Pages SPA gate ≠ edge ACL. Full secure Personal is PR #16.
 */
export const Route = createFileRoute("/personal")({
  head: () => ({
    meta: [
      { title: "HR Personal" },
      { name: "description", content: "HR Personal" },
      { property: "og:title", content: "HR Personal" },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  beforeLoad: () => ({ personalRoute: true as const }),
  component: () => <PersonalLanding />,
});
