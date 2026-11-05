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
    <div className="hp-login-split grid min-h-[calc(100vh-44px)] lg:grid-cols-2">
      <section className="relative flex flex-col justify-between overflow-hidden bg-[#0B1220] px-8 py-10 sm:px-12 sm:py-14">
        <div
          className="pointer-events-none absolute inset-0 opacity-90"
          aria-hidden
          style={{
            background:
              "radial-gradient(900px 520px at 15% 10%, rgba(139,92,246,0.35), transparent 55%), radial-gradient(700px 420px at 85% 80%, rgba(45,212,191,0.18), transparent 50%)",
          }}
        />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-2.5 py-1">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-[#8B5CF6] text-[10px] font-bold text-white">
              HP
            </span>
            <span className="hp-title text-sm font-bold tracking-tight text-[#F4F7FF]">HR Personal</span>
          </div>
        </div>
        <div className="relative z-10 max-w-lg space-y-5 py-12">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#2DD4BF]">
            Plan. Focus. Progress.
          </p>
          <h1 className="hp-title text-4xl font-bold leading-[1.08] tracking-tight text-[#F4F7FF] sm:text-5xl">
            Your future, under control.
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-[#94A3B8]">
            Private study command center for VU BS IT — isolated from company systems. No invented
            grades. No shared company data.
          </p>
          <ul className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              { icon: Brain, label: "Study Planning", tone: "#8B5CF6" },
              { icon: Timer, label: "Deep Focus", tone: "#2DD4BF" },
              { icon: Gauge, label: "Academic Progress", tone: "#C4B5FD" },
            ].map(({ icon: Icon, label, tone }) => (
              <li
                key={label}
                className="rounded-md border border-white/10 bg-[#172238]/70 px-3 py-3 backdrop-blur"
              >
                <Icon className="mb-2 h-4 w-4" style={{ color: tone }} />
                <div className="text-xs font-bold tracking-wide text-[#F4F7FF]">{label}</div>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative z-10 text-[11px] text-[#94A3B8]">
          Local device PIN gate · not enterprise server auth
        </p>
      </section>

      <section className="flex items-center justify-center bg-[#F4F7FF] px-6 py-12 sm:px-10">
        <form
          className="hp-login-card w-full max-w-md space-y-5 rounded-md border border-[#E2E8F0] bg-white p-6 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.45)] sm:p-8"
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
                if (pw.length < 4) throw new Error("Use at least 4 characters for your PIN.");
                if (pw !== pw2) throw new Error("PINs do not match.");
                await setPersonalPassword(pw);
                writePersonalSession();
                onAuthed();
                return;
              }
              const ok = await verifyPersonalPassword(pw);
              if (!ok) throw new Error("Incorrect PIN.");
              writePersonalSession();
              onAuthed();
            } catch (ex) {
              setErr(ex instanceof Error ? ex.message : "Unlock failed.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <div>
            <div className="flex items-center gap-2 text-[#8B5CF6]">
              <Lock className="h-5 w-5" />
              <span className="text-sm font-bold tracking-wide">
                {needsSetup ? "Create device PIN" : "Unlock HR Personal"}
              </span>
            </div>
            <p className="mt-2 text-sm text-[#64748B]">
              Honest local gate: a hashed PIN in this browser only — not server login, and never a
              real account password in the repo or <code className="text-xs">VITE_*</code> env.
            </p>
          </div>
          <label className="block space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#64748B]">
              PIN
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
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#64748B]">
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
          {err ? <p className="text-sm text-red-600">{err}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="inline-flex w-full items-center justify-center rounded-md bg-[#8B5CF6] px-4 py-3 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-55"
          >
            {busy ? "…" : needsSetup ? "Save PIN & enter" : "Enter workspace"}
          </button>
          <p className="text-[11px] leading-relaxed text-[#64748B]">
            Before production: prefer real server auth (httpOnly session). Hosting this SPA still
            means anyone with device access can inspect localStorage — treat study notes as
            private-on-device, not vault-grade secrecy.
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
            <div>
              Mon–Sat {settings.weekdayMinutes}m · Sun {settings.sundayMinutes}m · local-first
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-3 sm:p-5">
          <Active />
        </main>
      </div>
    </div>
  );
}
