/**
 * Pending-sync flags for Admin attendance (`hr-attendance-v1`).
 * Pure of Supabase — used while cloud sync is paused (local session) and by cloud-sync.
 */

export const HR_ATTENDANCE_UNSYNCED_KEY = "hr-attendance-unsynced";
/** Set while the UI is in a local-only session (no Supabase Auth). */
export const HR_ATTENDANCE_LOCAL_ONLY_KEY = "hr-attendance-local-only";

export function hasHrPendingUnsynced(
  storage: Pick<Storage, "getItem"> = typeof localStorage !== "undefined" ? localStorage : { getItem: () => null },
): boolean {
  return storage.getItem(HR_ATTENDANCE_UNSYNCED_KEY) === "1";
}

export function markHrPendingUnsynced(
  storage: Pick<Storage, "setItem"> = typeof localStorage !== "undefined" ? localStorage : { setItem: () => undefined },
): void {
  storage.setItem(HR_ATTENDANCE_UNSYNCED_KEY, "1");
}

export function clearHrPendingUnsynced(
  storage: Pick<Storage, "removeItem"> = typeof localStorage !== "undefined"
    ? localStorage
    : { removeItem: () => undefined },
): void {
  storage.removeItem(HR_ATTENDANCE_UNSYNCED_KEY);
}

export function setHrLocalOnlySessionFlag(
  on: boolean,
  storage: Pick<Storage, "setItem" | "removeItem"> = typeof localStorage !== "undefined"
    ? localStorage
    : { setItem: () => undefined, removeItem: () => undefined },
): void {
  if (on) storage.setItem(HR_ATTENDANCE_LOCAL_ONLY_KEY, "1");
  else storage.removeItem(HR_ATTENDANCE_LOCAL_ONLY_KEY);
}

export function hasHrLocalOnlySessionFlag(
  storage: Pick<Storage, "getItem"> = typeof localStorage !== "undefined" ? localStorage : { getItem: () => null },
): boolean {
  return storage.getItem(HR_ATTENDANCE_LOCAL_ONLY_KEY) === "1";
}

/**
 * On cloud reconnect, treat as pending local work when either the unsynced bit
 * or a prior local-only session flag is set — so we never silently apply cloud
 * over edits made while sync was paused.
 */
export function reconnectTreatAsUnsynced(opts: {
  unsyncedFlag: boolean;
  localOnlyFlag: boolean;
}): boolean {
  return opts.unsyncedFlag || opts.localOnlyFlag;
}

export type SaveNowResult = {
  /** True when the browser kept a durable local copy and/or cloud save succeeded. */
  ok: boolean;
  /** True only when Supabase `app_state` accepted the upsert. */
  cloud: boolean;
  message: string;
};

export function saveNowMessage(
  kind: "cloud_ok" | "cloud_fail" | "local_only" | "preview" | "conflict",
): SaveNowResult {
  switch (kind) {
    case "cloud_ok":
      return { ok: true, cloud: true, message: "Cloud Saved." };
    case "cloud_fail":
      return {
        ok: false,
        cloud: false,
        message: "Connection Error — try again. Local copy is still on this browser.",
      };
    case "local_only":
      return {
        ok: true,
        cloud: false,
        message: "Saved on this browser only — Sign In Required for cloud sync.",
      };
    case "preview":
      return { ok: true, cloud: false, message: "Saved on this browser only (isolated preview)." };
    case "conflict":
      return {
        ok: false,
        cloud: false,
        message: "Not Synced — choose Keep this browser or Use cloud before saving.",
      };
  }
}
