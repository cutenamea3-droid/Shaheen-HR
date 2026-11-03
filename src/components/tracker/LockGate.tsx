import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/logo.jpg.asset.json";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { getPortalAccount, PORTAL_EMAIL, signInPortalAccount, updatePortalProfile, type PortalAccount } from "@/lib/cloud";
import { isPreviewIsolated } from "@/lib/preview-isolated";
import { AboutPanel } from "./AboutPanel";

export { isPreviewIsolated } from "@/lib/preview-isolated";

const PortalAccountContext = createContext<{
  account: PortalAccount;
  updateDisplayName: (name: string) => Promise<void>;
} | null>(null);

const PREVIEW_ACCOUNT: PortalAccount = {
  user_id: "preview-isolated-local",
  email: "preview@local.isolated",
  display_name: "Preview (isolated)",
  role: "admin",
  active: true,
};

export function useOptionalPortalAccount() {
  return useContext(PortalAccountContext);
}

export function usePortalAccount() {
  const context = useContext(PortalAccountContext);
  if (!context) throw new Error("usePortalAccount must be used inside the Driver Compliance portal.");
  return context;
}

export function lockPortal() {
  localStorage.removeItem("shaheen-unlocked");
  localStorage.removeItem("shaheen-pass");
  // Isolated preview never talks to Auth/Supabase.
  if (!isPreviewIsolated() && isSupabaseConfigured()) {
    void supabase.auth.signOut();
  }
  window.dispatchEvent(new Event("shaheen-lock"));
}

export function LockGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [account, setAccount] = useState<PortalAccount | null>(null);
  const [email, setEmail] = useState(PORTAL_EMAIL);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    localStorage.removeItem("shaheen-pass");
    localStorage.removeItem("shaheen-unlocked");

    // Safe local UI preview: seed/mock account, no Supabase session, no cloud sync login.
    if (isPreviewIsolated()) {
      setAccount(PREVIEW_ACCOUNT);
      setEmail(PREVIEW_ACCOUNT.email);
      setError("");
      setReady(true);
      const onLock = () => {
        if (active) setAccount(PREVIEW_ACCOUNT);
      };
      window.addEventListener("shaheen-lock", onLock);
      return () => {
        active = false;
        window.removeEventListener("shaheen-lock", onLock);
      };
    }

    // Missing VITE_SUPABASE_* must not crash the SPA into the root error UI —
    // show the sign-in card with a clear message; localStorage data stays intact.
    if (!isSupabaseConfigured()) {
      setError(
        "Cloud sign-in is not configured (missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY on the build). Local saved data is still in this browser.",
      );
      setReady(true);
      return () => {
        active = false;
      };
    }
    const acceptSession = async (userId: string, userEmail: string) => {
      try {
        const next = await getPortalAccount(userId);
        if (!active) return;
        if (!next || !next.active) {
          setAccount(null);
          setError("This account is not active in Driver Compliance.");
          await supabase.auth.signOut();
        } else {
          setAccount(next);
          setError("");
        }
      } catch (e) {
        if (active) {
          setAccount(null);
          setError(e instanceof Error ? e.message : "Could not load the Driver Compliance account.");
        }
      } finally {
        if (active) {
          setEmail(userEmail);
          setReady(true);
        }
      }
    };

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) {
        setError(sessionError.message);
        setReady(true);
      } else if (data.session) {
        void acceptSession(data.session.user.id, data.session.user.email ?? "");
      } else {
        setReady(true);
      }
    }).catch((e) => {
      if (!active) return;
      setError(e instanceof Error ? e.message : "Could not reach cloud auth.");
      setReady(true);
    });

    let unsubscribe = () => {};
    try {
      const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!active) return;
        if (session) {
          window.setTimeout(() => {
            if (active) void acceptSession(session.user.id, session.user.email ?? "");
          }, 0);
        } else {
          setAccount(null);
          setEmail("");
        }
      });
      unsubscribe = () => subscription.subscription.unsubscribe();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start cloud auth.");
      setReady(true);
    }
    const onLock = () => setAccount(null);
    window.addEventListener("shaheen-lock", onLock);
    return () => {
      active = false;
      unsubscribe();
      window.removeEventListener("shaheen-lock", onLock);
    };
  }, []);

  const updateDisplayName = async (name: string) => {
    if (isPreviewIsolated()) {
      setAccount((current) => (current ? { ...current, display_name: name.trim() || current.display_name } : current));
      return;
    }
    const saved = await updatePortalProfile(name);
    setAccount((current) => current ? { ...current, display_name: saved } : current);
  };

  if (!ready) return null;
  if (account) {
    return (
      <PortalAccountContext.Provider value={{ account, updateDisplayName }}>
        {isPreviewIsolated() && (
          <div
            role="status"
            className="tracker-no-print sticky top-0 z-[60] border-b border-warn/40 bg-warn-soft px-3 py-1.5 text-center text-xs font-bold text-warn"
          >
            Isolated preview — mock account + seed/localStorage only. Supabase URL is non-routable; cloud sync cannot connect.
          </div>
        )}
        {children}
      </PortalAccountContext.Provider>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[1.2fr_1fr]">
        <div className="order-2 lg:order-1"><AboutPanel /></div>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (busy) return;
            setBusy(true);
            setError("");
            try {
              const { account: next, created } = await signInPortalAccount(email, password);
              setAccount(next);
              setPassword("");
              if (created) {
                toast.success("Driver Compliance account created", {
                  description: "Signed in. Cloud will upload seed data if the remote store is empty.",
                });
              } else {
                toast.success("Signed in");
              }
            } catch (e) {
              const message = e instanceof Error ? e.message : "Could not sign in.";
              setError(message);
              toast.error("Sign-in failed", { description: message, duration: 12000 });
            } finally {
              setBusy(false);
            }
          }}
          className="ui-lift ui-glow order-1 mx-auto w-full max-w-md rounded-3xl border border-t-4 border-t-primary bg-card p-8 shadow-card lg:order-2"
        >
          <img src={logo.url} alt="Shaheen Transport LLC" className="mx-auto h-40 w-auto rounded-xl" />
          <h1 className="mt-4 text-center text-2xl font-extrabold text-foreground">Driver Compliance Portal</h1>
          <p className="mt-1 text-center text-sm text-muted-foreground">Sign in with your individual account</p>
          {error && <p role="alert" className="mt-4 rounded-lg bg-danger-soft p-3 text-sm font-semibold text-danger">{error}</p>}
          <label className="mt-5 block text-sm font-bold text-foreground" htmlFor="portal-email">Email</label>
          <input
            id="portal-email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 h-11 w-full rounded-xl border bg-card px-3 text-foreground"
          />
          <label className="mt-4 block text-sm font-bold text-foreground" htmlFor="portal-password">Password</label>
          <input
            id="portal-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 h-11 w-full rounded-xl border bg-card px-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button type="submit" disabled={busy} className="ui-press mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand text-lg font-bold text-primary-foreground shadow-pop disabled:opacity-60">
            <Lock className="size-5" /> {busy ? "Signing in…" : "Sign in"}
          </button>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            First visit for this email auto-creates the Auth account with the password you type (nothing is invented).
            If signup asks to confirm email, turn off Confirm email in Supabase Auth settings, then try again.
          </p>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
            <ShieldCheck className="size-4 text-ok" /> Access is managed by your Driver Compliance administrator
          </p>
        </form>
      </div>
    </div>
  );
}
