import { useRef, useState } from "react";
import { Lock, ShieldCheck } from "lucide-react";
import { AboutPanel } from "@/admin/components/hr/AboutPanel";
import { attemptHrLogin } from "@/admin/lib/hr-login";
import {
  ensureHrAuthPersisted,
  writeHrCloudEmailHint,
  type HrPersistedSession,
} from "@/admin/lib/hr-auth-persist";
import { HR_OWNER_EMAIL } from "@/admin/lib/hr-access";
import { supabase } from "@/admin/integrations/supabase/client";
import logo from "@/assets/logo.jpg.asset.json";
import { ForgotPasswordLink } from "@/components/portal-login/ForgotPasswordLink";
import { PasswordField } from "@/components/portal-login/PasswordField";
import { PortalLoginCard, PortalLoginShell } from "@/components/portal-login/PortalLoginShell";

/**
 * Admin & Attendance lock screen — same PortalLoginShell / PortalLoginCard
 * chrome as Driver Compliance `LockGate` so width, padding, logo, and type
 * scale stay identical (rem root pinned via `.portal-login-shell` in CSS).
 */
export function AdminLockGate({
  onLocalAuth,
  onCloudAuth,
}: {
  onLocalAuth: (email: string) => void;
  onCloudAuth: (email: string, uid: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState(HR_OWNER_EMAIL);
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  // Synchronous guards: React `busy` alone allows a second submit before re-render.
  const busyRef = useRef(false);
  const attemptRef = useRef(0);
  const emailRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);

  const clearErrOnEdit = () => {
    if (err) setErr("");
  };

  return (
    <PortalLoginShell
      about={<AboutPanel compact />}
      footerRole="Yousaf · HR Operations & Administration"
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (busyRef.current) return;
          busyRef.current = true;
          const attempt = ++attemptRef.current;
          const isStale = () => attempt !== attemptRef.current;
          setBusy(true);
          setErr("");

          // Prefer live DOM values so browser autofill that skipped onChange still signs in.
          const form = e.currentTarget;
          const fd = new FormData(form);
          const mailRaw = String(fd.get("email") ?? emailRef.current?.value ?? email);
          const passRaw = String(fd.get("password") ?? passRef.current?.value ?? pass);
          if (mailRaw !== email) setEmail(mailRaw);
          if (passRaw !== pass) setPass(passRaw);

          try {
            const {
              hasHrLocalPassword,
              verifyHrLocalPassword,
              writeHrLocalSession,
              clearHrLocalSession,
            } = await import("@/admin/lib/hr-auth-local");

            const signedRef: { current: HrPersistedSession | null } = { current: null };

            const result = await attemptHrLogin(mailRaw, passRaw, {
              signInWithPassword: async (creds) => {
                const { data, error } = await supabase.auth.signInWithPassword(creds);
                if (!error && data.session?.access_token && data.session.refresh_token) {
                  signedRef.current = {
                    access_token: data.session.access_token,
                    refresh_token: data.session.refresh_token,
                    expires_at: data.session.expires_at ?? null,
                    expires_in: data.session.expires_in ?? null,
                    token_type: data.session.token_type ?? "bearer",
                    user: data.session.user
                      ? { id: data.session.user.id, email: data.session.user.email ?? null }
                      : null,
                  };
                }
                return {
                  error: error
                    ? {
                        message: error.message,
                        status: error.status,
                        name: error.name,
                        code: typeof error.code === "string" ? error.code : undefined,
                      }
                    : null,
                };
              },
              signOut: () => supabase.auth.signOut(),
              hasHrLocalPassword,
              verifyHrLocalPassword,
              writeHrLocalSession,
              clearHrLocalSession,
              isStale,
            });

            if (isStale()) return;

            if (result.ok) {
              setErr("");
              const normalized = mailRaw.trim().toLowerCase();
              if (result.mode === "local") {
                onLocalAuth(normalized);
                // Keep busy until parent swaps to the dashboard (local path).
                return;
              }
              const signedSession = signedRef.current;
              // Opera/VPN: dual-write session so soft refresh keeps Cloud Saved.
              if (signedSession) {
                await ensureHrAuthPersisted(signedSession, {
                  setSession: async (s) => {
                    const { error } = await supabase.auth.setSession(s);
                    return { error };
                  },
                });
              } else {
                writeHrCloudEmailHint(normalized);
              }
              if (isStale()) return;
              // Open dashboard from the session now — do not wait solely on onAuthStateChange
              // (that race left the form briefly interactive and sometimes showed a stale error).
              const { data } = await supabase.auth.getSession();
              if (isStale()) return;
              const uid = data.session?.user?.id ?? signedSession?.user?.id ?? null;
              if (uid) {
                {
                  const sessMail =
                    data.session?.user?.email ??
                    (typeof signedSession?.user?.email === "string"
                      ? signedSession.user.email
                      : null);
                  const mail =
                    sessMail == null
                      ? ""
                      : (typeof sessMail === "string" ? sessMail : String(sessMail))
                          .trim()
                          .toLowerCase();
                  writeHrCloudEmailHint(mail || normalized);
                  onCloudAuth(mail || normalized, uid);
                }
                return;
              }
              // Session should exist after a successful cloud sign-in; treat as network-ish failure.
              setErr("Couldn't reach the server. Try again.");
              busyRef.current = false;
              setBusy(false);
              return;
            }

            if (result.kind === "stale") return;
            setErr(result.message);
            busyRef.current = false;
            setBusy(false);
          } catch {
            if (isStale()) return;
            setErr("Couldn't reach the server. Try again.");
            busyRef.current = false;
            setBusy(false);
          }
        }}
      >
        <PortalLoginCard
          logoSrc={logo.url}
          title="Admin & Attendance"
          subtitle="Sign in to continue"
        >
          {err && (
            <p
              role="alert"
              className="mt-4 rounded-lg bg-danger-soft p-3 text-sm font-semibold text-danger"
            >
              {err}
            </p>
          )}
          <label className="mt-5 block text-sm font-bold text-foreground" htmlFor="admin-email">
            Email
          </label>
          <input
            id="admin-email"
            ref={emailRef}
            name="email"
            type="email"
            className="mt-1 h-11 w-full rounded-xl border bg-card px-3 text-foreground"
            data-testid="admin-email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              clearErrOnEdit();
            }}
            onInput={(e) => {
              setEmail((e.target as HTMLInputElement).value);
              clearErrOnEdit();
            }}
            autoComplete="username"
          />
          <PasswordField
            id="admin-password"
            testId="admin-password"
            value={pass}
            onChange={(v) => {
              setPass(v);
              clearErrOnEdit();
            }}
            inputRef={passRef}
            autoFocus
          />
          <div className="mt-1 flex justify-end">
            <ForgotPasswordLink
              email={email}
              resetPasswordForEmail={async (mail) => {
                const redirectTo = `${window.location.origin}/admin`;
                const { error } = await supabase.auth.resetPasswordForEmail(mail, { redirectTo });
                return { error: error ? { message: error.message } : null };
              }}
            />
          </div>
          <button
            type="submit"
            className="ui-press mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand text-lg font-bold text-primary-foreground shadow-pop disabled:opacity-60"
            data-testid="admin-sign-in"
            disabled={busy}
            aria-busy={busy}
          >
            <Lock className="size-5" /> {busy ? "Signing in…" : "Sign in"}
          </button>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Use the email and password from your administrator. Your attendance data stays on this
            browser and in Admin cloud when signed in.
          </p>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
            <ShieldCheck className="size-4 text-ok" /> Access is managed by your Admin &amp;
            Attendance administrator
          </p>
        </PortalLoginCard>
      </form>
    </PortalLoginShell>
  );
}
