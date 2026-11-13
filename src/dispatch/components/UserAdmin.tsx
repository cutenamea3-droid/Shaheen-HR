import { useEffect, useState } from "react";
import {
  inviteDispatchUser,
  listDispatchAccounts,
  setDispatchAccess,
} from "@/dispatch/lib/auth";
import type { DispatchAccount, DispatchRole } from "@/dispatch/lib/types";

export function UserAdmin({ actor }: { actor: DispatchAccount }) {
  const [accounts, setAccounts] = useState<DispatchAccount[]>([]);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<DispatchRole>("dispatcher");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setAccounts(await listDispatchAccounts());
  };

  useEffect(() => {
    void refresh().catch((e: unknown) => setMsg(e instanceof Error ? e.message : "Could not load accounts."));
  }, []);

  if (actor.role !== "admin") {
    return (
      <p className="text-sm text-[color:var(--dispatch-muted)]">
        Only Dispatch administrators can invite or change dispatcher access.
      </p>
    );
  }

  return (
    <div className="dispatch-panel space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-[color:var(--dispatch-navy)]">Dispatch users</h2>
        <p className="text-sm text-[color:var(--dispatch-muted)]">
          Invite uses the protected <code>create-dispatch-user</code> edge function (service role on server).
          Review-only until approved. Passwords are never logged.
        </p>
      </div>
      <form
        className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_140px_auto] md:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          setBusy(true);
          setMsg("");
          void inviteDispatchUser({ email, displayName, password, role })
            .then(async () => {
              setEmail("");
              setDisplayName("");
              setPassword("");
              setRole("dispatcher");
              setMsg("Invite sent / account created.");
              await refresh();
            })
            .catch((err: unknown) => setMsg(err instanceof Error ? err.message : "Invite failed."))
            .finally(() => setBusy(false));
        }}
      >
        <label className="grid gap-1 text-sm">
          <span>Name</span>
          <input className="dispatch-field" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
        </label>
        <label className="grid gap-1 text-sm">
          <span>Email</span>
          <input className="dispatch-field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="grid gap-1 text-sm">
          <span>Temp password</span>
          <input
            className="dispatch-field"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span>Role</span>
          <select className="dispatch-field" value={role} onChange={(e) => setRole(e.target.value as DispatchRole)}>
            <option value="dispatcher">Dispatcher</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <button type="submit" className="dispatch-btn-primary" disabled={busy}>
          Invite
        </button>
      </form>
      {msg && (
        <p role="status" className="text-sm text-[color:var(--dispatch-muted)]">
          {msg}
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="dispatch-table w-full text-sm">
          <thead>
            <tr>
              <th className="p-2 text-left">Name</th>
              <th className="p-2 text-left">Email</th>
              <th className="p-2 text-left">Role</th>
              <th className="p-2 text-left">Access</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.user_id} className="border-t border-[color:var(--dispatch-border)]">
                <td className="p-2 font-medium">{a.display_name}</td>
                <td className="p-2">{a.email}</td>
                <td className="p-2">
                  <select
                    className="dispatch-field h-8 w-36"
                    value={a.role}
                    disabled={busy}
                    onChange={(e) => {
                      const next = e.target.value as DispatchRole;
                      setBusy(true);
                      void setDispatchAccess(a.user_id, next, a.active)
                        .then(refresh)
                        .catch((err: unknown) => setMsg(err instanceof Error ? err.message : "Update failed."))
                        .finally(() => setBusy(false));
                    }}
                  >
                    <option value="dispatcher">Dispatcher</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td className="p-2">
                  <button
                    type="button"
                    className="dispatch-btn-ghost"
                    disabled={busy}
                    onClick={() => {
                      setBusy(true);
                      void setDispatchAccess(a.user_id, a.role, !a.active)
                        .then(refresh)
                        .catch((err: unknown) => setMsg(err instanceof Error ? err.message : "Update failed."))
                        .finally(() => setBusy(false));
                    }}
                  >
                    {a.active ? "Active" : "Disabled"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
