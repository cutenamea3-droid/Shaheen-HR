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

/** True when blob has user-authored study activity (not just defaults). */
export function isPersonalMeaningful(blob: Partial<PersonalSyncBlob> | null | undefined): boolean {
  if (!blob) return false;
  if ((blob.sessions?.length ?? 0) > 0) return true;
  if ((blob.notes?.length ?? 0) > 0) return true;
  if ((blob.backlog?.length ?? 0) > 0) return true;
  if ((blob.gradeEntries?.length ?? 0) > 0) return true;
  if ((blob.courseGrades?.length ?? 0) > 0) return true;
  if ((blob.examPrepTasks?.length ?? 0) > 0) return true;
  if (blob.weeklyReviews && Object.keys(blob.weeklyReviews).length > 0) return true;
  if (blob.vaultNotes && blob.vaultNotes.trim().length > 0) return true;
  if (blob.dayPlans && Object.keys(blob.dayPlans).length > 0) {
    const plans = Object.values(blob.dayPlans);
    if (plans.some((p) => (p.blocks?.length ?? 0) > 0 || p.mode !== "normal")) return true;
  }
  if ((blob.discipline ?? []).some((d) => (d.doneDates?.length ?? 0) > 0)) return true;
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
