/**
 * Date of Hire helpers — optional MM/DD/YYYY or ISO, clearable, never invent.
 * Stored as Row.dateOfHire (ISO YYYY-MM-DD or "") mirrored across compliance rows.
 */
import { parseISO, today } from "@/lib/alerts";
import type { AppData, Row, SectionDef } from "@/lib/sections";
import { SECTIONS } from "@/lib/sections";
import { mapDriverRows } from "@/lib/driver-meta";

/** Parse picker ISO or typed MM/DD/YYYY → ISO, "" for clear, null if invalid. */
export function parseHireDateInput(raw: string): string | null {
  const t = raw.trim();
  if (!t) return "";
  if (parseISO(t)) return t.trim();
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  if (!m) return null;
  const mm = m[1]!.padStart(2, "0");
  const dd = m[2]!.padStart(2, "0");
  const yyyy = m[3]!;
  const iso = `${yyyy}-${mm}-${dd}`;
  return parseISO(iso) ? iso : null;
}

/** Display as MM/DD/YYYY when ISO; otherwise raw text. */
export function formatHireDateDisplay(value: string | undefined | null): string {
  const t = (value ?? "").trim();
  if (!t) return "";
  const d = parseISO(t);
  if (!d) return t;
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${d.getFullYear()}`;
}

export function dateOfHireOf(data: AppData, driverId: string): string {
  for (const def of SECTIONS) {
    const r = data.sections[def.id]?.rows.find((x) => x.driverId === driverId);
    if (r && r.dateOfHire !== undefined) return (r.dateOfHire ?? "").trim();
  }
  return "";
}

export function applyDateOfHire(data: AppData, driverId: string, next: string): AppData {
  const prev = dateOfHireOf(data, driverId);
  const value = (next ?? "").trim();
  if (prev === value) return data;
  return mapDriverRows(data, driverId, (r: Row, _def: SectionDef) => ({
    ...r,
    dateOfHire: value,
  }));
}

export type LengthOfService = {
  years: number;
  months: number;
  days: number;
  label: string;
};

/** Length of service from hire date to asOf (default today). Empty hire → null. */
export function lengthOfService(hireIso: string, asOf: Date = today()): LengthOfService | null {
  const d = parseISO(hireIso);
  if (!d) return null;
  if (d.getTime() > asOf.getTime()) {
    return { years: 0, months: 0, days: 0, label: "Future hire date" };
  }
  let years = asOf.getFullYear() - d.getFullYear();
  let months = asOf.getMonth() - d.getMonth();
  let days = asOf.getDate() - d.getDate();
  if (days < 0) {
    months -= 1;
    const prevMonth = new Date(asOf.getFullYear(), asOf.getMonth(), 0);
    days += prevMonth.getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  const parts: string[] = [];
  if (years > 0) parts.push(`${years}y`);
  if (months > 0) parts.push(`${months}mo`);
  if (days > 0 || parts.length === 0) parts.push(`${days}d`);
  return { years, months, days, label: parts.join(" ") };
}
