/**
 * Personal study cloud sync — personal_study_state ONLY.
 * Never imports Admin/Driver clients. Never touches app_state / tracker_sections.
 *
 * When VITE_PERSONAL_AUTH_SECURE=1: Personal SQL is the source of truth across browsers.
 * localStorage (hr-personal-v1) is a cache / offline fallback only.
 */
import { getPersonalSupabase } from "@/personal/integrations/supabase/client";
import { isPersonalSecureEnabled } from "./secure-config";
import { usePersonal, type PersonalStore } from "./store";
import { migrateSettings } from "./defaults";
import type { Json } from "@/personal/integrations/supabase/types";
import {
  PERSONAL_UNSYNCED_KEY,
  decidePersonalSync,
  isPersonalMeaningful,
  type PersonalSyncBlob,
} from "./sync-protect";

export type PersonalCloudStatus = "off" | "connecting" | "syncing" | "synced" | "error";

let stopUnsub: (() => void) | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let syncing = false;
/** Bumps on every local edit so an in-flight push cannot clear the unsynced flag. */
let editEpoch = 0;
/** First pull must finish before debounced pushes — avoids overwriting cloud with a partial local cache. */
let initialPullDone = false;
let currentUser: string | null = null;
let status: PersonalCloudStatus = "off";
const listeners = new Set<() => void>();

function mergeById<T extends { id: string; updatedAt?: number }>(local: T[], cloud: T[]): T[] {
  const map = new Map<string, T>();
  for (const row of cloud) map.set(row.id, row);
  for (const row of local) {
    const prev = map.get(row.id);
    if (!prev || (row.updatedAt ?? 0) >= (prev.updatedAt ?? 0)) map.set(row.id, row);
  }
  return [...map.values()];
}

function setStatus(s: PersonalCloudStatus) {
  status = s;
  listeners.forEach((l) => l());
}

export function getPersonalCloudStatus() {
  return status;
}

export function subscribePersonalCloudStatus(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function readUnsynced(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(PERSONAL_UNSYNCED_KEY) === "1";
  } catch {
    return false;
  }
}

function markUnsynced() {
  editEpoch += 1;
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PERSONAL_UNSYNCED_KEY, "1");
  } catch {
    /* ignore */
  }
}

function clearUnsynced() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(PERSONAL_UNSYNCED_KEY);
  } catch {
    /* ignore */
  }
}

function snapshot(): PersonalSyncBlob {
  const s = usePersonal.getState();
  return {
    courses: s.courses,
    backlog: s.backlog,
    assessments: s.assessments,
    notes: s.notes,
    sessions: s.sessions,
    dayPlans: s.dayPlans,
    discipline: s.discipline,
    settings: s.settings,
    vaultNotes: s.vaultNotes,
    gradeEntries: s.gradeEntries,
    courseGrades: s.courseGrades,
    examPrepTasks: s.examPrepTasks,
    weeklyReviews: s.weeklyReviews,
  };
}

