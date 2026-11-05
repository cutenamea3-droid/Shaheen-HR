import { Rows3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { setDensity, useDensity } from "@/lib/density";

const btn =
  "ui-press inline-flex h-10 items-center gap-2 rounded-xl border-2 bg-card px-3 text-sm font-bold shadow-card hover:border-primary/40";

/** Compact ↔ Comfortable — local UI preference only. */
export function DensityToggle({ className }: { className?: string }) {
  const density = useDensity();
  const compact = density === "compact";
  return (
    <button
      type="button"
      onClick={() => setDensity(compact ? "comfortable" : "compact")}
      title="Compact packs tables and cards tighter; Comfortable keeps more breathing room"
      aria-pressed={compact}
      className={cn(btn, compact && "border-primary bg-brand text-primary-foreground hover:text-primary-foreground", className)}
    >
      <Rows3 className="size-4" />
      {compact ? "Compact" : "Comfortable"}
    </button>
  );
}
