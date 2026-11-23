/**
 * Driver Compliance Complete Backup & Disaster Recovery — shared types.
 * Scope: Driver Compliance module only (never Admin / Personal / Dispatch).
 */

export const DR_ARCHIVE_APP = "shaheen-driver-compliance-dr" as const;
export const DR_ARCHIVE_FORMAT_VERSION = 1 as const;

export type DrVerificationStatus = "VERIFIED COMPLETE" | "INCOMPLETE";

export type DrSourceKind =
  | "supabase_table"
  | "supabase_rpc"
  | "localStorage"
  | "sessionStorage"
  | "in_memory"
  | "attachment"
  | "derived";

export type DrSourceInventoryItem = {
  id: string;
  kind: DrSourceKind;
  label: string;
  location: string;
  requiredForComplete: boolean;
  /** Why this is excluded from COMPLETE when not required. */
  excludeReason?: string;
  notes?: string;
};

export type DrGap = {
  sourceId: string;
  reason: string;
  detail?: string;
};

export type DrCoverageSlice = {
  id: string;
  included: boolean;
  count?: number;
  bytes?: number;
  sha256?: string;
  gap?: string;
};

export type DrManifest = {
  app: typeof DR_ARCHIVE_APP;
  formatVersion: typeof DR_ARCHIVE_FORMAT_VERSION;
  exportedAt: string;
  exportedByEmail: string | null;
  verification: DrVerificationStatus;
  gaps: DrGap[];
  coverage: DrCoverageSlice[];
  counts: Record<string, number>;
  files: { path: string; sha256: string; bytes: number }[];
  encryption: "none" | "aes-256-gcm";
  notes: string[];
};

export type DrApplicationVersion = {
  app: typeof DR_ARCHIVE_APP;
  formatVersion: typeof DR_ARCHIVE_FORMAT_VERSION;
  exportedAt: string;
  gitHint: string;
  viteModes: {
    drugTestsSecure: boolean;
    rateCardSecure: boolean;
  };
};

export type DrArchiveFile = {
  path: string;
  bytes: Uint8Array;
  contentType: string;
};

export type DrBuildOptions = {
  /** Portal admin email when known. */
  actorEmail?: string | null;
  /** Passphrase for AES-GCM; omit for plaintext ZIP. */
  passphrase?: string;
  /** Include UI prefs / checklist (non-SoT). Default true. */
  includeUiPrefs?: boolean;
  /** Attempt to fetch http(s) attachment URLs found in cells. Default true. */
  fetchAttachments?: boolean;
  /** Optional injectable collectors for tests. */
  collectors?: Partial<DrCollectors>;
};

export type DrCollectors = {
  getAppData: () => unknown;
  listDriverIds: () => string[];
  listDrugEvents: (driverIds: string[]) => Promise<{ events: unknown[]; error: string | null; mode: "mock" | "secure" | "none" }>;
  listRateCards: (driverIds: string[]) => Promise<{ cards: unknown[]; error: string | null; mode: "mock" | "secure" | "none" }>;
  listPortalAccounts: () => Promise<{ accounts: unknown[]; error: string | null }>;
  listPortalActivity: () => Promise<{ rows: unknown[]; error: string | null }>;
  readLocalPrefs: () => Record<string, unknown>;
  readOfflineDirty: () => { dirtySectionIds: string[]; syncHint: string };
  fetchAttachment: (url: string) => Promise<{ ok: true; bytes: Uint8Array; contentType: string } | { ok: false; reason: string }>;
};

export type DrBuildResult = {
  manifest: DrManifest;
  files: DrArchiveFile[];
  /** Downloadable blob (ZIP or encrypted package). */
  blob: Blob;
  /** Raw package bytes (ZIP or encrypted JSON) — preferred in tests / Node. */
  bytes: Uint8Array;
  filename: string;
  verification: DrVerificationStatus;
  gaps: DrGap[];
};

export type DrRestoreMode = "dry-run" | "apply-safe" | "isolated-test";

export type DrRestoreConflict = {
  path: string;
  reason: "newer-local" | "id-mismatch" | "checksum" | "missing-source" | "policy";
  detail: string;
};

export type DrRestoreReport = {
  mode: DrRestoreMode;
  verification: DrVerificationStatus;
  wouldWrite: string[];
  skippedNewer: string[];
  conflicts: DrRestoreConflict[];
  applied: string[];
  gaps: DrGap[];
  isolatedOk?: boolean;
  notes: string[];
};

export type DrScheduleStatus = {
  enabled: boolean;
  cadence: "daily" | "off";
  lastSuccessAt: string | null;
  lastAttemptAt: string | null;
  lastVerification: DrVerificationStatus | null;
  offSiteConfigured: false;
  offSiteBlockedReason: string;
  approvalsNeeded: string[];
};

export const DR_STATUS_KEY = "shaheen-compliance-dr-status-v1";
export const DR_SCHEDULE_KEY = "shaheen-compliance-dr-schedule-v1";