function applyCloud(blob: Partial<PersonalSyncBlob>) {
  const patch: Partial<PersonalStore> = {};
  const arr = <T,>(v: unknown): T[] | undefined => (Array.isArray(v) ? (v as T[]) : undefined);
  const obj = <T extends object>(v: unknown): T | undefined =>
    v && typeof v === "object" && !Array.isArray(v) ? (v as T) : undefined;
  const courses = arr<PersonalStore["courses"][number]>(blob.courses);
  if (courses) patch.courses = courses;
  const backlog = arr<PersonalStore["backlog"][number]>(blob.backlog);
  if (backlog) patch.backlog = backlog;
  const assessments = arr<PersonalStore["assessments"][number]>(blob.assessments);
  if (assessments) patch.assessments = assessments;
  // [] is truthy — never let an empty cloud notes array wipe local notes while unsynced.
  const notes = arr<PersonalStore["notes"][number]>(blob.notes);
  if (notes) {
    const localNotes = usePersonal.getState().notes;
    if (!(notes.length === 0 && localNotes.length > 0 && readUnsynced())) {
      patch.notes = notes;
    }
  }
  const sessions = arr<PersonalStore["sessions"][number]>(blob.sessions);
  if (sessions) patch.sessions = sessions;
  const dayPlans = obj<PersonalStore["dayPlans"]>(blob.dayPlans);
  if (dayPlans) patch.dayPlans = dayPlans;
  const discipline = arr<PersonalStore["discipline"][number]>(blob.discipline);
  if (discipline) patch.discipline = discipline;
  if (blob.settings) patch.settings = migrateSettings(blob.settings);
  if (typeof blob.vaultNotes === "string") patch.vaultNotes = blob.vaultNotes;
  const gradeEntries = arr<PersonalStore["gradeEntries"][number]>(blob.gradeEntries);
  if (gradeEntries) patch.gradeEntries = gradeEntries;
  const courseGrades = arr<PersonalStore["courseGrades"][number]>(blob.courseGrades);
  if (courseGrades) patch.courseGrades = courseGrades;
  const examPrepTasks = arr<PersonalStore["examPrepTasks"][number]>(blob.examPrepTasks);
  if (examPrepTasks) patch.examPrepTasks = examPrepTasks;
  const weeklyReviews = obj<PersonalStore["weeklyReviews"]>(blob.weeklyReviews);
  if (weeklyReviews) patch.weeklyReviews = weeklyReviews;
  usePersonal.setState(patch);
}

export async function pullPersonalCloud(
  userId: string,
): Promise<"applied" | "kept_local" | "pushed" | "empty" | "skipped" | "error"> {
  if (!isPersonalSecureEnabled()) return "skipped";
  const sb = getPersonalSupabase();
  if (!sb) return "skipped";

  setStatus("syncing");
  try {
    const { data, error } = await sb
      .from("personal_study_state")
      .select("data, updated_at")
      .eq("owner_id", userId)
      .maybeSingle();

    if (error) {
      console.warn("[HR Personal] cloud pull failed", error.message);
      setStatus("error");
      return "error";
    }

    const cloud = (data?.data ?? null) as Partial<PersonalSyncBlob> | null;
    const local = snapshot();
    const decision = decidePersonalSync(local, cloud, { unsynced: readUnsynced() });

    if (decision === "empty") {
      setStatus("synced");
      return "empty";
    }
    if (decision === "apply_cloud" && cloud) {
      applyCloud(cloud);
      clearUnsynced();
      setStatus("synced");
      return "applied";
    }
    if (decision === "push_local" || decision === "keep_local") {
      const ok = await pushPersonalCloud(userId);
      return ok ? (decision === "push_local" ? "pushed" : "kept_local") : "error";
    }
    setStatus("synced");
    return "empty";
  } finally {
    initialPullDone = true;
  }
}

export async function pushPersonalCloud(userId: string): Promise<boolean> {
  if (!isPersonalSecureEnabled()) return false;
  const sb = getPersonalSupabase();
  if (!sb) return false;
  setStatus("syncing");
  const epochAtStart = editEpoch;
  const local = snapshot();
  const { data: existing, error: readErr } = await sb
    .from("personal_study_state")
    .select("data")
    .eq("owner_id", userId)
    .maybeSingle();
  if (readErr) {
    console.warn("[HR Personal] cloud pre-push read failed", readErr.message);
    setStatus("error");
    return false;
  }
  const cloud = (existing?.data ?? null) as Partial<PersonalSyncBlob> | null;
  // Never upsert empty/default local over an existing meaningful Personal cloud row.
  if (!isPersonalMeaningful(local) && isPersonalMeaningful(cloud)) {
    console.warn("[HR Personal] refused empty push (protects personal_study_state)");
    setStatus("synced");
    return false;
  }
  // Merge id-keyed slices so a partial local cache cannot drop cloud notes/sessions.
  const merged: PersonalSyncBlob = {
    ...local,
    notes: mergeById(local.notes ?? [], cloud?.notes ?? []),
    sessions: mergeById(local.sessions ?? [], cloud?.sessions ?? []),
    backlog: mergeById(local.backlog ?? [], cloud?.backlog ?? []),
    assessments: mergeById(local.assessments ?? [], cloud?.assessments ?? []),
    gradeEntries: mergeById(local.gradeEntries ?? [], cloud?.gradeEntries ?? []),
    courseGrades: mergeById(local.courseGrades ?? [], cloud?.courseGrades ?? []),
    examPrepTasks: mergeById(local.examPrepTasks ?? [], cloud?.examPrepTasks ?? []),
  };
  const data = merged as unknown as Json;
  const { error } = await sb.from("personal_study_state").upsert(
    {
      owner_id: userId,
      data,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "owner_id" },
  );
  if (error) {
    console.warn("[HR Personal] cloud push failed", error.message);
    setStatus("error");
    return false;
  }
  // A newer local edit landed during this push — keep unsynced so poll cannot apply stale cloud.
  if (epochAtStart === editEpoch) {
    clearUnsynced();
    setStatus("synced");
  } else {
    setStatus("syncing");
  }
  return true;
}

