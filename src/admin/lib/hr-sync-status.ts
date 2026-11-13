/**
 * User-facing Admin Attendance sync status labels (Batch 1 indicators).
 * Pure helpers — no Supabase.
 */

export type HrSyncUi =
  | "connecting"
  | "syncing"
  | "synced"
  | "error"
  | "paused"
  | "unsynced"
  | "conflict";

/** Canonical badge / banner labels required for Batch 1. */
export function hrSyncStatusLabel(status: HrSyncUi): string {
  switch (status) {
    case "synced":
      return "Cloud Saved";
    case "syncing":
      return "Saving";
    case "unsynced":
    case "connecting":
      return "Not Synced";
    case "error":
      return "Connection Error";
    case "paused":
      return "Sign In Required";
    case "conflict":
      return "Not Synced";
  }
}

/**
 * True when both sides are meaningful and content differs — requires explicit
 * conflict UX (never silent overwrite either direction).
 */
export function hrPayloadsDiverge(a: unknown, b: unknown, keys: readonly string[]): boolean {
  const slice = (v: unknown) => {
    if (!v || typeof v !== "object" || Array.isArray(v)) return null;
    const o = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of keys) {
      if (k === "logs") continue; // activity noise must not force conflict
      out[k] = o[k];
    }
    return JSON.stringify(out);
  };
  const sa = slice(a);
  const sb = slice(b);
  if (sa == null || sb == null) return sa !== sb;
  return sa !== sb;
}

export function needsExplicitConflictUx(opts: {
  localMeaningful: boolean;
  cloudMeaningful: boolean;
  diverge: boolean;
  pendingUnsynced: boolean;
}): boolean {
  return opts.pendingUnsynced && opts.localMeaningful && opts.cloudMeaningful && opts.diverge;
}
