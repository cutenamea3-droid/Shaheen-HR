import { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { listPortalActivity } from "@/lib/cloud";
import { listLocalActivity } from "@/lib/portal-local";

type ActivityEntry = {
  id: string | number;
  actor_name: string;
  action: string;
  section_id: string;
  occurred_at: string;
};

export function ActivityLogs() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void listPortalActivity()
      .then((items) => {
        if (active) {
          setEntries(items);
          setError("");
        }
      })
      .catch((e: unknown) => {
        if (!active) return;
        // Tables missing / not signed into cloud yet → show local cache, not a hard failure.
        const local = listLocalActivity(500);
        setEntries(local);
        const msg = e instanceof Error ? e.message : "Could not load activity logs.";
        if (/does not exist|not find the table|PGRST205|42P01/i.test(msg)) {
          setError("Cloud activity table is not set up yet — showing local cache. Paste the Driver SQL migration in Supabase.");
        } else {
          setError(msg);
        }
      });
    return () => { active = false; };
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Activity / system logs</p>
        <h2 className="font-display text-3xl font-bold">Activity Logs</h2>
        <p className="text-sm text-muted-foreground">Timestamped records of changes saved to compliance sections.</p>
      </div>
      {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}
      <div className="rounded-2xl border border-border bg-card shadow-card">
        {entries.length === 0 && !error && <p className="p-6 text-center text-sm text-muted-foreground">No compliance edits have been logged.</p>}
        {entries.map((entry) => (
          <div key={entry.id} className="flex items-start gap-3 border-b border-border p-4 last:border-0">
            <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand text-primary-foreground"><Activity className="size-4" /></div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{entry.action} · {entry.section_id}</p>
              <p className="text-xs text-muted-foreground">{entry.actor_name}</p>
            </div>
            <time className="shrink-0 text-xs text-muted-foreground" dateTime={entry.occurred_at}>{new Date(entry.occurred_at).toLocaleString()}</time>
          </div>
        ))}
      </div>
    </div>
  );
}
