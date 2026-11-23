/**
 * Daily / off-site scheduler — preparatory code only.
 * Does NOT fake operational scheduled backups or upload anywhere.
 * Stops for credentials/billing/off-site approvals.
 */

import {
  DR_SCHEDULE_KEY,
  type DrScheduleStatus,
  type DrVerificationStatus,
} from "./types";

const OFF_SITE_BLOCKED =
  "Off-site scheduled archives require owner approval for private storage credentials/billing. No public GitHub or public bucket uploads.";

export const DR_APPROVALS_NEEDED = [
  "Private off-site object storage credentials (S3/R2/GCS) — not public",
  "Billing confirmation if a paid bucket/plan is required",
  "Optional: Supabase PITR / Dashboard backup policy review for okzcwctsgurumnnzuxgg",
  "Optional: service_role export of driver_sensitive_audit_log (deny-all from client)",
] as const;

export function defaultScheduleStatus(): DrScheduleStatus {
  return {
    enabled: false,
    cadence: "off",
    lastSuccessAt: null,
    lastAttemptAt: null,
    lastVerification: null,
    offSiteConfigured: false,
    offSiteBlockedReason: OFF_SITE_BLOCKED,
    approvalsNeeded: [...DR_APPROVALS_NEEDED],
  };
}

export function readScheduleStatus(): DrScheduleStatus {
  if (typeof localStorage === "undefined") return defaultScheduleStatus();
  try {
    const raw = localStorage.getItem(DR_SCHEDULE_KEY);
    if (!raw) return defaultScheduleStatus();
    const parsed = JSON.parse(raw) as Partial<DrScheduleStatus>;
    return {
      ...defaultScheduleStatus(),
      ...parsed,
      // Hard invariants — never claim off-site is live from client alone
      offSiteConfigured: false,
      offSiteBlockedReason: OFF_SITE_BLOCKED,
      approvalsNeeded: [...DR_APPROVALS_NEEDED],
    };
  } catch {
    return defaultScheduleStatus();
  }
}

export function writeScheduleStatus(patch: Partial<DrScheduleStatus>): DrScheduleStatus {
  const next = { ...readScheduleStatus(), ...patch };
  next.offSiteConfigured = false;
  next.offSiteBlockedReason = OFF_SITE_BLOCKED;
  next.approvalsNeeded = [...DR_APPROVALS_NEEDED];
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(DR_SCHEDULE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }
  return next;
}

/**
 * Enable a local daily *reminder* preference only.
 * Does not run background jobs, does not upload, does not invent credentials.
 */
export function enableLocalDailyReminder(): DrScheduleStatus {
  return writeScheduleStatus({
    enabled: true,
    cadence: "daily",
  });
}

export function disableLocalDailyReminder(): DrScheduleStatus {
  return writeScheduleStatus({
    enabled: false,
    cadence: "off",
  });
}

export function recordBackupAttempt(verification: DrVerificationStatus, ok: boolean): DrScheduleStatus {
  const now = new Date().toISOString();
  return writeScheduleStatus({
    lastAttemptAt: now,
    lastVerification: verification,
    ...(ok ? { lastSuccessAt: now } : {}),
  });
}

/**
 * Whether the local reminder should nudge the admin today.
 * Pure heuristic — not an operational scheduler.
 */
export function shouldNudgeDailyBackup(now = new Date()): boolean {
  const st = readScheduleStatus();
  if (!st.enabled || st.cadence !== "daily") return false;
  if (!st.lastSuccessAt) return true;
  const last = Date.parse(st.lastSuccessAt);
  if (!Number.isFinite(last)) return true;
  const ageMs = now.getTime() - last;
  return ageMs > 20 * 60 * 60 * 1000; // ~20h
}

/** Explicit stop surface for UI / report when off-site is requested. */
export function offSiteApprovalStop(): {
  stopped: true;
  reason: string;
  approvalsNeeded: string[];
} {
  return {
    stopped: true,
    reason: OFF_SITE_BLOCKED,
    approvalsNeeded: [...DR_APPROVALS_NEEDED],
  };
}
