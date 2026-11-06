/**
 * Driver Rate Card — sensitive pay rates for Driver Compliance profiles.
 *
 * NEVER store these in tracker_sections / seed.json / broadly readable JSON.
 * Values are optional decimal STRINGS (blank ≠ 0; preserve "0.550").
 * Independent of Admin attendance / payroll / settlements / compliance docs.
 */

export type RatePayMethod =
  | ""
  | "per_mile"
  | "percentage"
  | "hourly"
  | "salary"
  | "combination"
  | "other";

export const RATE_PAY_METHOD_OPTIONS: { value: RatePayMethod; label: string }[] = [
  { value: "", label: "—" },
  { value: "per_mile", label: "Per mile" },
  { value: "percentage", label: "Percentage" },
  { value: "hourly", label: "Hourly" },
  { value: "salary", label: "Salary" },
  { value: "combination", label: "Combination" },
  { value: "other", label: "Other" },
];

export type RateFieldGroup = "general" | "hourly" | "additional";

export interface RateFieldDef {
  key: string;
  label: string;
  group: RateFieldGroup;
  /** Short hint under the label (optional). */
  hint?: string;
}

/** Catalog — all optional; never invent defaults. */
export const RATE_FIELD_DEFS: readonly RateFieldDef[] = [
  { key: "loadedCpm", label: "Loaded CPM", group: "general" },
  { key: "emptyCpm", label: "Empty CPM", group: "general" },
  { key: "percentage", label: "Percentage", group: "general" },
  { key: "flatTrip", label: "Flat trip", group: "general" },
  { key: "detention", label: "Detention", group: "general" },
  { key: "layover", label: "Layover", group: "general" },
  { key: "regularHourly", label: "Regular hourly", group: "hourly" },
  { key: "overtimeHourly", label: "Overtime hourly", group: "hourly" },
  { key: "stopPay", label: "Stop pay", group: "additional" },
  { key: "dropHook", label: "Drop & hook", group: "additional" },
  { key: "fuelSurcharge", label: "Fuel surcharge", group: "additional" },
  { key: "bonus", label: "Bonus", group: "additional" },
  { key: "perDiem", label: "Per diem", group: "additional" },
  { key: "otherAmount", label: "Other amount", group: "additional" },
] as const;

export const RATE_GROUP_LABEL: Record<RateFieldGroup, string> = {
  general: "General",
  hourly: "Hourly",
  additional: "Additional",
};

export type RateCardRates = Record<string, string>;

export interface DriverRateCard {
  driverId: string;
  /** Optional decimal strings keyed by RATE_FIELD_DEFS.key — omit or "" means blank (not zero). */
  rates: RateCardRates;
  payMethod: RatePayMethod;
  payMethodNote: string;
  updatedAt: number;
}

/** Empty card — no invented rates. */
export function emptyRateCard(driverId: string): DriverRateCard {
  return {
    driverId,
    rates: {},
    payMethod: "",
    payMethodNote: "",
    updatedAt: Date.now(),
  };
}

/**
 * Normalize a rate input for storage.
 * - Trim; empty → "" (never coerce to "0")
 * - Preserve significant decimals (e.g. "0.550" stays "0.550")
 * - Reject non-numeric garbage → returns null (caller should keep previous / show error)
 */
export function normalizeRateInput(raw: string): string | null {
  const t = raw.trim();
  if (!t) return "";
  // Allow optional leading +/-, digits, one decimal point; no scientific notation invent.
  if (!/^[+-]?\d+(\.\d+)?$/.test(t) && !/^[+-]?\.\d+$/.test(t)) return null;
  // Keep the typed form (do not Number() round-trip — that drops trailing zeros).
  return t.replace(/^\+/, "");
}

export function rateDisplay(value: string | undefined | null): string {
  const t = (value ?? "").trim();
  return t || "";
}

/** True when the card has any non-blank rate or pay method. */
export function rateCardHasContent(card: DriverRateCard | null | undefined): boolean {
  if (!card) return false;
  if (card.payMethod) return true;
  if (card.payMethodNote.trim()) return true;
  return Object.values(card.rates).some((v) => (v ?? "").trim() !== "");
}
