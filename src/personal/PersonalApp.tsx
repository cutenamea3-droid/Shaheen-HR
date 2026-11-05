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
    <div className="hp-login-split grid min-h-[calc(100vh-44px)] lg:grid-cols-[1.05fr_0.95fr]">
      <section className="hp-login-hero relative flex flex-col justify-between overflow-hidden px-6 py-8 sm:px-10 sm:py-12 lg:px-14 lg:py-14">
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden
          style={{
            background:
              "radial-gradient(820px 480px at 12% 8%, rgba(139,92,246,0.38), transparent 58%), radial-gradient(640px 380px at 88% 78%, rgba(45,212,191,0.16), transparent 52%), radial-gradient(500px 300px at 60% 40%, rgba(59,130,246,0.12), transparent 50%)",
          }}
        />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-2.5 py-1">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-[#8B5CF6] text-[10px] font-bold text-white">
                HP
              </span>
              <span className="hp-title text-sm font-bold tracking-tight text-[#F8FAFC]">
                HR Personal
              </span>
            </div>
            <span className="rounded-md border border-[#F59E0B]/35 bg-[#F59E0B]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#FBBF24]">
              Prototype · local PIN
            </span>
          </div>
        </div>
        <div className="relative z-10 max-w-xl space-y-4 py-10 lg:py-14">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#2DD4BF]">
            Plan. Focus. Progress.
          </p>
          <h1 className="hp-title text-[2.15rem] font-bold leading-[1.05] tracking-tight text-[#F8FAFC] sm:text-5xl lg:text-[3.15rem]">
            Your future, under control.
          </h1>
          <p className="max-w-md text-[13px] leading-relaxed text-[#94A3B8] sm:text-sm">
            Private study command for VU BS IT — isolated from company systems. No invented grades.
            No company records in this workspace.
          </p>
          <ul className="mt-6 grid gap-2.5 sm:grid-cols-3">
            {[
              { icon: Brain, label: "Study Planning", tone: "#8B5CF6" },
              { icon: Timer, label: "Deep Focus", tone: "#2DD4BF" },
              { icon: Gauge, label: "Academic Progress", tone: "#60A5FA" },
            ].map(({ icon: Icon, label, tone }) => (
              <li
                key={label}
                className="rounded-md border border-white/10 bg-[#172238]/80 px-3 py-2.5 backdrop-blur"
              >
                <Icon className="mb-1.5 h-4 w-4" style={{ color: tone }} />
                <div className="text-[11px] font-bold tracking-wide text-[#F8FAFC] sm:text-xs">
                  {label}
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative z-10 max-w-md text-[11px] leading-relaxed text-[#94A3B8]">
          Not real server auth. Hashed device PIN in this browser only — anyone with the device can
          still inspect local data.
        </p>
      </section>

      <section className="hp-login-aside relative flex items-center justify-center px-4 py-10 sm:px-8 lg:px-12">
        <div className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6">
          <ThemeToggle />
        </div>
        <form
          className="hp-login-card w-full max-w-[360px] space-y-4 rounded-md p-5 sm:p-6"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true);
            setErr("");
            const fd = new FormData(e.currentTarget);
            const pw = String(fd.get("password") ?? pwRef.current?.value ?? "");
            const pw2 = String(fd.get("password2") ?? pw2Ref.current?.value ?? "");
            try {
              const { revealPersonalNavForOwner } = await import("@/personal/lib/access");
              if (needsSetup) {
                if (pw.length < 4) throw new Error("Use at least 4 characters for your PIN.");
                if (pw !== pw2) throw new Error("PINs do not match.");
                await setPersonalPassword(pw);
                writePersonalSession();
                revealPersonalNavForOwner();
                onAuthed();
                return;
              }
              const ok = await verifyPersonalPassword(pw);
              if (!ok) throw new Error("Incorrect PIN.");
              writePersonalSession();
              revealPersonalNavForOwner();
              onAuthed();
            } catch (ex) {
              setErr(ex instanceof Error ? ex.message : "Unlock failed.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[var(--hp-violet)]">
              <Lock className="h-4 w-4 shrink-0" />
              <span className="text-[13px] font-bold tracking-wide">
                {needsSetup ? "Create device PIN" : "Unlock HR Personal"}
              </span>
            </div>
            <p className="hp-login-muted text-[12px] leading-relaxed">
              <span className="font-semibold text-[var(--hp-login-ink)]">Prototype gate</span> —
              SHA-256 hash in <code className="text-[11px]">localStorage</code>, not an account
              password. Never put real credentials in the repo or{" "}
              <code className="text-[11px]">VITE_*</code>.
            </p>
          </div>
          <label className="block space-y-1.5">
            <span className="hp-login-muted text-[10px] font-semibold uppercase tracking-[0.14em]">
              Device PIN
            </span>
            <input
              ref={pwRef}
              className="hp-login-input"
              name="password"
              type="password"
              inputMode="text"
              autoComplete={needsSetup ? "new-password" : "current-password"}
              required
            />
          </label>
          {needsSetup ? (
            <label className="block space-y-1.5">
              <span className="hp-login-muted text-[10px] font-semibold uppercase tracking-[0.14em]">
                Confirm PIN
              </span>
              <input
                ref={pw2Ref}
                className="hp-login-input"
                name="password2"
                type="password"
                autoComplete="new-password"
                required
              />
            </label>
          ) : null}
          {err ? <p className="text-[12px] font-medium text-red-600">{err}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-11 w-full items-center justify-center rounded-md bg-[var(--hp-violet)] px-4 text-[13px] font-bold text-white transition hover:brightness-110 disabled:opacity-55"
          >
            {busy ? "…" : needsSetup ? "Save PIN & enter" : "Enter workspace"}
          </button>
          <p className="hp-login-muted text-[11px] leading-relaxed">
            Safest next step: dedicated Personal account + httpOnly server session on a separate
            backend — never company Admin/Driver tables.
          </p>
        </form>
      </section>
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
  const theme = settings.theme === "light" ? "light" : "dark";

  useEffect(() => {
    void whenPersonalHydrated().then(() => {
      setAuthed(readPersonalSession());
      setReady(true);
    });
  }, [setAuthed]);

  useEffect(() => {
    document.documentElement.setAttribute("data-hp-theme", theme);
    return () => {
      document.documentElement.removeAttribute("data-hp-theme");
    };
  }, [theme]);

  const Active = useMemo(() => TABS.find((t) => t[0] === tab)?.[2] ?? Overview, [tab]);

  return (
    <div className="personal-theme" data-hp-theme={theme}>
      {!ready ? (
        <div className="flex min-h-[calc(100vh-44px)] items-center justify-center text-sm text-[var(--hp-muted)]">
          Loading personal workspace…
        </div>
      ) : !authed ? (
        <LoginGate onAuthed={() => setAuthed(true)} />
      ) : (
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
                <div className="hp-title truncate text-sm font-bold text-[var(--hp-ink)]">
                  HR Personal
                </div>
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
            <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-[var(--hp-border)] bg-[color-mix(in_srgb,var(--hp-bg)_88%,transparent)] px-3 backdrop-blur sm:px-5">
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
      )}
    </div>
  );
}
