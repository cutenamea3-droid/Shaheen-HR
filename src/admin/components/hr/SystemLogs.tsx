import { useState } from "react";
import { Activity } from "lucide-react";
import { useApp } from "@/admin/lib/store";

export function SystemLogs() {
  const logs = useApp((s) => s.logs);
  const [q, setQ] = useState("");
  const shown = logs.filter((l) => `${l.who} ${l.action}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="lbl">System logs</p>
          <h1 className="font-display text-3xl font-bold">Activity Logs</h1>
          <p className="text-sm text-muted-foreground">Every change made in this dashboard, newest first.</p>
        </div>
        <input className="field max-w-xs" placeholder="Search activity…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="panel space-y-0 p-0 md:p-0">
        {shown.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No activity yet.</p>}
        {shown.map((l) => (
          <div key={l.id} className="flex items-start gap-3 border-b border-border p-4 last:border-0">
            <div className="brand-gradient mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-primary-foreground"><Activity className="h-4 w-4" /></div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{l.action}{l.count && l.count > 1 ? <span className="ml-2 chip bg-muted text-muted-foreground">×{l.count}</span> : null}</p>
              <p className="text-xs text-muted-foreground">{l.who}</p>
            </div>
            <time className="shrink-0 text-xs text-muted-foreground">{new Date(l.at).toLocaleString()}</time>
          </div>
        ))}
      </div>
    </div>
  );
}
