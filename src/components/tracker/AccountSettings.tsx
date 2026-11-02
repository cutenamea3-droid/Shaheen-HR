import { useState } from "react";
import { KeyRound, ShieldCheck, UserRound } from "lucide-react";
import { PORTAL_EMAIL, updatePortalPassword } from "@/lib/cloud";
import {
  ensureLocalOwner,
  hasLocalPassword,
  logLocalActivity,
  setLocalPassword,
  upsertLocalAccount,
  verifyLocalPassword,
} from "@/lib/portal-local";
import { usePortalAccount } from "./LockGate";

export function AccountSettings() {
  const { account, updateDisplayName } = usePortalAccount();
  const [name, setName] = useState(account.display_name);
  const [displayMessage, setDisplayMessage] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordOk, setPasswordOk] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Profile &amp; security</p>
        <h2 className="font-display text-3xl font-bold">My Account</h2>
        <p className="text-sm text-muted-foreground">Manage your Driver Compliance profile and password.</p>
      </div>
      <form
        className="ui-lift rounded-2xl border border-border bg-card p-5 shadow-card"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setDisplayMessage("");
          try {
            try {
              await updateDisplayName(name);
            } catch {
              /* cloud profile RPC may be unavailable — keep local */
            }
            ensureLocalOwner(account);
            upsertLocalAccount({ ...account, display_name: name.trim() });
            logLocalActivity({
              actorName: name.trim() || account.email,
              action: "Updated display name",
              sectionId: "account",
            });
            setDisplayMessage("Display name updated.");
          } catch (e) {
            setDisplayMessage(e instanceof Error ? e.message : "Could not update the display name.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-brand text-primary-foreground">
            <UserRound className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{account.email}</p>
            <p className="text-xs text-muted-foreground">Signed in · {account.role === "admin" ? "Admin" : "Standard"}</p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-ok-soft px-2.5 py-1 text-xs font-semibold text-ok">
            <ShieldCheck className="size-3" /> Active
          </span>
        </div>
        <label className="block text-sm font-bold" htmlFor="account-display-name">
          Display name
        </label>
        <input
          id="account-display-name"
          required
          maxLength={80}
          className="mt-1 h-11 w-full rounded-xl border bg-card px-3"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        {displayMessage && (
          <p role="status" className="mt-2 text-sm text-muted-foreground">
            {displayMessage}
          </p>
        )}
        <button className="ui-press mt-4 rounded-lg bg-brand px-4 py-2 font-semibold text-primary-foreground disabled:opacity-60" disabled={busy}>
          {busy ? "Saving…" : "Save profile"}
        </button>
      </form>

      <form
        className="ui-lift space-y-4 rounded-2xl border border-border bg-card p-5 shadow-card"
        onSubmit={async (event) => {
          event.preventDefault();
          setPasswordMessage("");
          setPasswordOk(false);
          if (!currentPassword) return setPasswordMessage("Enter your current password.");
          if (password.length < 8) return setPasswordMessage("Password must be at least 8 characters.");
          if (password !== confirmPassword) return setPasswordMessage("Passwords do not match.");
          setBusy(true);
          try {
            ensureLocalOwner(account);
            const localExists = hasLocalPassword(account.user_id);
            if (localExists) {
              const ok = await verifyLocalPassword(account.user_id, currentPassword);
              if (!ok) throw new Error("Current password is incorrect.");
            }
            // Prefer Supabase when session supports it
            let cloudOk = false;
            try {
              await updatePortalPassword(password, account.email.toLowerCase() === PORTAL_EMAIL);
              cloudOk = true;
            } catch (e) {
              if (!localExists) {
                // First local password set: allow without prior hash only when cloud also failed
                // and user typed something as "current" — still require they filled the field.
                // If no local hash yet, accept setting a new local password after cloud failure.
              } else {
                throw e instanceof Error ? e : new Error("Could not update the password.");
              }
            }
            await setLocalPassword(account.user_id, password);
            logLocalActivity({
              actorName: account.display_name || account.email,
              action: cloudOk ? "Changed password (cloud + local)" : "Changed password (local)",
              sectionId: "account",
            });
            setCurrentPassword("");
            setPassword("");
            setConfirmPassword("");
            setPasswordOk(true);
            setPasswordMessage("Password changed.");
          } catch (e) {
            setPasswordMessage(e instanceof Error ? e.message : "Could not update the password.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <h3 className="flex items-center gap-2 font-display text-lg font-bold">
          <KeyRound className="size-5 text-primary" /> Change password
        </h3>
        <label className="block text-sm font-bold" htmlFor="current-password">
          Current password
        </label>
        <input
          id="current-password"
          type="password"
          autoComplete="current-password"
          required
          className="h-11 w-full rounded-xl border bg-card px-3"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
        />
        <label className="block text-sm font-bold" htmlFor="new-password">
          New password
        </label>
        <input
          id="new-password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className="h-11 w-full rounded-xl border bg-card px-3"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <label className="block text-sm font-bold" htmlFor="confirm-password">
          Confirm new password
        </label>
        <input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className="h-11 w-full rounded-xl border bg-card px-3"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
        />
        {passwordMessage && (
          <p role="status" className={`text-sm font-semibold ${passwordOk ? "text-ok" : "text-danger"}`}>
            {passwordMessage}
          </p>
        )}
        <button className="ui-press w-full rounded-lg bg-brand px-4 py-2 font-semibold text-primary-foreground disabled:opacity-60" disabled={busy}>
          {busy ? "Saving…" : "Update password"}
        </button>
      </form>
    </div>
  );
}
