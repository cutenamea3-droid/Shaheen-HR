import { supabase } from "@/admin/integrations/supabase/client";
import { isPreviewIsolated } from "@/lib/preview-isolated";
import {
  clearHrPendingUnsynced,
  hasHrLocalOnlySessionFlag,
  hasHrPendingUnsynced,
  markHrPendingUnsynced,
  reconnectTreatAsUnsynced,
  saveNowMessage,
  setHrLocalOnlySessionFlag,
  type SaveNowResult,
} from "./hr-local-pending";
import {
  decideHrSync,
  isHrMeaningful,
  isHrPayloadEmpty,
  isHrSeedLike,
  refuseSeedOrEmptyPush,
} from "./hr-sync-protect";
import { hrPayloadsDiverge, needsExplicitConflictUx, type HrSyncUi } from "./hr-sync-status";
import { useApp, whenAttendanceHydrated } from "./store";

export type { SaveNowResult } from "./hr-local-pending";
export { hrSyncStatusLabel } from "./hr-sync-status";

const KEYS = ["depts", "employees", "records", "perf", "tasks", "settings", "team", "logs"] as const;
let timer: ReturnType<typeof setTimeout> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let unsub: (() => void) | null = null;
let localOnlyUnsub: (() => void) | null = null;
let flushBound = false;
let currentUser: string | null = null;
let lastStamp = "";
let pulling = false;
let pushing = false;
/** When set, auto push/pull overwrite is blocked until resolveHrConflict. */
let conflictCloud: Record<string, unknown> | null = null;
let conflictCloudStamp = "";

const snapshot = () => {
  const s = useApp.getState();
  return Object.fromEntries(KEYS.map((k) => [k, s[k]]));
};

export type HrSync = HrSyncUi;
let status: HrSync = "connecting";
const listeners = new Set<() => void>();
const setStatus = (s: HrSync) => {
  status = s;
  listeners.forEach((l) => l());
};
export const getSyncStatus = () => status;
export const subscribeSync = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const getConflictCloud = () => conflictCloud;
export const hasOpenHrConflict = () => conflictCloud != null;

function clearConflict() {
  conflictCloud = null;
  conflictCloudStamp = "";
}

async function readCloudRow(userId: string) {
  const { data, error } = await supabase
    .from("app_state")
    .select("data, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  return { data, error };
}

function readPendingUnsynced(): boolean {
  return reconnectTreatAsUnsynced({
    unsyncedFlag: hasHrPendingUnsynced(),
    localOnlyFlag: hasHrLocalOnlySessionFlag(),
  });
}

async function push(userId: string, attempt = 0): Promise<boolean> {
  if (pushing) return false;
  if (conflictCloud != null) {
    setStatus("conflict");
    return false;
  }
  const local = snapshot();

  // Never auto-upload empty/seed over an existing (or empty) cloud copy.
  // Fetch current cloud first when local looks like seed/empty.
  if (isHrSeedLike(local) || isHrPayloadEmpty(local)) {
    const { data: cloudRow, error: cloudErr } = await readCloudRow(userId);
    if (cloudErr) {
      setStatus("error");
      console.error("[HR cloud] save guard failed:", cloudErr.message);
      return false;
    }
    const cloudData = cloudRow?.data;
    if (refuseSeedOrEmptyPush(local, cloudData)) {
      console.warn("[HR cloud] refused seed/empty upload (protects app_state + local)");
      clearHrPendingUnsynced();
      setStatus("synced");
      return false;
    }
  }

  pushing = true;
  setStatus("syncing");
  const stamp = new Date().toISOString();
  try {
    const { error } = await supabase
      .from("app_state")
      .upsert({ user_id: userId, data: snapshot() as never, updated_at: stamp });
    if (!error) {
      clearHrPendingUnsynced();
      lastStamp = stamp;
      setStatus("synced");
      return true;
    }
    console.error("[HR cloud] save failed:", error.message);
    if (attempt < 5) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void push(userId, attempt + 1), 2000 * (attempt + 1));
    } else setStatus("error");
    return false;
  } finally {
    pushing = false;
  }
}

