import { useMemo, useState } from "react";
import {
  BookOpen,
  CalendarRange,
  ClipboardList,
  Gauge,
  LayoutDashboard,
  ListTodo,
  LogOut,
  NotebookPen,
  Timer,
  Vault as VaultIcon,
} from "lucide-react";
import { clearPersonalSession } from "@/personal/lib/auth";
import { usePersonal } from "@/personal/lib/store";
import { Overview } from "@/personal/components/Overview";
import { Courses } from "@/personal/components/Courses";
import { Backlog } from "@/personal/components/Backlog";
import { Timetable } from "@/personal/components/Timetable";
import { Assessments } from "@/personal/components/Assessments";
import { Focus } from "@/personal/components/Focus";
import { Notes } from "@/personal/components/Notes";
import { Analytics } from "@/personal/components/Analytics";
import { Vault } from "@/personal/components/Vault";
import { ThemeToggle } from "@/personal/components/ThemeToggle";

const TABS = [
  ["overview", "Overview", Overview, LayoutDashboard],
  ["courses", "Courses", Courses, BookOpen],
  ["backlog", "Backlog", Backlog, ListTodo],
  ["timetable", "Timetable", Timetable, CalendarRange],
  ["assessments", "Assessments", Assessments, ClipboardList],
  ["focus", "Focus", Focus, Timer],
  ["notes", "Notes", Notes, NotebookPen],
  ["analytics", "Analytics", Analytics, Gauge],
  ["vault", "Vault", Vault, VaultIcon],
] as const;

type TabId = (typeof TABS)[number][0];

/** Authenticated workspace only — never mount before credential success. */
export function PersonalWorkspace({ onLock }: { onLock: () => void }) {
  const settings = usePersonal((s) => s.settings);
  const [tab, setTab] = useState<TabId>("overview");
  const [navOpen, setNavOpen] = useState(false);
  const Active = useMemo(() => TABS.find((t) => t[0] === tab)?.[2] ?? Overview, [tab]);

  return (
    <div className="personal-shell flex min-h-[calc(100vh-44px)]">
      <aside
        className={`hp-sidebar fixed inset-y-0 left-0 z-40 flex w-64 -translate-x-full flex-col border-r border-[var(--hp-border)] bg-[var(--hp-sidebar)] pt-[44px] transition lg:static lg:h-auto lg:translate-x-0 lg:pt-0 ${
          navOpen ? "translate-x-0" : ""
        }`}
      >
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-[var(--hp-border)] px-4">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-[var(--hp-violet)] text-sm font-bold text-white">
            HP
          </span>
          <div className="min-w-0 leading-tight">
            <div className="hp-title truncate text-sm font-bold text-[var(--hp-ink)]">HR Personal</div>
            <div className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--hp-muted)]">
              Workspace
            </div>
          </div>
        </div>
        <nav className="min-h-0 flex-1 space-y-0.5 overflow-auto p-2" aria-label="HR Personal">
          {TABS.map(([id, label, , Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setTab(id);
                setNavOpen(false);
              }}
              className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-semibold transition ${
                tab === id
                  ? "bg-[var(--hp-violet)] text-white shadow-sm"
                  : "hp-nav-idle text-[var(--hp-muted)]"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </button>
          ))}
        </nav>
        <div className="shrink-0 space-y-2 border-t border-[var(--hp-border)] p-3">
          <ThemeToggle compact />
          <button
            type="button"
            data-testid="hp-lock"
            className="hp-nav-idle flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-[var(--hp-muted)]"
            onClick={() => {
              clearPersonalSession();
              onLock();
            }}
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>

      {navOpen ? (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setNavOpen(false)}
        />
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-[var(--hp-border)] bg-[color-mix(in_srgb,var(--hp-bg)_88%,transparent)] px-3 backdrop-blur sm:px-5">
          <button type="button" className="hp-btn-ghost lg:hidden" onClick={() => setNavOpen(true)}>
            Menu
          </button>
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--hp-muted)]">
              HR Personal
            </div>
            <h1 className="hp-title truncate text-base font-bold text-[var(--hp-ink)] sm:text-lg">
              {TABS.find((t) => t[0] === tab)?.[1] ?? "Overview"}
            </h1>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right text-xs text-[var(--hp-muted)] sm:block">
              <div className="font-semibold text-[var(--hp-ink)]">{settings.program}</div>
              <div>
                Mon–Sat {settings.weekdayMinutes}m · Sun {settings.sundayMinutes}m
              </div>
            </div>
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 overflow-auto p-3 sm:p-5">
          <Active />
        </main>
      </div>
    </div>
  );
}
