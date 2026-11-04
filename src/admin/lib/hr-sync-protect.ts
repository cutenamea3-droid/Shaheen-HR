/**
 * Pure guards for Admin `app_state` ↔ `hr-attendance-v1` sync.
 * Missing/empty cloud must never wipe localStorage; seed/empty must never
 * auto-upload over an existing cloud copy.
 */
import seed from "@/admin/data/seed.json";

/** Keys stored in Supabase `app_state.data` (must match cloud-sync KEYS). */
export const HR_SYNC_KEYS = ["depts", "employees", "records", "perf", "tasks", "settings", "team", "logs"] as const;
export type HrSyncKey = (typeof HR_SYNC_KEYS)[number];

/** Keys used to detect bundled seed (exclude `logs` — sign-in appends activity). */
const SEED_FINGERPRINT_KEYS = ["depts", "employees", "records", "perf", "tasks", "settings", "team"] as const;

const seedData = seed as Record<string, unknown>;

function asRecord(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  return data as Record<string, unknown>;
}

function recordEntryCount(records: unknown): number {
  if (!records || typeof records !== "object" || Array.isArray(records)) return 0;
  let n = 0;
  for (const day of Object.values(records as Record<string, unknown>)) {
    if (day && typeof day === "object" && !Array.isArray(day)) n += Object.keys(day as object).length;
  }
  return n;
}

function fingerprint(data: unknown): string {
  const o = asRecord(data) ?? {};
  const slice: Record<string, unknown> = {};
  for (const k of SEED_FINGERPRINT_KEYS) slice[k] = o[k];
  return JSON.stringify(slice);
}

const SEED_FINGERPRINT = fingerprint(seedData);

/** True when value is null/non-object or has none of the sync keys. */
export function isHrPayloadMissing(data: unknown): boolean {
  const o = asRecord(data);
  if (!o) return true;
  return !HR_SYNC_KEYS.some((k) => k in o);
}

/**
 * True when payload has no employees and no attendance day-rows
 * (includes `{}` and `{ employees: [], records: {} }` shaped empties).
 */
export function isHrPayloadEmpty(data: unknown): boolean {
  if (isHrPayloadMissing(data)) return true;
  const o = asRecord(data)!;
  const employees = Array.isArray(o.employees) ? o.employees : [];
  return employees.length === 0 && recordEntryCount(o.records) === 0;
}

/** Bundled first-run seed (logs ignored so sign-in activity does not mask seed). */
export function isHrSeedLike(data: unknown): boolean {
  if (isHrPayloadMissing(data)) return true;
  return fingerprint(data) === SEED_FINGERPRINT;
}

/** Has employees and/or attendance rows worth protecting. */
export function isHrMeaningful(data: unknown): boolean {
  if (isHrPayloadMissing(data)) return false;
  const o = asRecord(data)!;
  const employees = Array.isArray(o.employees) ? o.employees : [];
  return employees.length > 0 || recordEntryCount(o.records) > 0;
}

export type HrSyncDecision =
  | "keep_local"
  | "apply_cloud"
  | "push_local"
  | "refuse_seed_push";

/**
 * Decide pull/apply/push when cloud row + local snapshot are known.
 * - Empty/missing cloud never applies (never wipes localStorage).
 * - Seed/empty local never pushes over meaningful cloud.
 * - When both sides are meaningful: apply cloud unless `unsynced` (pending real local edits).
 */
export function decideHrSync(
  local: unknown,
  cloud: unknown | null | undefined,
  opts?: { unsynced?: boolean },
): HrSyncDecision {
  const unsynced = !!opts?.unsynced;
  const cloudMissingOrEmpty = cloud == null || isHrPayloadEmpty(cloud);
  const localSeed = isHrSeedLike(local);
  const localMeaningful = isHrMeaningful(local);
  const cloudMeaningful = cloud != null && isHrMeaningful(cloud) && !isHrPayloadEmpty(cloud);

  if (cloudMissingOrEmpty) {
    // Repair/bootstrap cloud only from real (non-seed) local data.
    if (localMeaningful && !localSeed) return "push_local";
    return "keep_local";
  }

  if (!cloudMeaningful) {
    if (localMeaningful && !localSeed) return "push_local";
    return "keep_local";
  }

  // Meaningful cloud exists.
  if (localSeed || !localMeaningful) return "apply_cloud";
  if (unsynced) return "keep_local";
  return "apply_cloud";
}

/** Whether an automatic push of `local` onto cloud is allowed. */
export function mayAutoPushLocal(local: unknown, cloud: unknown | null | undefined): boolean {
  if (isHrSeedLike(local) || !isHrMeaningful(local)) return false;
  if (cloud != null && isHrMeaningful(cloud) && !isHrPayloadEmpty(cloud)) {
    // Real local may push over cloud only when caller marked UNSYNCED (handled elsewhere).
    // This helper blocks seed/empty only; startSync/pull use decideHrSync + UNSYNCED.
    return true;
  }
  // Cloud missing/empty: allow push of real local to create first durable copy.
  return true;
}

/** Block seed/empty uploads when cloud already has real data. */
export function refuseSeedOrEmptyPush(local: unknown, cloud: unknown | null | undefined): boolean {
  if (!isHrSeedLike(local) && isHrMeaningful(local)) return false;
  if (cloud != null && isHrMeaningful(cloud) && !isHrPayloadEmpty(cloud)) return true;
  // Also refuse uploading pure seed into empty cloud (avoid polluting app_state with defaults).
  if (isHrSeedLike(local) || !isHrMeaningful(local)) return true;
  return false;
}
