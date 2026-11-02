import { createFileRoute, notFound } from "@tanstack/react-router";
import { AppShell } from "@/components/tracker/AppShell";
import { DataTable } from "@/components/tracker/DataTable";
import { sectionById } from "@/lib/sections";

export const Route = createFileRoute("/s/$sectionId")({
  validateSearch: (s: Record<string, unknown>): { row?: string | undefined } => ({
    row: typeof s.row === "string" ? s.row : undefined,
  }),
  loader: ({ params }) => {
    const def = sectionById(params.sectionId);
    if (!def) throw notFound();
    return { title: def.title };
  },
  head: ({ loaderData }) => {
    const t = loaderData?.title ?? "Section";
    return {
      meta: [
        { title: `${t} — Shaheen Driver Tracker` },
        { name: "description", content: `Track ${t} for Shaheen Transport drivers with alerts and notes.` },
        { property: "og:title", content: `${t} — Shaheen Driver Tracker` },
        { property: "og:description", content: `Track ${t} for Shaheen Transport drivers.` },
      ],
    };
  },
  component: SectionPage,
});

function SectionPage() {
  const { sectionId } = Route.useParams();
  const { row } = Route.useSearch();
  const def = sectionById(sectionId)!;
  return (
    <AppShell title={def.title} subtitle="Click any cell to edit · changes save automatically">
      <DataTable key={sectionId} sectionId={sectionId} focusRow={row} />
    </AppShell>
  );
}
