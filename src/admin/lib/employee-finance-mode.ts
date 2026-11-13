/**
 * Employee finance backend mode.
 * Default: mock (session memory) until Admin migration is applied AND flag enabled.
 * NEVER writes banking to localStorage / app_state in either mode.
 */
import { isPreviewIsolated } from "@/lib/preview-isolated";

export type EmployeeFinanceMode = "mock" | "secure";

/** Explicit opt-in. Preview-isolated builds always stay on mock. */
export function getEmployeeFinanceMode(): EmployeeFinanceMode {
  if (isPreviewIsolated()) return "mock";
  if (import.meta.env.VITE_HR_FINANCE_SECURE === "1") return "secure";
  return "mock";
}

export function employeeFinanceModeLabel(mode: EmployeeFinanceMode = getEmployeeFinanceMode()): string {
  return mode === "secure"
    ? "Secure backend (Admin tables + audited RPCs)"
    : "Mock session only — banking not persisted";
}
