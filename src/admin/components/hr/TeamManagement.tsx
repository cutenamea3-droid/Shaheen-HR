import { useState } from "react";
import { Trash2, UserPlus } from "lucide-react";
import { useApp } from "@/admin/lib/store";
import type { Role } from "@/admin/lib/types";

export function TeamManagement({ adminEmail }: { adminEmail: string }) {
  const team = useApp((s) => s.team);
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
        <p className="text-sm text-muted-foreground">Keep a record of who has access and what role they hold.</p>
      </div>
      <form
        className="panel grid gap-3 md:grid-cols-[1fr_1fr_160px_auto] md:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim() || !email.trim()) return;
          const display = name.trim();
          const mail = email.trim().toLowerCase();
          if (team.some((m) => m.email === mail) || mail === adminEmail.toLowerCase()) {
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
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          <span className="lbl">Email</span>
          <input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
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
                    aria-label={`Name for ${m.email}`}
                    defaultValue={m.name}
                    onBlur={(e) => {
                      const next = e.target.value.trim();
                      if (next && next !== m.name) {
                        upsert({ ...m, name: next });
                        addLog(adminEmail, `Renamed account ${m.email} to “${next}”`);
                        setMsg(`Updated name for ${m.email}.`);
                      }
                    }}
                  />
                </td>
                <td className="p-3">{m.email}</td>
                <td className="p-3">
                  <select
                    className="field h-8 w-32"
                    value={m.role}
                    onChange={(e) => {
                      const nextRole = e.target.value as Role;
                      upsert({ ...m, role: nextRole });
                      addLog(adminEmail, `Updated role for ${m.email} → ${nextRole}`);
                      setMsg(`Updated role for ${m.email}.`);
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
                      addLog(adminEmail, `${nextActive ? "Enabled" : "Disabled"} account ${m.email}`);
                      setMsg(`${m.email} is now ${nextActive ? "active" : "disabled"}.`);
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
                      if (!confirm(`Remove ${m.name}?`)) return;
                      remove(m.id);
                      addLog(adminEmail, `Removed account ${m.email}`);
                      setMsg(`Removed ${m.name}.`);
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
