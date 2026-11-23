import { useState } from "react";
import { KeyRound, ShieldCheck } from "lucide-react";
import { supabase } from "@/admin/integrations/supabase/client";
import { useApp } from "@/admin/lib/store";
import { hasHrLocalPassword, setHrLocalPassword, verifyHrLocalPassword } from "@/admin/lib/hr-auth-local";

const asText = (v: unknown) => (v == null ? "" : typeof v === "string" ? v : String(v));

export function MyAccount({ email, isAdmin }: { email: string; isAdmin: boolean }) {
  const addLog = useApp((s) => s.addLog);
  const [current, setCurrent] = useState("");
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const emailKey = (email == null ? "" : typeof email === "string" ? email : String(email)).trim();
  const initials = emailKey.slice(0, 2).toUpperCase() || "?";
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <p className="lbl">Profile & security</p>
        <h1 className="font-display text-3xl font-bold">My Account</h1>
        <p className="text-sm text-muted-foreground">Your personal profile and password.</p>
      </div>
      <div className="panel space-y-4">
        <div className="flex items-center gap-3">
          <div className="brand-gradient flex h-12 w-12 items-center justify-center rounded-xl font-bold text-primary-foreground">{initials}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{emailKey || "—"}</p>
            <p className="text-xs text-muted-foreground">Signed in</p>
          </div>
          <span className="chip bg-primary/10 text-primary">
            <ShieldCheck className="mr-1 h-3 w-3" />
            {isAdmin ? "Admin" : "Standard"}
          </span>
        </div>
      </div>
      <form
        className="panel space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setMsg(null);
          const fd = new FormData(e.currentTarget);
          const cur = String(fd.get("admin-current-password") ?? current) || asText(current);
          const next = String(fd.get("admin-new-password") ?? pass) || asText(pass);
          const conf = String(fd.get("admin-confirm-password") ?? confirm) || asText(confirm);
          setCurrent(cur);
          setPass(next);
          setConfirm(conf);
          if (!cur) return setMsg({ ok: false, text: "Enter your current password." });
          if (next.length < 8) return setMsg({ ok: false, text: "Password must be at least 8 characters." });
          if (next !== conf) return setMsg({ ok: false, text: "Passwords do not match." });
          if (next === cur) return setMsg({ ok: false, text: "New password must be different from the current password." });
          setBusy(true);
          try {
            const mail = emailKey.toLowerCase();
            // Accept current if it matches local hash OR the live cloud password.
            // Local-only checks used to reject the password the user just signed in with
            // after a prior local-fallback save left the two out of sync.
            let currentOk = hasHrLocalPassword(mail) && (await verifyHrLocalPassword(mail, cur));
            if (!currentOk) {
              const { error: signErr } = await supabase.auth.signInWithPassword({
                email: mail,
                password: cur,
              });
              currentOk = !signErr;
            }
            if (!currentOk) throw new Error("Current password is incorrect.");

            const { data: sessionData } = await supabase.auth.getSession();
            let cloudOk = false;
            if (sessionData.session) {
              const { error } = await supabase.auth.updateUser({ password: next });
              cloudOk = !error;
            }

            // Always mirror to localStorage so the next sign-in honors the new password
            // even when the cloud update is unavailable (local-only session).
            await setHrLocalPassword(mail, next);
            addLog(email, cloudOk ? "Changed password" : "Changed password (local fallback)");
            setCurrent("");
            setPass("");
            setConfirm("");
            setMsg({
              ok: true,
              text: cloudOk ? "Password changed." : "Password saved locally (cloud update unavailable).",
            });
          } catch (err) {
            setMsg({ ok: false, text: err instanceof Error ? err.message : "Could not update password." });
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2 className="flex items-center gap-2 font-display text-lg font-bold">
          <KeyRound className="h-5 w-5 text-primary" /> Change password
        </h2>
        <label className="block">
          <span className="lbl">Current password</span>
          <input
            type="password"
            className="field"
            name="admin-current-password"
            data-testid="admin-current-password"
            value={asText(current)}
            onChange={(e) => setCurrent(e.target.value)}
            onInput={(e) => setCurrent((e.target as HTMLInputElement).value)}
            autoComplete="current-password"
            required
          />
        </label>
        <label className="block">
          <span className="lbl">New password</span>
          <input
            type="password"
            className="field"
            name="admin-new-password"
            data-testid="admin-new-password"
            value={asText(pass)}
            onChange={(e) => setPass(e.target.value)}
            onInput={(e) => setPass((e.target as HTMLInputElement).value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
        <label className="block">
          <span className="lbl">Confirm new password</span>
          <input
            type="password"
            className="field"
            name="admin-confirm-password"
            data-testid="admin-confirm-password"
            value={asText(confirm)}
            onChange={(e) => setConfirm(e.target.value)}
            onInput={(e) => setConfirm((e.target as HTMLInputElement).value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
        {msg && (
          <p role="status" className={`text-sm ${msg.ok ? "text-primary" : "text-destructive"}`}>
            {msg.text}
          </p>
        )}
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "Saving…" : "Update password"}
        </button>
      </form>
    </div>
  );
}
