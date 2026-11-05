import { createFileRoute } from "@tanstack/react-router";
import { PersonalApp } from "@/personal/PersonalApp";

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
  component: () => <PersonalApp />,
});
