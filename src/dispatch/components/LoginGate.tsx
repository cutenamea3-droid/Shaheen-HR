import { useState } from "react";
import { isDispatchPreviewMode, signInDispatch } from "@/dispatch/lib/auth";
import type { DispatchAccount } from "@/dispatch/lib/types";

export function LoginGate({ onSignedIn }: { onSignedIn: (account: DispatchAccount) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preview = isDispatchPreviewMode();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const account = await signInDispatch(email, password);
      onSignedIn(account);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dispatch-login mx-auto flex min-h-[calc(100vh-44px)] max-w-5xl items-stretch px-4 py-8">
      <div className="dispatch-login-panel grid w-full overflow-hidden rounded-2xl border border-[color:var(--dispatch-border)] bg-[color:var(--dispatch-card)] shadow-sm md:grid-cols-[1.1fr_0.9fr]">
        <div className="dispatch-login-hero relative hidden flex-col justify-end bg-[linear-gradient(145deg,#152033_0%,#202A36_48%,#E87500_140%)] p-8 text-white md:flex">
          <p className="font-display text-3xl font-bold tracking-tight">Shaheen Transport</p>
          <p className="mt-2 text-base text-white/85">Dispatch Operations</p>
          <p className="mt-6 max-w-sm text-sm leading-relaxed text-white/75">
            Morning Shift Handover continuity for US carrier dispatch desks. Manual ops tracker — not a load board,
            and never Live GPS.
          </p>
        </div>
        <form onSubmit={(e) => void submit(e)} className="flex flex-col justify-center gap-4 p-6 sm:p-8">
          <div>
            <p className="font-display text-2xl font-bold text-[color:var(--dispatch-navy)] md:hidden">
              Shaheen Transport
            </p>
            <h1 className="mt-1 text-xl font-semibold text-[color:var(--dispatch-navy)]">Dispatch sign in</h1>
            <p className="mt-1 text-sm text-[color:var(--dispatch-muted)]">
              Backend auth + RLS required. Nav hide alone is not access control.
            </p>
          </div>
          {preview && (
            <p className="rounded-md border border-amber-300/70 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              Fixture / preview mode: cloud SQL not applied or preview isolated. Data is local fixtures, not production
              cloud.
            </p>
          )}
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Email</span>
            <input
              className="dispatch-field"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required={!preview}
              placeholder={preview ? "any email (fixtures)" : "dispatcher@company.com"}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Password</span>
            <input
              className="dispatch-field"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required={!preview}
              placeholder={preview ? "any password (fixtures)" : "••••••••"}
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-[color:var(--dispatch-danger)]">
              {error}
            </p>
          )}
          <button type="submit" className="dispatch-btn-primary" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
          <p className="text-xs leading-relaxed text-[color:var(--dispatch-muted)]">
            Dispatchers cannot open Driver Compliance, Admin Attendance, or HR Personal. Invite uses a dedicated
            dispatcher login — never share Compliance seats.
          </p>
        </form>
      </div>
    </div>
  );
}
