/**
 * Drug Test register backend mode.
 * Default mock (session memory) — never localStorage / tracker_sections.
 */
import { isPreviewIsolated } from "@/lib/preview-isolated";

export type DriverDrugTestMode = "mock" | "secure";

export function getDriverDrugTestMode(): DriverDrugTestMode {
  if (isPreviewIsolated()) return "mock";
  if (import.meta.env.VITE_DRIVER_DRUG_TESTS_SECURE === "1") return "secure";
  return "mock";
}

export function driverDrugTestModeLabel(mode: DriverDrugTestMode = getDriverDrugTestMode()): string {
  return mode === "secure"
    ? "Secure backend (admin RPCs + audit)"
    : "Mock session only — not in shared driver JSON";
}
