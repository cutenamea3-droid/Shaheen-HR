import { SECTIONS, type AppData, type Row, type SectionDef } from "./sections";

export type Tone = "danger" | "warn" | "info" | "note" | "ok" | "sign" | "muted";

export interface Issue {
  tone: Tone;
  label: string;
  col: number;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

export function today() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
export function parseISO(v: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3]);
}
export const daysUntil = (d: Date) => Math.round((d.getTime() - today().getTime()) / 86400000);
export function fmtDate(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
export function fmtCell(v: string) {
  const d = parseISO(v);
  return d ? fmtDate(d) : v;
}

/** Pull a date out of free text like "I will Apply On December 12 , 2026 (Saturday)". */
export function parsePlanDate(text: string): Date | null {
  if (!text) return null;
  const iso = parseISO(text);
  if (iso) return iso;
  const low = text.toLowerCase();
  const mm = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/.exec(low);
  const yy = /\b(20\d{2})\b/.exec(low);
  if (!mm || !yy) return null;
  const nums = [...low.matchAll(/\b(\d{1,2})\b/g)].map((m) => +m[1]).filter((n) => n >= 1 && n <= 31);
  if (!nums.length) return null;
  return new Date(+yy[1], MONTHS.indexOf(mm[1]), nums[0]);
}

export function normStatus(v: string): string {
  const k = v.toLowerCase().replace(/[^a-z]/g, "");
  if (!k) return "";
  if (k === "valid") return "Valid";
  if (k.startsWith("applied")) return "Applied";
  if (k === "invalid") return "Invalid";
  if (k.startsWith("missing")) return "Missing";
  if (k.includes("sign")) return "Sign Missing";
  if (k.startsWith("expired")) return "Expired";
  return v.trim();
}
export function statusTone(v: string): Tone {
  switch (normStatus(v)) {
    case "Valid": return "ok";
    case "Applied": return "info";
    case "Invalid": case "Missing": case "Expired": return "danger";
    case "Sign Missing": return "sign";
    case "": return "muted";
    default: return "warn";
  }
}

const filled = (v: string | undefined) => !!v && v.trim() !== "";

/** Case-insensitive "old" in an expiration cell — skip amber/red for that column. */
export function isOldExpiry(v: string) {
  return (v ?? "").toLowerCase().includes("old");
}

/**
 * Suggest an apply-on plan from an expiration: expiry − daysBefore.
 * Example: `"I will Apply on April 23 (Friday), 2027"`.
 */
export function suggestApplyPlan(expiry: string, daysBefore = 14): string | null {
  if (!expiry || isOldExpiry(expiry)) return null;
  const d = parseISO(expiry);
  if (!d) return null;
  const a = new Date(d);
  a.setDate(a.getDate() - daysBefore);
  const month = a.toLocaleDateString("en-US", { month: "long" });
  const weekday = a.toLocaleDateString("en-US", { weekday: "long" });
  return `I will Apply on ${month} ${a.getDate()} (${weekday}), ${a.getFullYear()}`;
}

function dateIssue(v: string, days: number, col: number, what: string): Issue | null {
  if (isOldExpiry(v)) return null;
  const d = parseISO(v);
  if (!d) {
    if (normStatus(v) === "Missing") return { tone: "danger", label: `${what} missing`, col };
    return null;
  }
  const left = daysUntil(d);
  if (left < 0) return { tone: "danger", label: `${what} expired ${-left}d ago`, col };
  if (left <= days) return { tone: "warn", label: `${what} expires in ${left}d`, col };
  return null;
}

function statusIssue(v: string, col: number, header: string): Issue | null {
  const s = normStatus(v);
  if (s === "Applied") return { tone: "info", label: `${header.trim()}: Applied`, col };
  if (s === "Missing" || s === "Invalid" || s === "Expired")
    return { tone: "danger", label: `${header.trim()}: ${s}`, col };
  if (s === "Sign Missing") return { tone: "sign", label: `${header.trim()}: Sign missing`, col };
  return null;
}

export const dmvDays = (state: string) => (state.trim().toUpperCase() === "CA" ? 10 : 20);

/** Returns row issues and the per-cell highlight tone map. */
export function analyzeRow(def: SectionDef, headers: string[], row: Row) {
  const c = row.cells;
  const issues: Issue[] = [];
  const push = (i: Issue | null) => i && issues.push(i);
  const noteIssues = () =>
    def.types.forEach((t, i) => {
      // Temporary Note (tempnote) never yellow-highlights.
      if (t === "note" && filled(c[i])) push({ tone: "note", label: `${headers[i].trim()}: note`, col: i });
    });
  switch (def.id) {
    case "dmv": {
      push(statusIssue(c[2], 2, "DMV Pull Notice"));
      const di = dateIssue(c[3], dmvDays(c[8]), 3, "DMV");
      push(di);
      if (di) issues.push({ tone: di.tone, label: "Future plan: apply now", col: 7 });
      const rep = c[4].trim().toUpperCase();
      if (rep && rep !== "NONE" && normStatus(c[4]) !== "Applied") push({ tone: "note", label: `Report: ${c[4].trim()}`, col: 4 });
      else if (normStatus(c[4]) === "Applied") push({ tone: "info", label: "Report: Applied", col: 4 });
      noteIssues();
      break;
    }
    case "medical": {
      push(statusIssue(c[1], 1, "Medical"));
      push(dateIssue(c[2], 15, 2, "Medical"));
      const d = parseISO(c[2]);
      if (d && !isOldExpiry(c[2]) && daysUntil(d) <= 17) push({ tone: daysUntil(d) < 0 ? "danger" : "warn", label: "Future plan: call driver", col: 6 });
      noteIssues();
      break;
    }
    case "queries": {
      // Annual (cols 1–2) and Pre-Employment (cols 3–4) evaluated independently.
      push(statusIssue(c[1], 1, "Annual Query"));
      const qa = dateIssue(c[2], 14, 2, "Annual Query");
      push(qa);
      push(statusIssue(c[3], 3, "Pre-Employment Query"));
      const qp = dateIssue(c[4], 14, 4, "Pre-Emp Query");
      push(qp);
      if (qa) issues.push({ tone: qa.tone, label: "Annual future plan: apply now", col: 6 });
      if (qp) issues.push({ tone: qp.tone, label: "Pre-Emp future plan: apply now", col: 7 });
      noteIssues();
      break;
    }
    case "ssccdl": {
      push(statusIssue(c[2], 2, "CDL"));
      const cd = dateIssue(c[3], 30, 3, "CDL");
      push(cd);
      if (cd) issues.push({ tone: cd.tone, label: "Future plan: CDL renewal", col: 7 });
      push(statusIssue(c[4], 4, "SSC"));
      if (normStatus(c[5]) === "Missing") push({ tone: "danger", label: "SSN missing", col: 5 });
      noteIssues();
      break;
    }
    case "docs": {
      for (let i = 2; i <= 13; i++) {
        const s = normStatus(c[i]);
        if (s !== "Valid") push(statusIssue(c[i], i, headers[i]) ?? { tone: "danger", label: `${headers[i]}: empty`, col: i });
      }
      noteIssues();
      break;
    }
    case "info": {
      [1, 2].forEach((i) => {
        if (!filled(c[i]) || normStatus(c[i]) === "Invalid") push({ tone: "danger", label: `${headers[i]}: ${c[i].trim() || "empty"}`, col: i });
      });
      break;
    }
  }
  const cellTone: Record<number, Tone> = {};
  const rank: Tone[] = ["danger", "warn", "sign", "info", "note"];
  for (const i of issues) {
    const cur = cellTone[i.col];
    if (!cur || rank.indexOf(i.tone) < rank.indexOf(cur)) cellTone[i.col] = i.tone;
  }
  return { issues, cellTone };
}

export function complianceScore(row: Row) {
  let valid = 0;
  for (let i = 2; i <= 13; i++) if (normStatus(row.cells[i]) === "Valid") valid++;
  let score = (valid / 12) * 100;
  if (filled(row.cells[14])) score -= 5;
  return Math.max(0, Math.round(score));
}

export function rowIsActive(def: SectionDef, row: Row, data: AppData) {
  const idx = def.types.indexOf("active");
  if (idx >= 0) return row.cells[idx].trim().toLowerCase() !== "inactive";
  // sections without a status column follow the driver's DMV / other status
  for (const s of SECTIONS) {
    const i = s.types.indexOf("active");
    if (i < 0 || s.id === "inactive") continue;
    const r = data.sections[s.id].rows.find((x) => x.driverId === row.driverId);
    if (r) return r.cells[i].trim().toLowerCase() !== "inactive";
  }
  return true;
}

export interface PlanItem {
  date: Date;
  sectionId: string;
  rowId: string;
  driver: string;
  text: string;
  derived: boolean;
}

export function collectPlans(data: AppData): PlanItem[] {
  const out: PlanItem[] = [];
  for (const def of SECTIONS) {
    const sec = data.sections[def.id];
    for (const row of sec.rows) {
      if (!rowIsActive(def, row, data)) continue;
      def.types.forEach((t, i) => {
        if (t !== "plan") return;
        const txt = row.cells[i];
        const d = parsePlanDate(txt);
        if (d) out.push({ date: d, sectionId: def.id, rowId: row.id, driver: row.cells[0], text: txt.trim(), derived: false });
      });
      // DMV rows without a written plan: derive apply date from expiration
      if (def.id === "dmv" && !row.cells[7].trim()) {
        const e = parseISO(row.cells[3]);
        if (e) {
          const d = new Date(e);
          d.setDate(d.getDate() - dmvDays(row.cells[8]));
          out.push({ date: d, sectionId: "dmv", rowId: row.id, driver: row.cells[0], text: "Apply DMV pull notice (auto from expiration)", derived: true });
        }
      }
    }
  }
  return out.sort((a, b) => a.date.getTime() - b.date.getTime());
}

/** Expiration toolbar filters (Dashboard + Driver Cards). */
export type ExpFilter = "all" | "expired" | "d15" | "d30" | "compliant";

export const EXP_FILTERS: { id: ExpFilter; label: string; tone?: string }[] = [
  { id: "all", label: "All Drivers" },
  { id: "expired", label: "Expired (Red)", tone: "danger" },
  { id: "d15", label: "Expiring in 15 Days", tone: "warn" },
  { id: "d30", label: "Expiring in 30 Days", tone: "warn" },
  { id: "compliant", label: "Fully Compliant", tone: "ok" },
];

/** Date columns that drive expiration alerts (section → cell indexes). */
const EXPIRY_COLS: Record<string, number[]> = {
  dmv: [3],
  medical: [2],
  queries: [2, 4],
  ssccdl: [3],
};

/** Days-until for every parseable expiry date on a driver (skips "Old"). */
export function driverExpiryDays(data: AppData, driverId: string): number[] {
  const out: number[] = [];
  for (const [sid, cols] of Object.entries(EXPIRY_COLS)) {
    const row = data.sections[sid]?.rows.find((r) => r.driverId === driverId);
    if (!row) continue;
    for (const i of cols) {
      const v = row.cells[i] ?? "";
      if (isOldExpiry(v)) continue;
      if (normStatus(v) === "Expired") {
        out.push(-1);
        continue;
      }
      const d = parseISO(v);
      if (d) out.push(daysUntil(d));
    }
  }
  return out;
}

export type OverallExpStatus = "Expired" | "Expiring Soon" | "Compliant";

/** Worst expiration bucket for a driver. */
export function overallExpStatus(data: AppData, driverId: string): OverallExpStatus {
  const days = driverExpiryDays(data, driverId);
  if (days.some((n) => n < 0)) return "Expired";
  if (days.some((n) => n <= 30)) return "Expiring Soon";
  return "Compliant";
}

export function matchesExpFilter(data: AppData, driverId: string, filter: ExpFilter): boolean {
  if (filter === "all") return true;
  const days = driverExpiryDays(data, driverId);
  if (filter === "expired") return days.some((n) => n < 0);
  if (filter === "d15") return days.some((n) => n >= 0 && n <= 15);
  if (filter === "d30") return days.some((n) => n >= 0 && n <= 30);
  // Fully Compliant — nothing expired and nothing within 30 days
  return !days.some((n) => n < 0 || n <= 30);
}