/** Pull remote row when this tab has nothing pending. */
async function pull(userId: string, force = false) {
  if (pulling || pushing || !currentUser) return;
  if (conflictCloud != null) {
    setStatus("conflict");
    return;
  }
  if (!force && readPendingUnsynced()) {
    const local = snapshot();
    // Seed/empty "unsynced" must not block applying real cloud (and must not push).
    if (!isHrSeedLike(local) && !isHrPayloadEmpty(local)) {
      if (status !== "syncing" && status !== "error") setStatus("unsynced");
      return;
    }
  }
  pulling = true;
  try {
    const { data, error } = await readCloudRow(userId);
    if (error) {
      setStatus("error");
      console.error("[HR cloud] load failed:", error.message);
      // Failed read must never clear or replace local state.
      return;
    }

    const cloudData = data?.data;
    const local = snapshot();
    const unsynced = readPendingUnsynced();
    // Seed/empty unsynced is ignored for decisions (cleared below when applying cloud).
    const unsyncedReal = unsynced && !isHrSeedLike(local) && !isHrPayloadEmpty(local);
    const decision = decideHrSync(local, cloudData ?? null, { unsynced: unsyncedReal });

    if (decision === "keep_local") {
      // Missing/empty cloud: never setState — preserves hr-attendance-v1.
      // Pending real local stays Not Synced until push succeeds.
      setStatus(unsyncedReal ? "unsynced" : "synced");
      return;
    }
    if (decision === "push_local") {
      await push(userId);
      return;
    }
    if (decision === "apply_cloud") {
      if (!force && data?.updated_at && data.updated_at <= lastStamp) return;
      // Drop false seed unsynced flag so cloud can hydrate this browser.
      if (unsynced && (isHrSeedLike(local) || isHrPayloadEmpty(local))) {
        clearHrPendingUnsynced();
        setHrLocalOnlySessionFlag(false);
      }
      if (readPendingUnsynced()) {
        setStatus("unsynced");
        return;
      }
      // Apply only non-empty meaningful cloud — never wipe localStorage with empties.
      if (isHrPayloadEmpty(cloudData)) {
        setStatus("synced");
        return;
      }
      useApp.setState(cloudData as never);
      lastStamp = data?.updated_at ?? lastStamp;
      setStatus("synced");
      return;
    }
  } finally {
    pulling = false;
  }
}

function openConflict(cloudData: unknown, stamp: string) {
  if (!cloudData || typeof cloudData !== "object" || Array.isArray(cloudData)) return;
  conflictCloud = cloudData as Record<string, unknown>;
  conflictCloudStamp = stamp;
  setStatus("conflict");
}

/**
 * While signed in with a local-only session (no Supabase Auth), mark real local
 * attendance as pending so a later cloud reconnect never silently applies cloud.
 */
export async function startLocalOnlyGuard() {
  if (isPreviewIsolated()) {
    stopLocalOnlyGuard();
    setStatus("paused");
    return;
  }
  stopLocalOnlyGuard();
  setHrLocalOnlySessionFlag(true);
  setStatus("paused");
  await whenAttendanceHydrated();
  const local = snapshot();
  // Protect existing meaningful local — local-only never confirmed a cloud match.
  if (!isHrSeedLike(local) && !isHrPayloadEmpty(local)) {
    markHrPendingUnsynced();
  }
  let last = JSON.stringify(snapshot());
  localOnlyUnsub = useApp.subscribe(() => {
    const now = JSON.stringify(snapshot());
    if (now === last) return;
    last = now;
    markHrPendingUnsynced();
  });
}

export function stopLocalOnlyGuard() {
  localOnlyUnsub?.();
  localOnlyUnsub = null;
}

function wireLiveSync(userId: string) {
  unsub?.();
  let last = JSON.stringify(snapshot());
  unsub = useApp.subscribe(() => {
    if (currentUser !== userId) return;
    const now = JSON.stringify(snapshot());
    if (now === last) return;
    last = now;
    markHrPendingUnsynced();
    if (conflictCloud != null) {
      setStatus("conflict");
      return;
    }
    setStatus("unsynced");
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void push(userId), 400);
  });
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(() => {
    if (document.visibilityState === "visible" && currentUser === userId) void pull(userId);
  }, 4000);
  if (typeof window !== "undefined" && !flushBound) {
    flushBound = true;
    const flush = () => {
      if (currentUser && hasHrPendingUnsynced() && conflictCloud == null) void push(currentUser);
    };
    window.addEventListener("pagehide", flush);
    window.addEventListener("focus", () => {
      if (currentUser) void pull(currentUser);
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush();
      else if (currentUser) void pull(currentUser);
    });
  }
}

