import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Brain,
  CalendarRange,
  ClipboardList,
  Gauge,
  LayoutDashboard,
  ListTodo,
  Lock,
  LogOut,
  NotebookPen,
  Timer,
  Vault as VaultIcon,
} from "lucide-react";
import {
  clearPersonalSession,
  hasPersonalPassword,
  readPersonalSession,
  setPersonalPassword,
  verifyPersonalPassword,
  writePersonalSession,
} from "@/personal/lib/auth";
import { usePersonal, whenPersonalHydrated } from "@/personal/lib/store";
import { Overview } from "@/personal/components/Overview";
import { Courses } from "@/personal/components/Courses";
import { Backlog } from "@/personal/components/Backlog";
import { Timetable } from "@/personal/components/Timetable";
import { Assessments } from "@/personal/components/Assessments";
import { Focus } from "@/personal/components/Focus";
import { Notes } from "@/personal/components/Notes";
import { Analytics } from "@/personal/components/Analytics";
import { Vault } from "@/personal/components/Vault";
import { Btn, Field } from "@/personal/components/common";

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

function LoginGate({ onAuthed }: { onAuthed: () => void }) {
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(() =>
    typeof window === "undefined" ? true : !hasPersonalPassword(),
  );
  const pwRef = useRef<HTMLInputElement>(null);
  const pw2Ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setNeedsSetup(!hasPersonalPassword());
  }, []);

  return (
    <div className="flex min-h-[calc(100vh-44px)] items-center justify-center px-4 py-12">
      <div className="grid w-full max-w-5xl items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="order-2 space-y-4 lg:order-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--hp-teal)]">
            Private study workspace
          </p>
          <h1 className="hp-title text-4xl font-bold tracking-tight text-[var(--hp-ink)] sm:text-5xl">
            HR Personal
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-[var(--hp-muted)]">
            Premium command center for VU Pakistan BS IT (Fall 2026). Isolated from company Driver
            and Admin data. No invented grades or lecture completion.
          </p>
          <ul className="space-y-2 text-sm text-[var(--hp-muted)]">
            <li className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-[var(--hp-violet)]" /> Overview · Courses · Backlog
              recovery
            </li>
            <li className="flex items-center gap-2">
              <Timer className="h-4 w-4 text-[var(--hp-teal)]" /> Smart timetable · Focus Pomodoro
            </li>
            <li className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-[var(--hp-blue)]" /> Separate local gate · personal-only
              storage
            </li>
          </ul>
        </div>

        <form
          className="hp-panel order-1 mx-auto w-full max-w-sm space-y-4 lg:order-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true);
            setErr("");
            const fd = new FormData(e.currentTarget);
            const pw = String(fd.get("password") ?? pwRef.current?.value ?? "");
            const pw2 = String(fd.get("password2") ?? pw2Ref.current?.value ?? "");
            try {
              if (needsSetup) {
                if (pw.length < 6) throw new Error("Use at least 6 characters.");
                if (pw !== pw2) throw new Error("Passwords do not match.");
                await setPersonalPassword(pw);
                writePersonalSession();
                onAuthed();
                return;
              }
              const ok = await verifyPersonalPassword(pw);
              if (!ok) throw new Error("Incorrect password.");
              writePersonalSession();
              onAuthed();
            } catch (ex) {
              setErr(ex instanceof Error ? ex.message : "Sign-in failed.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="flex items-center gap-2 text-[var(--hp-violet)]">
            <Lock className="h-5 w-5" />
            <span className="text-sm font-bold tracking-wide">
              {needsSetup ? "Create private gate" : "Unlock HR Personal"}
            </span>
          </div>
          <label className="block space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--hp-muted)]">
              Password
            </span>
            <input
              ref={pwRef}
              className="hp-field"
              name="password"
              type="password"
              autoComplete={needsSetup ? "new-password" : "current-password"}
              required
            />
          </label>
          {needsSetup ? (
            <label className="block space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--hp-muted)]">
                Confirm
              </span>
              <input
                ref={pw2Ref}
                className="hp-field"
                name="password2"
                type="password"
                autoComplete="new-password"
                required
              />
            </label>
          ) : null}
          {err ? <p className="text-sm text-red-400">{err}</p> : null}
          <Btn type="submit" disabled={busy} className="w-full justify-center">
            {busy ? "…" : needsSetup ? "Save & enter" : "Enter workspace"}
          </Btn>
          <p className="text-[11px] text-[var(--hp-muted)]">
            Auth and data stay on personal keys only. Company Admin login is never used here.
          </p>
        </form>
      </div>
    </div>
  );
}

export function PersonalApp() {
  const authed = usePersonal((s) => s.authed);
  const setAuthed = usePersonal((s) => s.setAuthed);
  const settings = usePersonal((s) => s.settings);
  const [tab, setTab] = useState<TabId>("overview");
  const [ready, setReady] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    void whenPersonalHydrated().then(() => {
      // Session key is source of truth — never keep a stale persisted authed flag.
      setAuthed(readPersonalSession());
      setReady(true);
    });
  }, [setAuthed]);

  const Active = useMemo(() => TABS.find((t) => t[0] === tab)?.[2] ?? Overview, [tab]);

  if (!ready) {
    return (
      <div className="flex min-h-[calc(100vh-44px)] items-center justify-center text-sm text-[var(--hp-muted)]">
        Loading personal workspace…
      </div>
    );
  }

  if (!authed) {
    return <LoginGate onAuthed={() => setAuthed(true)} />;
  }

  return (
    <div
      className={`personal-shell flex min-h-[calc(100vh-44px)] ${settings.theme === "light" ? "hp-light" : ""}`}
    >
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
            <div className="hp-title truncate text-sm font-bold">HR Personal</div>
            <div className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--hp-muted)]">
              Study command
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
                  ? "bg-[var(--hp-violet)] text-white"
                  : "text-[var(--hp-muted)] hover:bg-white/5 hover:text-[var(--hp-ink)]"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </button>
          ))}
        </nav>
        <div className="shrink-0 border-t border-[var(--hp-border)] p-3">
          <button
            type="button"
            data-testid="hp-lock"
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-[var(--hp-muted)] hover:bg-white/5 hover:text-[var(--hp-ink)]"
            onClick={() => {
              clearPersonalSession();
              usePersonal.setState({ authed: false });
              setAuthed(false);
            }}
          >
            <LogOut className="h-4 w-4" /> Lock workspace
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
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-[var(--hp-border)] bg-[var(--hp-bg)]/90 px-3 backdrop-blur sm:px-5">
          <button
            type="button"
            className="hp-btn-ghost lg:hidden"
            onClick={() => setNavOpen(true)}
          >
            Menu
          </button>
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--hp-muted)]">
              {settings.semester}
            </div>
            <h1 className="hp-title truncate text-base font-bold sm:text-lg">
              {TABS.find((t) => t[0] === tab)?.[1] ?? "Overview"}
            </h1>
          </div>
          <div className="ml-auto hidden text-right text-xs text-[var(--hp-muted)] sm:block">
            <div className="font-semibold text-[var(--hp-ink)]">{settings.program}</div>
            <div>~2h / workday · local-first</div>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-3 sm:p-5">
          <Active />
        </main>
      </div>
    </div>
  );
}
