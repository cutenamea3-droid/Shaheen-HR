import { createFileRoute } from "@tanstack/react-router";
import { CvPortfolio } from "@/cv/CvPortfolio";

export const Route = createFileRoute("/cv")({
  head: () => ({
    meta: [
      { title: "Muhammad Yousaf Shahzad — HR & Safety Compliance Manager" },
      {
        name: "description",
        content:
          "Portfolio CV of Muhammad Yousaf Shahzad: HR & Safety Compliance Manager at Shaheen Transport LLC — fleet compliance, attendance systems, and sales.",
      },
      { property: "og:title", content: "Muhammad Yousaf Shahzad — CV" },
      {
        property: "og:description",
        content: "HR, fleet safety compliance, sales and web app development.",
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CvPage,
});

function CvPage() {
  return <CvPortfolio />;
}
