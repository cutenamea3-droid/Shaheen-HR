import { DR_STATUS_KEY, type DrGap, type DrVerificationStatus } from "./types";

export type DrUiStatus = {
  lastBackupAt: string | null;
  lastFilename: string | null;
  lastVerification: DrVerificationStatus | null;
  lastGaps: DrGap[];
  lastCounts: Record<string, number>;
  lastEncryption: "none" | "aes-256-gcm" | null;
};

export function defaultUiStatus(): DrUiStatus {
  return {
    lastBackupAt: null,
    lastFilename: null,
    lastVerification: null,
    lastGaps: [],
    lastCounts: {},
    lastEncryption: null,
  };
}

export function readDrUiStatus(): DrUiStatus {
  if (typeof localStorage === "undefined") return defaultUiStatus();
  try {
    const raw = localStorage.getItem(DR_STATUS_KEY);
    if (!raw) return defaultUiStatus();
    const parsed = JSON.parse(raw) as Partial<DrUiStatus>;
    return { ...defaultUiStatus(), ...parsed };
  } catch {
    return defaultUiStatus();
  }
}

export function writeDrUiStatus(patch: Partial<DrUiStatus>): DrUiStatus {
  const next = { ...readDrUiStatus(), ...patch };
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(DR_STATUS_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }
  return next;
}

export function coverageLabel(verification: DrVerificationStatus | null, gaps: DrGap[]): string {
  if (!verification) return "No Complete Backup yet";
  if (verification === "VERIFIED COMPLETE") return "VERIFIED COMPLETE — required sources present";
  const n = gaps.length;
  return `INCOMPLETE — ${n} gap${n === 1 ? "" : "s"}`;
}
