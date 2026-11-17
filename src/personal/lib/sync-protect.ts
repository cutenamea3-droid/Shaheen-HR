/**
 * Pure Personal sync decisions — mirrors company cloud discipline without
 * touching Admin app_state or Driver tables.
 */
import type { PersonalState } from "./types";

export const PERSONAL_UNSYNCED_KEY = "hr-personal-unsynced-v1";

export type PersonalSyncBlob = Pick<
  PersonalState,
  | "courses"
  | "backlog"
  | "assessments"
  | "notes"
  | "sessions"
  | "dayPlans"
  | "discipline"
  | "settings"
  | "vaultNotes"
  | "gradeEntries"
  | "courseGrades"
  | "examPrepTasks"
  | "weeklyReviews"
>;

function arrLen(v: unknown): number {
  return Array.isArray(v) ? v.length : 0;
}

/** True when blob has user-authored study activity (not just defaults). */
export function isPersonalMeaningful(blob: Partial<PersonalSyncBlob> | null | undefined): boolean {
  if (!blob) return false;
  if (arrLen(blob.sessions) > 0) return true;
  if (arrLen(blob.notes) > 0) return true;
  if (arrLen(blob.backlog) > 0) return true;
  if (arrLen(blob.gradeEntries) > 0) return true;
  if (arrLen(blob.courseGrades) > 0) return true;
  if (arrLen(blob.examPrepTasks) > 0) return true;
  if (blob.weeklyReviews && typeof blob.weeklyReviews === "object" && !Array.isArray(blob.weeklyReviews) && Object.keys(blob.weeklyReviews).length > 0)
    return true;
  if (
    typeof blob.vaultNotes === "string" &&
    blob.vaultNotes.trim().length > 0
  )
    return true;
  if (blob.dayPlans && typeof blob.dayPlans === "object" && !Array.isArray(blob.dayPlans) && Object.keys(blob.dayPlans).length > 0) {
    const plans = Object.values(blob.dayPlans);
    if (plans.some((p) => (Array.isArray(p?.blocks) ? p.blocks.length : 0) > 0 || p?.mode !== "normal")) return true;
  }
  if (Array.isArray(blob.discipline) && blob.discipline.some((d) => (Array.isArray(d.doneDates) ? d.doneDates.length : 0) > 0))
    return true;
  return false;
}

/**
 * Cross-browser rule (secure mode):
 * - Cloud with data + empty/seed local → apply_cloud (browser B after login)
 * - Local unsynced → keep_local then push (browser A mid-edit)
 * - Both empty → empty
 * - Cloud empty + local meaningful → push_local
 * - Both meaningful, local NOT unsynced → apply_cloud (cloud is source of truth)
 */
export type PersonalSyncDecision = "apply_cloud" | "keep_local" | "push_local" | "empty";

export function decidePersonalSync(
  local: Partial<PersonalSyncBlob> | null | undefined,
  cloud: Partial<PersonalSyncBlob> | null | undefined,
  opts: { unsynced: boolean },
): PersonalSyncDecision {
  const localM = isPersonalMeaningful(local);
  const cloudM = isPersonalMeaningful(cloud);

  if (!localM && !cloudM) return "empty";
  if (opts.unsynced && localM) return "keep_local";
  if (cloudM && !localM) return "apply_cloud";
  if (!cloudM && localM) return "push_local";
  // Both meaningful, no local pending → prefer cloud so browser B matches A.
  if (cloudM) return "apply_cloud";
  return "empty";
}
