import { supabase } from "@/admin/integrations/supabase/client";
import { isPreviewIsolated } from "@/lib/preview-isolated";
import {
  decideHrSync,
  isHrPayloadEmpty,
  isHrSeedLike,
  refuseSeedOrEmptyPush,
} from "./hr-sync-protect";
import { useApp, whenAttendanceHydrated } from "./store";

const KEYS = ["depts", "employees", "records", "perf", "tasks", "settings", "team", "logs"] as const;
// Set while this browser has changes the cloud hasn't confirmed yet, so a refresh
// never overwrites them with an older cloud copy.
const UNSYNCED = "hr-attendance-unsynced";
let timer: ReturnType<typeof setTimeout> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let unsub: (() => void) | null = null;
let flushBound = false;
let currentUser: string | null = null;
let lastStamp = "";
let pulling = false;
let pushing = false;

const snapshot = () => {
  const s = useApp.getState();
  return Object.fromEntries(KEYS.map((k) => [k, s[k]]));
};

export type HrSync = "connecting" | "syncing" | "synced" | "error";
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

async function readCloudRow(userId: string) {
  const { data, error } = await supabase
    .from("app_state")
    .select("data, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  return { data, error };
}

async function push(userId: string, attempt = 0): Promise<boolean> {
  if (pushing) return false;
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
      localStorage.removeItem(UNSYNCED);
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
      localStorage.removeItem(UNSYNCED);
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
  if (!force && localStorage.getItem(UNSYNCED) === "1") {
    const local = snapshot();
    // Seed/empty "unsynced" must not block applying real cloud (and must not push).
    if (!isHrSeedLike(local) && !isHrPayloadEmpty(local)) return;
  }
  pulling = true;
  try {
    const { data, error } = await readCloudRow(userId);
    if (error) {
      setStatus("error");
      console.error("[HR cloud] load failed:", error.message);
      return;
    }

    const cloudData = data?.data;
    const local = snapshot();
    const unsynced = localStorage.getItem(UNSYNCED) === "1";
    // Seed/empty unsynced is ignored for decisions (cleared below when applying cloud).
    const unsyncedReal = unsynced && !isHrSeedLike(local) && !isHrPayloadEmpty(local);
    const decision = decideHrSync(local, cloudData ?? null, { unsynced: unsyncedReal });

    if (decision === "keep_local") {
      // Missing/empty cloud: never setState — preserves hr-attendance-v1.
      setStatus("synced");
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
        localStorage.removeItem(UNSYNCED);
      }
      if (localStorage.getItem(UNSYNCED) === "1") return;
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

/** Load the saved data from the cloud, then save every change. */
export async function startSync(userId: string) {
  if (isPreviewIsolated()) {
    stopSync();
    setStatus("synced");
    return;
  }
  currentUser = userId;
  // Wait for localStorage rehydrate so we don't push seed over a newer cloud copy.
  await whenAttendanceHydrated();
  const local = snapshot();
  const unsynced = localStorage.getItem(UNSYNCED) === "1";
  // Only push-first when local has real non-seed edits pending.
  if (unsynced && !isHrSeedLike(local) && !isHrPayloadEmpty(local)) {
    await push(userId);
  } else {
    if (unsynced && (isHrSeedLike(local) || isHrPayloadEmpty(local))) {
      localStorage.removeItem(UNSYNCED);
    }
    await pull(userId, true);
  }
  unsub?.();
  let last = JSON.stringify(snapshot());
  unsub = useApp.subscribe(() => {
    if (currentUser !== userId) return;
    const now = JSON.stringify(snapshot());
    if (now === last) return;
    last = now;
    localStorage.setItem(UNSYNCED, "1");
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
      if (currentUser && localStorage.getItem(UNSYNCED) === "1") void push(currentUser);
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

export function stopSync() {
  unsub?.();
  unsub = null;
  if (timer) clearTimeout(timer);
  timer = null;
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
  currentUser = null;
  lastStamp = "";
  setStatus("connecting");
}

/** Save everything to the cloud right now. Returns true on success. */
export async function saveNow() {
  // Isolated preview: attendance already persists via zustand localStorage — never hit Supabase.
  if (isPreviewIsolated()) {
    setStatus("synced");
    return true;
  }
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return false;
  if (timer) clearTimeout(timer);
  return push(u.user.id, 5);
}
