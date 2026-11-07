/**
 * Drug Test register backend mode.
 * Production path: secure RPCs only. Never treat mock/localStorage as a real save.
 * When secure is unavailable, UI must show an error and disable saving.
 */
import { isPreviewIsolated } from "@/lib/preview-isolated";

export type DriverDrugTestMode = "mock" | "secure";

export function getDriverDrugTestMode(): DriverDrugTestMode {
  if (isPreviewIsolated()) return "mock";
  if (import.meta.env.VITE_DRIVER_DRUG_TESTS_SECURE === "1") return "secure";
  return "mock";
}

/** True only when mutations go through Driver Supabase admin RPCs. */
export function canPersistDrugTests(): boolean {
  return getDriverDrugTestMode() === "secure";
}

export function drugTestPersistBlockedReason(
  mode: DriverDrugTestMode = getDriverDrugTestMode(),
): string | null {
  if (mode === "secure") return null;
  if (isPreviewIsolated()) {
    return "Preview isolated mode — drug test saving is disabled (no mock fallback as a real save).";
  }
  return "Secure drug test backend is not enabled (VITE_DRIVER_DRUG_TESTS_SECURE≠1). Saving is disabled — records are not written to mock or localStorage.";
}

export function driverDrugTestModeLabel(mode: DriverDrugTestMode = getDriverDrugTestMode()): string {
  return mode === "secure"
    ? "Secure backend (admin RPCs + audit)"
    : "Secure backend off — saving disabled";
}

export const DRUG_TEST_SECURE_REQUIRED =
  "Secure drug test backend required. Enable VITE_DRIVER_DRUG_TESTS_SECURE=1 after Driver SQL is applied.";
