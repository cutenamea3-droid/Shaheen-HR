/**
 * Employee finance backend mode.
 *
 * Production client handoff: Directory uses the live Admin Team roster
 * (hr-attendance-v1 localStorage + Supabase app_state). Synthetic MOCK
 * banking chrome is opt-in only — never replaces live employees.
 *
 * Secure IBAN vault remains flag-gated until migration is owner-approved.
 * NEVER writes banking to localStorage / app_state in mock or live modes.
 */
import { isPreviewIsolated } from "@/lib/preview-isolated";

export type EmployeeFinanceMode = "mock" | "secure" | "live";

/** Explicit opt-in for secure banking vault. Preview-isolated builds stay on mock. */
export function getEmployeeFinanceMode(): EmployeeFinanceMode {
  if (isPreviewIsolated()) return "mock";
  if (import.meta.env.VITE_HR_FINANCE_SECURE === "1") return "secure";
  // Default: live Team roster (Admin Lovable cloud via app_state).
  return "live";
}

/**
 * Synthetic MOCK employees + amber banners — opt-in only.
 * Never auto-enabled for production or normal local/dev builds.
 * Set VITE_SHOW_FINANCE_MOCK=1 or preview-isolated to exercise mock chrome.
 */
export function shouldShowFinanceMockUi(): boolean {
  if (isPreviewIsolated()) return true;
  if (import.meta.env.VITE_SHOW_FINANCE_MOCK === "1") return true;
  return false;
}

export function employeeFinanceModeLabel(mode: EmployeeFinanceMode = getEmployeeFinanceMode()): string {
  if (mode === "secure") return "Secure backend (Admin tables + audited RPCs)";
  if (mode === "live") return "Live Team roster (Admin cloud)";
  return "Mock session only — banking not persisted";
}
