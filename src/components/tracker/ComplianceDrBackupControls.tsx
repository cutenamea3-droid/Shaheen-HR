/**
 * Complete Backup / Backup Now / status / coverage / Restore from Complete Backup.
 * Admin-only. Preserves existing theme tokens — no dashboard redesign.
 */
import { useRef, useState } from "react";
import {
  Archive,
  Download,
  Loader2,
  Shield,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import {
  buildCompleteArchive,
  coverageLabel,
  enableLocalDailyReminder,
  loadArchiveFromBytes,
  offSiteApprovalStop,
  readDrUiStatus,
  readScheduleStatus,
  recordBackupAttempt,
  restoreCompleteArchive,
  writeDrUiStatus,
  type DrRestoreReport,
  type DrVerificationStatus,
} from "@/lib/compliance-dr";
import { exportBackup, backupCoverageSummary } from "@/lib/store";
import { usePortalAccount } from "./LockGate";

function downloadBlob(blob: Blob, filename: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
}

function reportToast(report: DrRestoreReport) {
  const title =
    report.mode === "isolated-test"
      ? report.isolatedOk
        ? "Isolated restore test passed"
        : "Isolated restore test failed"
      : report.mode === "dry-run"
        ? "Restore dry-run"
        : report.applied.length
          ? "Restore applied (safe)"
          : "Restore blocked";
  const desc = [
    report.verification,
    report.notes[0],
    report.conflicts[0] ? `Conflict: ${report.conflicts[0].detail}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  if (report.mode === "isolated-test" && !report.isolatedOk) toast.error(title, { description: desc });
  else toast.success(title, { description: desc });
}

export function ComplianceDrBackupControls({ className = "" }: { className?: string }) {
  const { account } = usePortalAccount();
  const isAdmin = account.role === "admin";
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [status, setStatus] = useState(readDrUiStatus);
  const [schedule, setSchedule] = useState(readScheduleStatus);

  if (!isAdmin) return null;

  const btn =
    "inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm text-sidebar-foreground hover:bg-sidebar-accent disabled:opacity-50";

  async function runCompleteBackup(encrypt: boolean) {
    if (busy) return;
    if (encrypt && passphrase.trim().length < 8) {
      toast.error("Passphrase must be at least 8 characters for encrypted Complete Backup");
      return;
    }
    setBusy(true);
    try {
      const result = await buildCompleteArchive({
        actorEmail: account.email,
        ...(encrypt ? { passphrase } : {}),
      });
      downloadBlob(result.blob, result.filename);
      const next = writeDrUiStatus({
        lastBackupAt: new Date().toISOString(),
        lastFilename: result.filename,
        lastVerification: result.verification,
        lastGaps: result.gaps,
        lastCounts: result.manifest.counts,
        lastEncryption: encrypt ? "aes-256-gcm" : "none",
      });
      setStatus(next);
      setSchedule(recordBackupAttempt(result.verification, result.verification === "VERIFIED COMPLETE"));
      const gapHint =
        result.gaps.length > 0
          ? result.gaps
              .slice(0, 3)
              .map((g) => g.reason)
              .join("; ")
          : "all required sources";
      toast.success(`Complete Backup — ${result.verification}`, {
        description: `${result.filename} · ${gapHint}`,
      });
    } catch (e) {
      toast.error("Complete Backup failed", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setBusy(false);
    }
  }

  async function onRestoreFile(file: File) {
    setBusy(true);
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      const needsPass = file.name.includes("encrypted") || passphrase.trim().length > 0;
      const loaded = await loadArchiveFromBytes(buf, needsPass ? passphrase || undefined : undefined);
      // Always dry-run first
      const dry = await restoreCompleteArchive(loaded.files, "dry-run");
      reportToast(dry);
      const isolated = await restoreCompleteArchive(loaded.files, "isolated-test");
      reportToast(isolated);
      if (!isolated.isolatedOk) {
        toast.error("Restore stopped — isolated test did not pass");
        return;
      }
      if (
        !confirm(
          "Isolated restore test passed.\n\nApply SAFE restore to this browser?\n\n• Will not overwrite if local data looks newer\n• Secure drug/rate/portal ACL are report-only\n• Download a Complete Backup first if unsure",
        )
      ) {
        return;
      }
      const applied = await restoreCompleteArchive(loaded.files, "apply-safe");
      reportToast(applied);
    } catch (e) {
      toast.error("Restore from Complete Backup failed", {
        description: e instanceof Error ? e.message : "Invalid archive",
      });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const verification = status.lastVerification as DrVerificationStatus | null;

  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`}>
      <button
        type="button"
        className={btn}
        disabled={busy}
        title="Quick JSON backup (tracker + mock drug when present)"
        onClick={() => {
          const json = exportBackup();
          downloadBlob(new Blob([json], { type: "application/json" }), `shaheen-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`);
          toast.success("Backup Now downloaded", { description: backupCoverageSummary(json) });
        }}
      >
        <Download className="size-4" /> Backup Now
      </button>
      <button
        type="button"
        className={btn}
        disabled={busy}
        title="One-click portable Complete Backup archive (ZIP)"
        onClick={() => void runCompleteBackup(false)}
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Archive className="size-4" />} Complete Backup
      </button>
      <button
        type="button"
        className={btn}
        disabled={busy}
        title="Restore from Complete Backup (dry-run → isolated test → apply-safe)"
        onClick={() => fileRef.current?.click()}
      >
        <Upload className="size-4" /> Restore Complete
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".zip,application/zip,application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onRestoreFile(f);
        }}
      />
      <button
        type="button"
        className={btn}
        title="Backup status, coverage, encryption, daily reminder"
        onClick={() => setPanelOpen((v) => !v)}
      >
        <Shield className="size-4" /> DR Status
      </button>

      {panelOpen && (
        <div className="absolute right-3 top-14 z-40 w-[min(28rem,calc(100vw-1.5rem))] rounded-lg border bg-card p-4 text-sm shadow-lg">
          <p className="font-semibold text-foreground">Compliance DR status</p>
          <p className="mt-1 text-muted-foreground">{coverageLabel(verification, status.lastGaps)}</p>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            <li>Last: {status.lastBackupAt ? new Date(status.lastBackupAt).toLocaleString() : "—"}</li>
            <li>File: {status.lastFilename ?? "—"}</li>
            <li>
              Encryption: {status.lastEncryption ?? "—"}
              {status.lastEncryption === "none" ? " (set passphrase below for AES-GCM)" : ""}
            </li>
            <li>
              Counts: drivers {status.lastCounts.drivers ?? "—"} · drugs {status.lastCounts.drugEvents ?? "—"} ·
              rates {status.lastCounts.rateCards ?? "—"}
            </li>
            <li>
              Daily reminder: {schedule.enabled ? "on" : "off"}
              {schedule.lastSuccessAt ? ` · last success ${new Date(schedule.lastSuccessAt).toLocaleDateString()}` : ""}
            </li>
          </ul>
          {status.lastGaps.length > 0 && (
            <div className="mt-2 max-h-28 overflow-auto rounded border bg-muted/40 p-2 text-xs">
              {status.lastGaps.map((g, i) => (
                <p key={`${g.sourceId}-${i}`}>
                  <span className="font-medium">{g.sourceId}</span>: {g.reason}
                  {g.detail ? ` — ${g.detail}` : ""}
                </p>
              ))}
            </div>
          )}
          <label className="mt-3 block text-xs text-muted-foreground">
            Encryption passphrase (optional, admin-only AES-256-GCM)
            <input
              type="password"
              className="mt-1 w-full rounded border bg-background px-2 py-1.5 text-sm text-foreground"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Min 8 characters"
              autoComplete="new-password"
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-md border px-2 py-1 text-xs hover:bg-muted"
              disabled={busy}
              onClick={() => void runCompleteBackup(true)}
            >
              Encrypted Complete Backup
            </button>
            <button
              type="button"
              className="rounded-md border px-2 py-1 text-xs hover:bg-muted"
              onClick={() => {
                setSchedule(enableLocalDailyReminder());
                toast.message("Local daily reminder enabled", {
                  description: "Does not upload off-site. Approvals still required for scheduled off-site archives.",
                });
              }}
            >
              Enable daily reminder
            </button>
            <button
              type="button"
              className="rounded-md border px-2 py-1 text-xs hover:bg-muted"
              onClick={() => {
                const stop = offSiteApprovalStop();
                toast.message("Off-site scheduler stopped — approvals needed", {
                  description: stop.approvalsNeeded.slice(0, 2).join(" · "),
                });
              }}
            >
              Off-site status
            </button>
            <button
              type="button"
              className="rounded-md border px-2 py-1 text-xs hover:bg-muted"
              onClick={() => setPanelOpen(false)}
            >
              Close
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Off-site: not configured. {schedule.offSiteBlockedReason}
          </p>
        </div>
      )}
    </div>
  );
}
