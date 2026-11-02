import { useState } from "react";
import { KeyRound, ShieldCheck } from "lucide-react";
import { supabase } from "@/admin/integrations/supabase/client";
import { useApp } from "@/admin/lib/store";
import { hasHrLocalPassword, setHrLocalPassword, verifyHrLocalPassword } from "@/admin/lib/hr-auth-local";

export function MyAccount({ email, isAdmin }: { email: string; isAdmin: boolean }) {
  const addLog = useApp((s) => s.addLog);
  const [current, setCurrent] = useState("");
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const initials = email.slice(0, 2).toUpperCase();
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
            <p className="truncate font-semibold">{email}</p>
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
          if (!current) return setMsg({ ok: false, text: "Enter your current password." });
          if (pass.length < 8) return setMsg({ ok: false, text: "Password must be at least 8 characters." });
          if (pass !== confirm) return setMsg({ ok: false, text: "Passwords do not match." });
          setBusy(true);
          try {
            const localExists = hasHrLocalPassword(email);
            if (localExists) {
              const ok = await verifyHrLocalPassword(email, current);
              if (!ok) throw new Error("Current password is incorrect.");
            } else {
              // Verify current against Supabase by re-signing in
              const { error: signErr } = await supabase.auth.signInWithPassword({
                email: email.trim().toLowerCase(),
                password: current,
              });
              if (signErr) throw new Error("Current password is incorrect.");
            }

            const { error } = await supabase.auth.updateUser({ password: pass });
            if (error) {
              // Persist locally so change still works if cloud rejects
              await setHrLocalPassword(email, pass);
              addLog(email, "Changed password (local fallback)");
              setCurrent("");
              setPass("");
              setConfirm("");
              setMsg({ ok: true, text: "Password saved locally (cloud update unavailable)." });
            } else {
              await setHrLocalPassword(email, pass);
              addLog(email, "Changed password");
              setCurrent("");
              setPass("");
              setConfirm("");
              setMsg({ ok: true, text: "Password changed." });
            }
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
          <input type="password" className="field" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
        </label>
        <label className="block">
          <span className="lbl">New password</span>
          <input type="password" className="field" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="new-password" minLength={8} required />
        </label>
        <label className="block">
          <span className="lbl">Confirm new password</span>
          <input type="password" className="field" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" minLength={8} required />
        </label>
        {msg && <p className={`text-sm ${msg.ok ? "text-primary" : "text-destructive"}`}>{msg.text}</p>}
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "Saving…" : "Update password"}
        </button>
      </form>
    </div>
  );
}