export function startPersonalCloudSync(userId: string) {
  stopPersonalCloudSync();
  if (!isPersonalSecureEnabled()) {
    setStatus("off");
    return;
  }
  currentUser = userId;
  initialPullDone = false;
  setStatus("connecting");

  const flushPush = () => {
    if (!currentUser) return;
    if (!initialPullDone) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(flushPush, 500);
      return;
    }
    if (syncing) {
      // In-flight push — retry shortly so the skipped edit is not dropped.
      if (timer) clearTimeout(timer);
      timer = setTimeout(flushPush, 500);
      return;
    }
    const user = currentUser;
    syncing = true;
    void pushPersonalCloud(user).finally(() => {
      syncing = false;
      // If edits arrived during the push, epoch still differs / unsynced stays set — flush again.
      if (currentUser && readUnsynced()) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(flushPush, 500);
      }
    });
  };

  void pullPersonalCloud(userId).finally(() => {
    // Local edits during the first pull stay unsynced — flush once pull has landed.
    if (currentUser && readUnsynced()) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(flushPush, 500);
    }
  });

  const schedule = () => {
    if (!currentUser) return;
    markUnsynced();
    if (timer) clearTimeout(timer);
    timer = setTimeout(flushPush, 500);
  };

  const unsubStore = usePersonal.subscribe(schedule);
  const onHide = () => {
    if (currentUser && initialPullDone) void pushPersonalCloud(currentUser);
  };
  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", onHide);
  }

  // Poll like Admin — second browser sees updates without hard refresh eventually.
  pollTimer = setInterval(() => {
    if (!currentUser || readUnsynced()) return;
    void pullPersonalCloud(currentUser);
  }, 8000);

  stopUnsub = () => {
    unsubStore();
    if (typeof window !== "undefined") {
      window.removeEventListener("pagehide", onHide);
    }
  };
}

export function stopPersonalCloudSync() {
  currentUser = null;
  initialPullDone = false;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  stopUnsub?.();
  stopUnsub = null;
  setStatus(isPersonalSecureEnabled() ? "connecting" : "off");
}

/** Test helper: apply a cloud blob through the same coerce path as live pull. */
export function __applyPersonalCloudForTest(blob: Partial<PersonalSyncBlob>): void {
  applyCloud(blob);
}

/** Test helper: in-memory A→B round-trip without live Supabase. */
export function __simulateCrossBrowserSync(
  browserA: PersonalSyncBlob,
  browserBLocal: PersonalSyncBlob,
): PersonalSyncBlob {
  // A already "pushed" → cloud = A
  const cloud = browserA;
  const decision = decidePersonalSync(browserBLocal, cloud, { unsynced: false });
  if (decision === "apply_cloud") return cloud;
  if (decision === "keep_local" || decision === "push_local") return browserBLocal;
  return browserBLocal;
}
