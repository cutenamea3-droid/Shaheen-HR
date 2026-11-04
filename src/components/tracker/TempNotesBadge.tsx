import { StickyNote } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { collectTempNotes, countTempNotes } from "@/lib/driver-meta";
import { useData } from "@/lib/store";

/**
 * Subtle gray/blue badge by the driver name. Counts nonempty Temporary Notes
 * across sections. Click → popup grouped by section. Live via useData.
 * Never feeds violations / alerts / compliance (tempnote excluded from analyzeRow).
 */
export function TempNotesBadge({
  driverId,
  className,
}: {
  driverId: string;
  className?: string;
}) {
  const data = useData();
  const count = countTempNotes(data, driverId);
  if (count <= 0) return null;
  const notes = collectTempNotes(data, driverId);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={`${count} temporary note${count > 1 ? "s" : ""} — click to view`}
          aria-label={`${count} temporary notes`}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "tracker-tempnote-badge inline-flex shrink-0 items-center gap-1 rounded-md border border-info/25 bg-info/10 px-1.5 py-0.5 text-[11px] font-bold tracking-wide text-info/90 transition hover:bg-info/20",
            className,
          )}
        >
          <StickyNote className="size-3 opacity-80" aria-hidden />
          {count}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80 border-info/20 p-0 shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-border/60 bg-muted/40 px-3 py-2">
          <div className="text-xs font-extrabold tracking-wider text-muted-foreground uppercase">
            Temporary notes
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">Reminders only — never highlight or alert.</p>
        </div>
        <ul className="max-h-64 space-y-2 overflow-y-auto p-3">
          {notes.map((n) => (
            <li key={n.sectionId} className="rounded-lg border border-border/70 bg-card px-3 py-2">
              <div className="text-[11px] font-extrabold tracking-wider text-info/80 uppercase">{n.short}</div>
              <div className="mt-0.5 text-xs font-semibold text-muted-foreground">{n.sectionTitle}</div>
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-snug text-foreground">{n.text}</p>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
