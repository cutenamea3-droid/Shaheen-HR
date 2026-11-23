/**
 * Complete Backup / Backup Now / status / coverage / Restore from Complete Backup.
 * Admin-only. Header-toolbar contrast (card bg) — not sidebar tokens.
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
import { cn } from "@/lib/utils";
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

/**
 * Header-toolbar chrome — high contrast on card surfaces (light + dark).
 * Icons inherit label color via text-current (never muted / 50% opacity at rest).
 */
const toolbarBtnBase =
  "ui-press inline-flex h-9 items-center gap-1.5 rounded-lg border-2 px-3 text-sm font-bold shadow-card transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-55 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-current [&_svg]:opacity-100";

/** Secondary: near-black label + solid ink border on white/card (not washed grey). */
const toolbarBtnSecondary =
  `${toolbarBtnBase} border-ink bg-card text-foreground hover:border-primary hover:bg-accent hover:text-foreground`;

/** Backup Now: solid brand fill + light text for WCAG AA contrast on the fill. */
const toolbarBtnPrimary =
  `${toolbarBtnBase} border-primary bg-brand text-primary-foreground hover:brightness-105`;

const panelBtn =
  "ui-press inline-flex items-center gap-1 rounded-md border-2 border-ink bg-card px-2 py-1 text-xs font-semibold text-foreground hover:border-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-55 [&_svg]:text-current [&_svg]:opacity-100";

type BusyKind = "backup-now" | "complete" | "restore" | null;

function busyReason(kind: BusyKind): string | null {
  if (kind === "backup-now") return "Backup Now in progress…";
  if (kind === "complete") return "Complete Backup in progress…";
  if (kind === "restore") return "Restore preview / safe apply in progress…";
  return null;
}