/**
 * Owner chose how to resolve divergent local vs cloud (no silent overwrite).
 * `keep_local` uploads this browser; `use_cloud` applies the held cloud snapshot.
 */
export async function resolveHrConflict(choice: "keep_local" | "use_cloud"): Promise<SaveNowResult> {
  if (!currentUser || conflictCloud == null) {
    return saveNowMessage("cloud_fail");
  }
  if (choice === "use_cloud") {
    const held = conflictCloud;
    const stamp = conflictCloudStamp;
    clearConflict();
    clearHrPendingUnsynced();
    useApp.setState(held as never);
    lastStamp = stamp || lastStamp;
    setStatus("synced");
    return saveNowMessage("cloud_ok");
  }
  clearConflict();
  const pushed = await push(currentUser, 5);
  return pushed ? saveNowMessage("cloud_ok") : saveNowMessage("cloud_fail");
}

/** Load the saved data from the cloud, then save every change. */
export async function startSync(userId: string) {
  if (isPreviewIsolated()) {
    stopSync();
    setStatus("synced");
    return;
  }
  // Capture local-only flag before clearing the guard (reconnect must not wipe pending edits).
  const pendingBefore = readPendingUnsynced();
  stopLocalOnlyGuard();
  setHrLocalOnlySessionFlag(false);
  if (pendingBefore) markHrPendingUnsynced();
  clearConflict();

  currentUser = userId;
  // Wait for localStorage rehydrate so we don't push seed over a newer cloud copy.
  await whenAttendanceHydrated();
  const local = snapshot();
  const unsynced = hasHrPendingUnsynced();
  // Pending real local vs meaningful divergent cloud → explicit conflict UX (never silent LWW).
  if (unsynced && !isHrSeedLike(local) && isHrMeaningful(local) && !isHrPayloadEmpty(local)) {
    const { data, error } = await readCloudRow(userId);
    if (error) {
      setStatus("error");
      console.error("[HR cloud] reconnect read failed:", error.message);
      wireLiveSync(userId);
      return;
    }
    const cloudData = data?.data;
    const cloudMeaningful =
      cloudData != null && isHrMeaningful(cloudData) && !isHrPayloadEmpty(cloudData);
    if (
      needsExplicitConflictUx({
        localMeaningful: true,
        cloudMeaningful,
        diverge: hrPayloadsDiverge(local, cloudData, KEYS),
        pendingUnsynced: true,
      })
    ) {
      openConflict(cloudData, data?.updated_at ?? "");
      wireLiveSync(userId);
      return;
    }
    await push(userId);
  } else {
    if (unsynced && (isHrSeedLike(local) || isHrPayloadEmpty(local))) {
      clearHrPendingUnsynced();
    }
    await pull(userId, true);
  }
  wireLiveSync(userId);
}

export function stopSync() {
  unsub?.();
  unsub = null;
  if (timer) clearTimeout(timer);
  timer = null;
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
  currentUser = null;
  lastStamp = "";
  clearConflict();
  setStatus("connecting");
}

/** Save everything to the cloud right now. Never claims cloud success without Auth. */
export async function saveNow(): Promise<SaveNowResult> {
  // Isolated preview: attendance already persists via zustand localStorage — never hit Supabase.
  if (isPreviewIsolated()) {
    setStatus("synced");
    return saveNowMessage("preview");
  }
  if (conflictCloud != null) {
    setStatus("conflict");
    return saveNowMessage("conflict");
  }
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) {
    // Local zustand persist already holds the copy; do not pretend this is a cloud save.
    markHrPendingUnsynced();
    setStatus("paused");
    return saveNowMessage("local_only");
  }
  if (timer) clearTimeout(timer);
  const pushed = await push(u.user.id, 5);
  return pushed ? saveNowMessage("cloud_ok") : saveNowMessage("cloud_fail");
}
