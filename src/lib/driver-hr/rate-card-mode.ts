/**
 * Driver Rate Card backend mode.
 * Default: mock (session memory) until Driver migration is applied AND flag enabled.
 * NEVER write rate cards into tracker_sections / seed / localStorage AppData.
 */
import { isPreviewIsolated } from "@/lib/preview-isolated";

export type DriverRateCardMode = "mock" | "secure";

/** Explicit opt-in. Preview-isolated builds always stay on mock. */
export function getDriverRateCardMode(): DriverRateCardMode {
  if (isPreviewIsolated()) return "mock";
  if (import.meta.env.VITE_DRIVER_RATE_CARD_SECURE === "1") return "secure";
  return "mock";
}

export function driverRateCardModeLabel(mode: DriverRateCardMode = getDriverRateCardMode()): string {
  return mode === "secure"
    ? "Secure backend (admin-only rate table)"
    : "Mock session only — rates not persisted to cloud";
}
