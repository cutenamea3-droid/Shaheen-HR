/**
 * Expenses backend mode.
 * Default: local browser store (`hr-expenses-v1`) — NOT app_state / HR_SYNC_KEYS.
 * Secure cloud tables only when migration applied AND VITE_HR_EXPENSES_SECURE=1
 * AND Attendance sync (#19) is verified for release.
 */
import { isPreviewIsolated } from "@/lib/preview-isolated";

export type ExpensesMode = "local" | "secure";

export function getExpensesMode(): ExpensesMode {
  if (isPreviewIsolated()) return "local";
  if (import.meta.env.VITE_HR_EXPENSES_SECURE === "1") return "secure";
  return "local";
}

/** Short user-facing label — no migration / PR jargon. */
export function expensesModeLabel(mode: ExpensesMode = getExpensesMode()): string {
  return mode === "secure" ? "Cloud expenses" : "Saved on this device";
}

/** Persist key — must never be added to HR_SYNC_KEYS / attendance backup. */
export const HR_EXPENSES_STORAGE_KEY = "hr-expenses-v1";