export function ComplianceDrBackupControls({ className = "" }: { className?: string }) {
  const { account } = usePortalAccount();
  const isAdmin = account.role === "admin";
  const fileRef = useRef<HTMLInputElement>(null);
  const [busyKind, setBusyKind] = useState<BusyKind>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [status, setStatus] = useState(readDrUiStatus);
  const [schedule, setSchedule] = useState(readScheduleStatus);

  if (!isAdmin) return null;

  const busy = busyKind !== null;
  const reason = busyReason(busyKind);
  const disabledTitle = reason ?? undefined;

  async function runCompleteBackup(encrypt: boolean) {
    if (busy) return;
    if (encrypt && passphrase.trim().length < 8) {
      toast.error("Passphrase must be at least 8 characters for encrypted Complete Backup");
      return;
    }
    setBusyKind("complete");
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
      setBusyKind(null);
    }
  }

  async function onRestoreFile(file: File) {
    setBusyKind("restore");
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      const needsPass = file.name.includes("encrypted") || passphrase.trim().length > 0;
      const loaded = await loadArchiveFromBytes(buf, needsPass ? passphrase || undefined : undefined);
      // Always dry-run first — never silent Prod overwrite
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
        toast.message("Restore apply cancelled — dry-run and isolated test already reported");
        return;
      }
      const applied = await restoreCompleteArchive(loaded.files, "apply-safe");
      reportToast(applied);
    } catch (e) {
      toast.error("Restore from Complete Backup failed", {
        description: e instanceof Error ? e.message : "Invalid archive",
      });
    } finally {
      setBusyKind(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const verification = status.lastVerification as DrVerificationStatus | null;
  const offSiteStop = offSiteApprovalStop();
  const encryptReady = passphrase.trim().length >= 8;
  const encryptDisabledReason = busy
    ? reason
    : !encryptReady
      ? "Enter a passphrase of at least 8 characters for encrypted Complete Backup"
      : null;

  return (
    <div
      className={cn("relative flex max-w-full flex-wrap items-center gap-1.5", className)}
      data-compliance-dr-toolbar
      aria-busy={busy}
    >
      <button
        type="button"
        className={toolbarBtnPrimary}
        disabled={busy}
        aria-disabled={busy}
        title={
          disabledTitle ??
          "Quick JSON backup (tracker + mock drug when present). Preferred quick export."
        }
        onClick={() => {
          if (busy) return;
          setBusyKind("backup-now");
          try {
            const json = exportBackup();
            downloadBlob(
              new Blob([json], { type: "application/json" }),
              `shaheen-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`,
            );
            toast.success("Backup Now downloaded", { description: backupCoverageSummary(json) });
          } catch (e) {
            toast.error("Backup Now failed", {
              description: e instanceof Error ? e.message : "Unknown error",
            });
          } finally {
            setBusyKind(null);
          }
        }}
      >
        {busyKind === "backup-now" ? (
          <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
        ) : (
          <Download className="size-4 shrink-0" aria-hidden />
        )}
        Backup Now
      </button>
      <button
        type="button"
        className={toolbarBtnSecondary}
        disabled={busy}
        aria-disabled={busy}
        title={
          disabledTitle ??
          "One-click portable Complete Backup archive (ZIP). Full verified recovery package."
        }
        onClick={() => void runCompleteBackup(false)}
      >
        {busyKind === "complete" ? (
          <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
        ) : (
          <Archive className="size-4 shrink-0" aria-hidden />
        )}
        Complete Backup
      </button>
      <button
        type="button"
        className={toolbarBtnSecondary}
        disabled={busy}
        aria-disabled={busy}
        title={
          disabledTitle ??
          "Restore from Complete Backup: dry-run → isolated test → apply-safe (never auto-overwrite newer). No destructive Prod overwrite."
        }
        onClick={() => fileRef.current?.click()}
      >
        {busyKind === "restore" ? (
          <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
        ) : (
          <Upload className="size-4 shrink-0" aria-hidden />
        )}
        Restore Complete
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".zip,application/zip,application/json,.json"
        className="hidden"
        aria-hidden
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onRestoreFile(f);
        }}
      />
      <button
        type="button"
        className={cn(toolbarBtnSecondary, panelOpen && "border-primary")}
        title="Backup status, coverage, encryption, daily reminder, off-site stop"
        aria-expanded={panelOpen}
        aria-controls="compliance-dr-status-panel"
        onClick={() => setPanelOpen((v) => !v)}
      >
        <Shield className="size-4 shrink-0" aria-hidden /> DR Status
      </button>

      {reason && (
        <span
          role="status"
          className="max-w-[14rem] truncate text-xs font-semibold text-muted-foreground"
          title={reason}
        >
          {reason}
        </span>
      )}

      {panelOpen && (
        <div
          id="compliance-dr-status-panel"
          role="dialog"
          aria-label="Compliance DR status"
          className="absolute right-0 top-11 z-40 w-[min(28rem,calc(100vw-1.5rem))] rounded-lg border-2 border-border bg-card p-4 text-sm text-foreground shadow-lg"
        >
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
            <div className="mt-2 max-h-28 overflow-auto rounded border border-border bg-muted/40 p-2 text-xs">
              {status.lastGaps.map((g, i) => (
                <p key={`${g.sourceId}-${i}`}>
                  <span className="font-medium text-foreground">{g.sourceId}</span>: {g.reason}
                  {g.detail ? ` — ${g.detail}` : ""}
                </p>
              ))}
            </div>
          )}
          <label className="mt-3 block text-xs text-muted-foreground">
            Encryption passphrase (optional, admin-only AES-256-GCM)
            <input
              type="password"
              className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Min 8 characters"
              autoComplete="new-password"
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className={panelBtn}
              disabled={busy || !encryptReady}
              aria-disabled={busy || !encryptReady}
              title={
                encryptDisabledReason ??
                "Download AES-256-GCM encrypted Complete Backup ZIP"
              }
              onClick={() => void runCompleteBackup(true)}
            >
              Encrypted Complete Backup
            </button>
            {encryptDisabledReason && !busy && (
              <span className="basis-full text-xs font-medium text-muted-foreground">
                {encryptDisabledReason}
              </span>
            )}
            <button
              type="button"
              className={panelBtn}
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
              className={cn(panelBtn, "cursor-not-allowed opacity-70")}
              aria-disabled
              title={`Off-site scheduler not configured. ${offSiteStop.reason}`}
              onClick={() => {
                toast.message("Off-site scheduler stopped — approvals needed", {
                  description: offSiteStop.approvalsNeeded.slice(0, 2).join(" · "),
                });
              }}
            >
              Off-site: not configured
            </button>
            <button type="button" className={panelBtn} onClick={() => setPanelOpen(false)}>
              Close
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground" data-offsite-blocker>
            Off-site: not configured. {schedule.offSiteBlockedReason}
          </p>
        </div>
      )}
    </div>
  );
}
