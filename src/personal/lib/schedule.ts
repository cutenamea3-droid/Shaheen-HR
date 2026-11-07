import type { PersonalSettings, StudyMode } from "./types";

/** Busy / Rescue stay fixed; Normal uses weekday vs Sunday budgets (adjustable in Vault). */
export const BUSY_MINUTES = 45;
export const RESCUE_MINUTES = 20;
export const DEFAULT_WEEKDAY_MINUTES = 120;
export const DEFAULT_SUNDAY_MINUTES = 270;

export function isSundayIso(dateIso: string): boolean {
  // Noon avoids DST edge cases for local calendar day.
  return new Date(`${dateIso}T12:00:00`).getDay() === 0;
}

export function modeBudgetMinutes(
  mode: StudyMode,
  dateIso: string,
  settings: Pick<PersonalSettings, "weekdayMinutes" | "sundayMinutes">,
): number {
  if (mode === "busy") return BUSY_MINUTES;
  if (mode === "rescue") return RESCUE_MINUTES;
  return isSundayIso(dateIso) ? settings.sundayMinutes : settings.weekdayMinutes;
}

export function modeLabel(mode: StudyMode, dateIso: string): string {
  if (mode === "busy") return "Busy";
  if (mode === "rescue") return "Rescue";
  return isSundayIso(dateIso) ? "Sunday Recovery Mission" : "Normal";
}

/** Legacy constant map — Normal shows weekday default; call modeBudgetMinutes for real days. */
export const STUDY_MODE_MINUTES: Record<StudyMode, number> = {
  normal: DEFAULT_WEEKDAY_MINUTES,
  busy: BUSY_MINUTES,
  rescue: RESCUE_MINUTES,
};
