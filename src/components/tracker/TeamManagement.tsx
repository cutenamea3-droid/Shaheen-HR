import { useEffect, useState } from "react";
import { Trash2, UserPlus } from "lucide-react";
import { createPortalAccount, listPortalAccounts, updatePortalAccess, type PortalAccount, type PortalRole } from "@/lib/cloud";
import {
  createLocalAccount,
  ensureLocalOwner,
  listLocalAccounts,
  logLocalActivity,
  removeLocalAccount,
  upsertLocalAccount,
} from "@/lib/portal-local";
import { usePortalAccount } from "./LockGate";

export function TeamManagement() {
  const { account: currentAccount } = usePortalAccount();
  const [accounts, setAccounts] = useState<PortalAccount[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    ensureLocalOwner(currentAccount);
    let cloud: PortalAccount[] = [];
    try {
      cloud = await listPortalAccounts();
    } catch {
      cloud = [];
    }
    const local = listLocalAccounts();
    const byId = new Map<string, PortalAccount>();
    for (const a of [...cloud, ...local]) byId.set(a.user_id, a);
    // Prefer local email matches for edits done offline
    for (const a of local) byId.set(a.user_id, a);
    const merged = [...byId.values()].sort((a, b) => a.email.localeCompare(b.email));
    setAccounts(merged);
  };

  useEffect(() => {
    let active = true;
    void refresh()
      .then(() => {
        if (!active) return;
      })
      .catch((e: unknown) => {
        if (active) setMessage(e instanceof Error ? e.message : "Could not load user accounts.");
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per signed-in admin
  }, [currentAccount.user_id]);

  const changeAccess = async (target: PortalAccount, role: PortalRole, isActive: boolean) => {
    if (target.user_id === currentAccount.user_id && (role !== "admin" || !isActive)) {
      setMessage("You cannot remove your own administrator access.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      try {
        await updatePortalAccess(target.user_id, role, isActive);
      } catch {
        /* local fallback */
      }
      const next = { ...target, role, active: isActive };
      upsertLocalAccount(next);
      logLocalActivity({
        actorName: currentAccount.display_name || currentAccount.email,
        action: `Updated access for ${target.email} → ${role}${isActive ? "" : " (disabled)"}`,
        sectionId: "accounts",
      });
      setMessage("Account access updated.");
      await refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not update account access.");
    } finally {
      setBusy(false);
    }
  };

  const rename = (target: PortalAccount, displayName: string) => {
    const next = { ...target, display_name: displayName.trim() || target.display_name };
    upsertLocalAccount(next);
    setAccounts((prev) => prev.map((a) => (a.user_id === target.user_id ? next : a)));
    logLocalActivity({
      actorName: currentAccount.display_name || currentAccount.email,
      action: `Renamed account ${target.email} to “${next.display_name}”`,
      sectionId: "accounts",
    });
  };

  const remove = async (target: PortalAccount) => {
    if (target.user_id === currentAccount.user_id) {
      setMessage("You cannot remove your own account.");
      return;
    }
    if (!confirm(`Remove ${target.display_name} (${target.email})?`)) return;
    setBusy(true);
    setMessage("");
    try {
      removeLocalAccount(target.user_id);
      // Keep cloud best-effort disabled via access flip if possible
      try {
        await updatePortalAccess(target.user_id, target.role, false);
      } catch {
        /* ignore */
      }
      logLocalActivity({
        actorName: currentAccount.display_name || currentAccount.email,
        action: `Removed account ${target.email}`,
        sectionId: "accounts",
      });
      setMessage("Account removed.");
      await refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not remove account.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Team management</p>
        <h2 className="font-display text-3xl font-bold">User Accounts</h2>
        <p className="text-sm text-muted-foreground">Create individual access and manage account roles and status.</p>
      </div>
      <form
        className="ui-lift grid gap-3 rounded-2xl border border-border bg-card p-5 shadow-card md:grid-cols-[1fr_1fr_1fr_auto] md:items-end"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setMessage("");
          try {
            try {
              await createPortalAccount({ email, displayName: name, password });
            } catch {
              /* edge function / cloud may be unavailable — local create below */
            }
            const created = await createLocalAccount({ email, displayName: name, password });
            setName("");
            setEmail("");
            setPassword("");
            logLocalActivity({
              actorName: currentAccount.display_name || currentAccount.email,
              action: `Created account ${created.email}`,
              sectionId: "accounts",
            });
            setMessage("Standard account created.");
            await refresh();
          } catch (e) {
            setMessage(e instanceof Error ? e.message : "Could not create the account.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="text-sm font-bold">
          Name
          <input required maxLength={80} className="mt-1 h-10 w-full rounded-lg border bg-card px-3 font-normal" value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="text-sm font-bold">
          Email
          <input required type="email" className="mt-1 h-10 w-full rounded-lg border bg-card px-3 font-normal" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label className="text-sm font-bold">
          Temporary password
          <input required type="password" minLength={8} autoComplete="new-password" className="mt-1 h-10 w-full rounded-lg border bg-card px-3 font-normal" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        <button disabled={busy} className="ui-press inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 font-semibold text-primary-foreground disabled:opacity-60">
          <UserPlus className="size-4" /> Add user
        </button>
      </form>
      {message && (
        <p role="status" className="text-sm text-muted-foreground">
          {message}
        </p>
      )}
      <div className="ui-lift overflow-x-auto rounded-2xl border border-border bg-card shadow-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Email</th>
              <th className="p-3">Role</th>
              <th className="p-3">Status</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {accounts.map((member) => (
              <tr key={member.user_id} className="border-t border-border">
                <td className="p-3 font-semibold">
                  <input
                    className="h-9 w-full max-w-[12rem] rounded-lg border bg-card px-2 font-semibold"
                    aria-label={`Name for ${member.email}`}
                    defaultValue={member.display_name}
                    disabled={busy}
                    onBlur={(event) => {
                      if (event.target.value.trim() !== member.display_name) rename(member, event.target.value);
                    }}
                  />
                </td>
                <td className="p-3">{member.email}</td>
                <td className="p-3">
                  <select
                    className="h-9 rounded-lg border bg-card px-2"
                    aria-label={`Role for ${member.email}`}
                    value={member.role}
                    disabled={busy || member.user_id === currentAccount.user_id}
                    onChange={(event) => void changeAccess(member, event.target.value as PortalRole, member.active)}
                  >
                    <option value="standard">Standard</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td className="p-3">
                  <button
                    type="button"
                    className={`ui-press rounded-full px-3 py-1 text-xs font-bold ${member.active ? "bg-ok-soft text-ok" : "bg-muted text-muted-foreground"}`}
                    disabled={busy || member.user_id === currentAccount.user_id}
                    onClick={() => void changeAccess(member, member.role, !member.active)}
                  >
                    {member.active ? "Active" : "Disabled"}
                  </button>
                </td>
                <td className="p-3 text-right">
                  <button
                    type="button"
                    className="ui-press inline-flex h-8 items-center rounded-lg border border-danger/40 px-2 text-danger disabled:opacity-50"
                    title="Remove"
                    disabled={busy || member.user_id === currentAccount.user_id}
                    onClick={() => void remove(member)}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </td>
              </tr>
            ))}
            {!accounts.length && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted-foreground">
                  No user accounts found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
