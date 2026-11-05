import { createFileRoute } from "@tanstack/react-router";
import { PersonalApp } from "@/personal/PersonalApp";

export const Route = createFileRoute("/personal")({
  head: () => ({
    meta: [
      { title: "HR Personal — Private Study Command Center" },
      {
        name: "description",
        content: "Private VU study workspace. Isolated from company Driver and Admin data.",
      },
      { property: "og:title", content: "HR Personal — Private Study Command Center" },
      {
        property: "og:description",
        content: "Private VU study workspace. Isolated from company Driver and Admin data.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: () => <PersonalApp />,
});
