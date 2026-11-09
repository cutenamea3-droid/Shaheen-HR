import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Lock } from "lucide-react";
import {
  hydratePersonalAuth,
  personalNeedsSetup,
  personalSignIn,
  personalSignOut,
  personalAuthMode,
  isPersonalSignupAllowed,
} from "@/personal/lib/session";
import { usePersonal, whenPersonalHydrated } from "@/personal/lib/store";
import { ThemeToggle } from "@/personal/components/ThemeToggle";

/** Study workspace loads only after successful auth — keeps unauth shell free of study UI. */
const PersonalWorkspace = lazy(() =>
  import("@/personal/PersonalWorkspace").then((m) => ({ default: m.PersonalWorkspace })),
);

function LoginGate({ onAuthed }: { onAuthed: () => void }) {
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const mode = personalAuthMode();
  const [needsSetup, setNeedsSetup] = useState(() =>
    typeof window === "undefined" ? false : personalNeedsSetup(),
  );
  const loginRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);
  const pass2Ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setNeedsSetup(personalNeedsSetup());
  }, []);

  const showConfirm =
    mode === "local" ? needsSetup : needsSetup && isPersonalSignupAllowed();

  return (
    <div className="hp-login-split grid min-h-[calc(100vh-44px)] lg:grid-cols-[1.05fr_0.95fr]">
      <section className="hp-login-hero relative flex flex-col justify-between overflow-hidden px-6 py-8 sm:px-10 sm:py-12 lg:px-14 lg:py-14">
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden
          style={{
            background:
              "radial-gradient(820px 480px at 12% 8%, rgba(139,92,246,0.32), transparent 58%), radial-gradient(640px 380px at 88% 78%, rgba(45,212,191,0.12), transparent 52%), radial-gradient(500px 300px at 60% 40%, rgba(59,130,246,0.10), transparent 50%)",
          }}
        />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-2.5 py-1">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-[#8B5CF6] text-[10px] font-bold text-white">
              HP
            </span>
            <span className="hp-title text-sm font-bold tracking-tight text-[#F8FAFC]">HR Personal</span>
          </div>
        </div>
        <div className="relative z-10 max-w-md py-16 lg:py-24">
          <h1 className="hp-title text-[2.35rem] font-bold leading-[1.08] tracking-tight text-[#F8FAFC] sm:text-5xl">
            Welcome back
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-[#94A3B8]">Sign in to continue</p>
        </div>
        <div className="relative z-10 h-4" aria-hidden />
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
            const login = String(fd.get("login") ?? loginRef.current?.value ?? "");
            const password = String(fd.get("password") ?? passRef.current?.value ?? "");
            const password2 = String(fd.get("password2") ?? pass2Ref.current?.value ?? "");
            try {
              const result = await personalSignIn(
                login,
                password,
                showConfirm ? password2 : undefined,
              );
              if (!result.ok) throw new Error(result.message);
              onAuthed();
            } catch {
              setErr("Invalid credentials.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[var(--hp-violet)]">
              <Lock className="h-4 w-4 shrink-0" />
              <span className="text-[13px] font-bold tracking-wide">Sign in</span>
            </div>
            <p className="hp-login-muted text-[12px] leading-relaxed">Sign in to continue</p>
          </div>
          <label className="block space-y-1.5">
            <span className="hp-login-muted text-[10px] font-semibold uppercase tracking-[0.14em]">
              Username or email
            </span>
            <input
              ref={loginRef}
              className="hp-login-input"
              name="login"
              type="text"
              autoComplete="username"
              required
            />
          </label>
          <label className="block space-y-1.5">
            <span className="hp-login-muted text-[10px] font-semibold uppercase tracking-[0.14em]">
              Password
            </span>
            <input
              ref={passRef}
              className="hp-login-input"
              name="password"
              type="password"
              autoComplete={showConfirm ? "new-password" : "current-password"}
              required
            />
          </label>
          {showConfirm ? (
            <label className="block space-y-1.5">
              <span className="hp-login-muted text-[10px] font-semibold uppercase tracking-[0.14em]">
                Confirm password
              </span>
              <input
                ref={pass2Ref}
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
            {busy ? "…" : "Sign In"}
          </button>
        </form>
      </section>
    </div>
  );
}

export function PersonalApp() {
  const authed = usePersonal((s) => s.authed);
  const setAuthed = usePersonal((s) => s.setAuthed);
  const settings = usePersonal((s) => s.settings);
  const [ready, setReady] = useState(false);
  const theme = settings.theme === "light" ? "light" : "dark";

  useEffect(() => {
    void whenPersonalHydrated().then(async () => {
      const ok = await hydratePersonalAuth();
      setAuthed(ok);
      setReady(true);
    });
  }, [setAuthed]);

  useEffect(() => {
    document.documentElement.setAttribute("data-hp-theme", theme);
    return () => {
      document.documentElement.removeAttribute("data-hp-theme");
    };
  }, [theme]);

  return (
    <div className="personal-theme" data-hp-theme={theme}>
      {!ready ? (
        <div className="flex min-h-[calc(100vh-44px)] items-center justify-center text-sm text-[var(--hp-muted)]">
          Loading…
        </div>
      ) : !authed ? (
        <LoginGate onAuthed={() => setAuthed(true)} />
      ) : (
        <Suspense
          fallback={
            <div className="flex min-h-[calc(100vh-44px)] items-center justify-center text-sm text-[var(--hp-muted)]">
              Loading…
            </div>
          }
        >
          <PersonalWorkspace
            onLock={async () => {
              await personalSignOut();
              usePersonal.setState({ authed: false });
              setAuthed(false);
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
