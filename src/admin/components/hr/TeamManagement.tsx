import { useState } from "react";
import { Trash2, UserPlus } from "lucide-react";
import { normalizeTeamMember, useApp } from "@/admin/lib/store";
import type { Role, TeamMember } from "@/admin/lib/types";

const asText = (v: unknown) => (v == null ? "" : typeof v === "string" ? v : String(v));

export function TeamManagement({ adminEmail }: { adminEmail: string }) {
  const teamRaw = useApp((s) => s.team);
  const team = (Array.isArray(teamRaw) ? teamRaw : [])
    .map((m) => normalizeTeamMember(m as Partial<TeamMember> & Pick<TeamMember, "id">))
    .filter((m) => !!m.id);
  const upsert = useApp((s) => s.upsertMember);
  const remove = useApp((s) => s.removeMember);
  const addLog = useApp((s) => s.addLog);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("standard");
  const [msg, setMsg] = useState("");
  return (
    <div className="space-y-5">
      <div>
        <p className="lbl">Team management</p>
        <h1 className="font-display text-3xl font-bold">User Accounts</h1>
        <p className="text-sm text-muted-foreground">
          Directory of Admin &amp; Attendance seats and roles. This list alone is not backend AuthZ.
        </p>
        <p className="mt-2 rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          Soft gate today: roles live in Admin <code>app_state.team</code>. Protected backend ACL is the
          review-only migration <code>admin-supabase/migrations/20261113180000_hr_portal_accounts.sql</code>{" "}
          (not applied). Driver Compliance / Dispatch invites use their own portal ACL + edge functions —
          never bridge Admin JWTs to Driver.
        </p>
      </div>
      <form
        className="panel grid gap-3 md:grid-cols-[1fr_1fr_160px_auto] md:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const display = String(fd.get("admin-team-name") ?? name).trim() || name.trim();
          const mail = (String(fd.get("admin-team-email") ?? email).trim() || email.trim()).toLowerCase();
          if (!display || !mail) return;
          const asMail = (v: unknown) =>
            (v == null ? "" : typeof v === "string" ? v : String(v)).trim().toLowerCase();
          if (team.some((m) => asMail(m.email) === mail) || mail === asMail(adminEmail)) {
            setMsg("An account with that email already exists.");
            return;
          }
          upsert({ id: Math.random().toString(36).slice(2, 10), name: display, email: mail, role, active: true });
          addLog(adminEmail, `Created account ${mail} (${role})`);
          setName("");
          setEmail("");
          setRole("standard");
          setMsg(`Added ${display}.`);
        }}
      >
        <label>
          <span className="lbl">Name</span>
          <input
            className="field"
            name="admin-team-name"
            data-testid="admin-team-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onInput={(e) => setName((e.target as HTMLInputElement).value)}
            required
          />
        </label>
        <label>
          <span className="lbl">Email</span>
          <input
            className="field"
            type="email"
            name="admin-team-email"
            data-testid="admin-team-email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
            required
          />
        </label>
        <label>
          <span className="lbl">Role</span>
          <select className="field" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="standard">Standard</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <button className="btn-primary">
          <UserPlus className="h-4 w-4" /> Add
        </button>
      </form>
      {msg && (
        <p role="status" className="text-sm text-muted-foreground">
          {msg}
        </p>
      )}
      <div className="panel overflow-x-auto p-0 md:p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Email</th>
              <th className="p-3">Role</th>
              <th className="p-3">Access</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-border">
              <td className="p-3 font-semibold">HR (owner)</td>
              <td className="p-3">{adminEmail}</td>
              <td className="p-3">
                <span className="chip bg-primary/10 text-primary">Admin</span>
              </td>
              <td className="p-3">
                <span className="chip bg-primary/10 text-primary">Active</span>
              </td>
              <td />
            </tr>
            {team.map((m) => (
              <tr key={m.id} className="border-t border-border">
                <td className="p-3 font-semibold">
                  <input
                    className="field h-8 max-w-[12rem] font-semibold"
                    aria-label={`Name for ${asText(m.email)}`}
                    defaultValue={asText(m.name)}
                    onBlur={(e) => {
                      const next = e.target.value.trim();
                      if (next && next !== asText(m.name)) {
                        upsert({ ...m, name: next });
                        addLog(adminEmail, `Renamed account ${asText(m.email)} to “${next}”`);
                        setMsg(`Updated name for ${asText(m.email)}.`);
                      }
                    }}
                  />
                </td>
                <td className="p-3">{asText(m.email)}</td>
                <td className="p-3">
                  <select
                    className="field h-8 w-32"
                    value={asText(m.role) === "admin" ? "admin" : "standard"}
                    onChange={(e) => {
                      const nextRole = e.target.value as Role;
                      upsert({ ...m, role: nextRole });
                      addLog(adminEmail, `Updated role for ${asText(m.email)} → ${nextRole}`);
                      setMsg(`Updated role for ${asText(m.email)}.`);
                    }}
                  >
                    <option value="standard">Standard</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td className="p-3">
                  <button
                    type="button"
                    className={`chip ${m.active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
                    onClick={() => {
                      const nextActive = !m.active;
                      upsert({ ...m, active: nextActive });
                      addLog(
                        adminEmail,
                        `${nextActive ? "Enabled" : "Disabled"} account ${asText(m.email)}`,
                      );
                      setMsg(
                        `${asText(m.email)} is now ${nextActive ? "active" : "disabled"}.`,
                      );
                    }}
                  >
                    {m.active ? "Active" : "Disabled"}
                  </button>
                </td>
                <td className="p-3 text-right">
                  <button
                    type="button"
                    className="btn-danger h-8 px-2"
                    title="Remove"
                    onClick={() => {
                      if (!confirm(`Remove ${asText(m.name)}?`)) return;
                      remove(m.id);
                      addLog(adminEmail, `Removed account ${asText(m.email)}`);
                      setMsg(`Removed ${asText(m.name)}.`);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
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
