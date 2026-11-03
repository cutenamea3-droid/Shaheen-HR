import { useRef } from "react";
import { Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/admin/lib/store";
import { fmtTime, parseTime } from "@/admin/lib/calc";
import { SectionTitle, TimeInput, Toggle } from "./common";

export function SettingsPanel() {
  const { depts, upsertDept, removeDept, settings, setSettings } = useApp();
  const num = (k: "grace" | "breakMin" | "breakLeeway" | "satTargetHours", label: string) => (
    <label><span className="lbl">{label}</span><input type="number" min={0} className="field" value={settings[k]} onChange={(e) => setSettings({ [k]: +e.target.value })} /></label>
  );
  return (
    <div className="space-y-8">
      <section>
        <SectionTitle title="Rules" sub="All times are machine (USA) time. Values feed existing calc — UI layout only here." />
        <div className="admin-emp-card grid gap-3 md:grid-cols-3">
          <label className="md:col-span-3"><span className="lbl">Company name (on PDFs)</span><input className="field" value={settings.company} onChange={(e) => setSettings({ company: e.target.value })} /></label>
          {num("grace", "Late grace (min)")}
          {num("breakMin", "Break allowed (min)")}
          {num("breakLeeway", "Break leeway (min)")}
          {num("satTargetHours", "Saturday target (hours)")}
          <div className="flex items-end pb-2"><Toggle checked={settings.overpay} onChange={(v) => setSettings({ overpay: v })} label="Over pay (overtime & additional days) on" /></div>
        </div>
      </section>
      <section>
        <SectionTitle
          title="Departments & shift times"
          right={<button type="button" className="btn-primary" onClick={() => upsertDept({ id: Math.random().toString(36).slice(2, 9), name: "New department", start: parseTime("9:00")!, end: parseTime("19:00")! })}>Add department</button>}
        />
        <div className="space-y-2">
          {depts.map((d) => (
            <div key={d.id} className="admin-emp-card grid gap-3 md:grid-cols-[1fr_160px_160px_auto] md:items-end">
              <label><span className="lbl">Name</span><input className="field" value={d.name} onChange={(e) => upsertDept({ ...d, name: e.target.value })} /></label>
              <TimeInput label="Shift start" value={d.start} onChange={(v) => v != null && upsertDept({ ...d, start: v })} />
              <TimeInput label="Shift end" value={d.end} onChange={(v) => v != null && upsertDept({ ...d, end: v })} />
              <button type="button" className="btn-danger" onClick={() => confirm(`Delete ${d.name}?`) && removeDept(d.id)}>Delete</button>
              <p className="text-xs text-muted-foreground md:col-span-4">{fmtTime(d.start)} – {fmtTime(d.end)}</p>
            </div>
          ))}
        </div>
      </section>
      <BackupSection />
    </div>
  );
}

const BACKUP_KEYS = ["depts", "employees", "records", "perf", "tasks", "settings", "team", "logs"] as const;

export function downloadBackup() {
  const s = useApp.getState();
  const data = Object.fromEntries(BACKUP_KEYS.map((k) => [k, s[k]]));
  const blob = new Blob([JSON.stringify({ app: "hr-attendance", version: 1, exportedAt: new Date().toISOString(), data }, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `attendance-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export async function restoreBackup(file: File) {
  try {
    const parsed = JSON.parse(await file.text());
    const data = parsed?.app === "hr-attendance" ? parsed.data : null;
    if (!data || !Array.isArray(data.employees) || !Array.isArray(data.depts)) {
      toast.error("That file is not an Attendance backup");
      return;
    }
    if (!confirm("Restore this backup? It will REPLACE all current attendance data on this dashboard. Download a backup of the current data first if you need it.")) return;
    const next = Object.fromEntries(BACKUP_KEYS.filter((k) => data[k] !== undefined).map((k) => [k, data[k]]));
    useApp.setState(next as never);
    toast.success("Backup restored — saving to cloud");
  } catch {
    toast.error("Could not read this file");
  }
}

/** One-click Backup / Restore buttons for the top bar, same behaviour as the Driver dashboard. */
export function BackupButtons() {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-2">
      <button type="button" className="btn h-9 px-3 text-sm text-sidebar-foreground hover:bg-sidebar-accent" title="Download all attendance data as a file" onClick={downloadBackup}>
        <Download className="size-4" /> Backup
      </button>
      <button type="button" className="btn h-9 px-3 text-sm text-sidebar-foreground hover:bg-sidebar-accent" title="Load a backup file into this dashboard" onClick={() => fileRef.current?.click()}>
        <Upload className="size-4" /> Restore
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void restoreBackup(f); }}
      />
    </div>
  );
}

function BackupSection() {
  return (
    <section>
      <SectionTitle title="Backup & restore" sub="Download all attendance data as a file, or load a backup file into this dashboard. The same buttons are also in the top bar." />
      <div className="panel flex flex-wrap items-center gap-3">
        <button className="btn-primary" onClick={downloadBackup}>Download backup</button>
        <label className="btn-danger cursor-pointer">
          Restore from backup
          <input type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void restoreBackup(f); }} />
        </label>
        <p className="w-full text-xs text-muted-foreground">Includes departments, employees, attendance, performance, tasks, settings, user accounts list and activity logs.</p>
      </div>
    </section>
  );
}
