import { Moon, Sun } from "lucide-react";
import { usePersonal } from "@/personal/lib/store";

/** Visible Light / Dark control — Personal palette only (no company orange). */
export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const theme = usePersonal((s) => s.settings.theme);
  const setSettings = usePersonal((s) => s.setSettings);
  const isLight = theme === "light";

  return (
    <div
      className="hp-theme-toggle inline-flex items-center gap-0.5 rounded-md border border-[var(--hp-border)] bg-[var(--hp-elevated)] p-0.5"
      role="group"
      aria-label="Color theme"
    >
      <button
        type="button"
        data-testid="hp-theme-light"
        aria-pressed={isLight}
        title="Light mode"
        className={`inline-flex items-center gap-1.5 rounded-[0.25rem] px-2.5 py-1.5 text-[11px] font-bold transition ${
          isLight
            ? "bg-[var(--hp-violet)] text-white shadow-sm"
            : "text-[var(--hp-muted)] hover:text-[var(--hp-ink)]"
        }`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setSettings({ theme: "light" });
          document.documentElement.setAttribute("data-hp-theme", "light");
        }}
      >
        <Sun className="h-3.5 w-3.5" />
        {compact ? null : <span>Light</span>}
      </button>
      <button
        type="button"
        data-testid="hp-theme-dark"
        aria-pressed={!isLight}
        title="Dark mode"
        className={`inline-flex items-center gap-1.5 rounded-[0.25rem] px-2.5 py-1.5 text-[11px] font-bold transition ${
          !isLight
            ? "bg-[var(--hp-blue)] text-white shadow-sm"
            : "text-[var(--hp-muted)] hover:text-[var(--hp-ink)]"
        }`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setSettings({ theme: "dark" });
          document.documentElement.setAttribute("data-hp-theme", "dark");
        }}
      >
        <Moon className="h-3.5 w-3.5" />
        {compact ? null : <span>Dark</span>}
      </button>
    </div>
  );
}
