import type { DayRec, Dept, Employee, Settings } from "./types";

/** Parse a pasted machine time ("5:59 AM", "05:59:12", "17:02") into minutes after midnight. */
export function parseTime(raw: unknown): number | null {
  if (raw == null) return null;
  const s = (typeof raw === "string" ? raw : String(raw)).trim().toLowerCase();
  if (!s) return null;
  const m = s.match(/(\d{1,2})[:.](\d{2})(?::\d{2})?\s*([ap])?\.?\s*m?/);
  if (!m) return null;
  let h = +m[1]!;
  const min = +m[2]!;
  if (min > 59 || h > 23) return null;
  if (m[3] === "p" && h < 12) h += 12;
  if (m[3] === "a" && h === 12) h = 0;
  return h * 60 + min;
}

export function fmtTime(m: number | null | undefined): string {
  if (m == null) return "";
  const t = ((m % 1440) + 1440) % 1440;
  const h = Math.floor(t / 60);
  const mm = t % 60;
  const ap = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(mm).padStart(2, "0")} ${ap}`;
}

export const fmtHours = (min: number) => (min / 60).toFixed(2);

/** Coerce YYYY-MM-DD before `.split("-")` — corrupt cloud/local may store numbers. */
function asDayIso(raw: unknown, fallback = "1970-01-01"): string {
  const s = raw == null ? "" : typeof raw === "string" ? raw : String(raw);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return fallback;
}

/** Coerce YYYY-MM month keys the same way. */
function asMonthKey(raw: unknown, fallback = "1970-01"): string {
  const s = raw == null ? "" : typeof raw === "string" ? raw : String(raw);
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.slice(0, 7);
  return fallback;
}

export function weekday(date: unknown) {
  const [y, mo, d] = asDayIso(date).split("-").map(Number) as [number, number, number];
  return new Date(y, mo - 1, d).getDay();
}

export function prettyDate(date: unknown) {
  const [y, mo, d] = asDayIso(date).split("-").map(Number) as [number, number, number];
  return new Date(y, mo - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
export function shortDate(date: unknown) {
  const [y, mo, d] = asDayIso(date).split("-").map(Number) as [number, number, number];
  return new Date(y, mo - 1, d).toLocaleDateString("en-US", { weekday: "short", day: "2-digit", month: "short" });
}

export type DayCalc = {
  isSat: boolean;
  isSun: boolean;
  shiftLen: number;
  worked: number | null; // minutes, break included (break is company time)
  expected: number; // expected minutes for the day
  lateMin: number;
  lateLevel: "none" | "grace" | "late";
  breakTaken: number | null;
  overBreak: number;
  breakLevel: "none" | "leeway" | "over";
  missing: ("in" | "bin" | "bout" | "out")[];
  missPunch: boolean;
  satTargetMiss: boolean;
  overtimeMin: number;
  extraDay: boolean;
  naturalExtraDay?: boolean; // Sunday (normal) / Saturday (after-hours)
  extraDayMin: number;
  shortMin: number;
  flags: string[]; // human readable, for notes
  violations: string[]; // flags that count against performance
};

const LABEL = { in: "punch in", bin: "break in", bout: "break out", out: "punch out" } as const;

/**
 * Core day calculation.
 * - Worked hours = punch out − punch in. Break is company time, so it is NOT subtracted.
 * - After-hours (overnight) employees only: any punch numerically smaller than punch in is moved +24h.
 * - Saturday: no late, no break; only a target (default 4h) must be met.
 * - Sunday: normal employee = additional day. After-hours employee = normal duty day.
 * - Saturday for after-hours employee = additional day.
 * - Overtime only counts when HR marks it (auto = worked − shift, or custom hours).
 */
export function calcDay(emp: Employee, dept: Dept | undefined, date: string, rec: DayRec, s: Settings): DayCalc {
  const wd = weekday(date);
  const isSat = wd === 6;
  const isSun = wd === 0;
  const start = dept?.start ?? 0;
  let shiftLen = (dept ? dept.end - dept.start : 600);
  if (shiftLen <= 0) shiftLen += 1440;

  const c: DayCalc = {
    isSat,
    isSun,
    shiftLen,
    worked: null,
    expected: 0,
    lateMin: 0,
    lateLevel: "none",
    breakTaken: null,
    overBreak: 0,
    breakLevel: "none",
    missing: [],
    missPunch: false,
    satTargetMiss: false,
    overtimeMin: 0,
    extraDay: false,
    extraDayMin: 0,
    shortMin: 0,
    flags: [],
    violations: [],
  };

  if (rec.status === "leave") {
    c.flags.push(rec.leavePaid ? "Paid leave" : "Unpaid leave");
    return c;
  }
  if (rec.status === "absent") {
    c.flags.push("Absent");
    c.violations.push("Absent");
    return c;
  }

  c.naturalExtraDay = (isSun && !emp.afterHours) || (isSat && emp.afterHours);
  const extraDayType = c.naturalExtraDay || !!rec.extraMarked;
  const noBreakDay = isSat || rec.noBreak;

  let pin = rec.in;
  let bin = noBreakDay ? null : rec.bin;
  let bout = noBreakDay ? null : rec.bout;
  let pout = rec.out;

  if (emp.afterHours && pin != null) {
    const adj = (v: number | null) => (v != null && v < pin! ? v + 1440 : v);
    pout = adj(pout);
    bin = adj(bin);
    bout = adj(bout);
  }

  // Missing punches (one miss-punch per day, no matter how many are missing)
  if (pin == null) c.missing.push("in");
  if (!noBreakDay) {
    if (bin == null) c.missing.push("bin");
    if (bout == null) c.missing.push("bout");
  }
  if (pout == null) c.missing.push("out");
  if (c.missing.length) {
    c.missPunch = true;
    c.flags.push(`Miss punch (${c.missing.map((k) => LABEL[k]).join(", ")})`);
    c.violations.push("Miss punch");
  }

  if (pin != null && pout != null && pout > pin) c.worked = pout - pin;

  const half = rec.status === "half";
  if (half) c.flags.push(`Half day${rec.halfReason ? `: ${rec.halfReason}` : ""}`);

  if (extraDayType) {
    c.extraDay = true;
    c.extraDayMin = rec.extraHours != null ? Math.round(rec.extraHours * 60) : c.worked ?? 0;
    c.flags.push(`Additional day (${fmtHours(c.extraDayMin)} h)`);
    return c;
  }

  if (isSat) {
    c.expected = Math.round(s.satTargetHours * 60);
    if (c.worked != null && c.worked < c.expected) {
      c.satTargetMiss = true;
      c.shortMin = c.expected - c.worked;
      const f = `Saturday target missed (${fmtHours(c.worked)} of ${s.satTargetHours} h)`;
      c.flags.push(f);
      c.violations.push(f);
    }
    if (rec.otMarked && c.worked != null) {
      c.overtimeMin = rec.otMode === "custom" ? Math.round(rec.otHours * 60) : Math.max(0, c.worked - c.expected);
    }
  } else {
    c.expected = half ? Math.round(shiftLen / 2) : shiftLen;
    // Late
    if (pin != null && !half) {
      const late = pin - start;
      if (late > 0) {
        c.lateMin = late;
        if (late <= s.grace) {
          c.lateLevel = "grace";
          c.flags.push(`Late ${late} min (under grace)`);
        } else {
          c.lateLevel = "late";
          c.flags.push(`Late ${late} min`);
          c.violations.push(`Late ${late} min`);
        }
      }
    }
    // Break
    if (rec.noBreak) c.flags.push("No break");
    else if (bin != null && bout != null && bout >= bin) {
      c.breakTaken = bout - bin;
      const over = c.breakTaken - s.breakMin;
      if (over > 0) {
        c.overBreak = over;
        if (over <= s.breakLeeway) {
          c.breakLevel = "leeway";
          c.flags.push(`${over} min over break (leeway)`);
        } else {
          c.breakLevel = "over";
          c.flags.push(`${over} min over break`);
          c.violations.push(`${over} min over break`);
        }
      }
    }
    if (c.worked != null && c.worked < c.expected && !c.missPunch) c.shortMin = c.expected - c.worked;
    if (rec.otMarked && c.worked != null) {
      c.overtimeMin = rec.otMode === "custom" ? Math.round(rec.otHours * 60) : Math.max(0, c.worked - shiftLen);
    }
    if (emp.afterHours && rec.doubleShift && c.worked != null) {
      const ext = rec.extraHours != null ? Math.round(rec.extraHours * 60) : Math.max(0, c.worked - shiftLen);
      c.extraDay = true;
      c.extraDayMin = ext;
      c.overtimeMin = 0;
      c.flags.push(ext >= shiftLen ? `Double shift: full additional day (${fmtHours(ext)} h)` : `Double shift: additional ${fmtHours(ext)} h`);
      return c;
    }
  }
  if (c.overtimeMin > 0) c.flags.push(`Over time ${fmtHours(c.overtimeMin)} h`);
  return c;
}

export function monthDays(month: unknown) {
  const key = asMonthKey(month);
  const [y, m] = key.split("-").map(Number) as [number, number, number];
  const n = new Date(y, m, 0).getDate();
  return Array.from({ length: n }, (_, i): string => `${key}-${String(i + 1).padStart(2, "0")}`);
}

/** Paid leave balance available on `date` (excludes that date). 1 leave accrues per month from joinMonth. */
export function leaveBalance(
  emp: Employee,
  date: unknown,
  records: Record<string, Record<string, DayRec>>,
): number {
  const dayIso = asDayIso(date);
  const month = dayIso.slice(0, 7);
  const [jy, jm] = asMonthKey(emp?.joinMonth).split("-").map(Number) as [number, number, number];
  const [y, m] = month.split("-").map(Number) as [number, number, number];
  const accrued = Math.max(0, (y - jy) * 12 + (m - jm) + 1);
  let used = 0;
  const days =
    records && typeof records === "object" && !Array.isArray(records) ? records : {};
  for (const [d, day] of Object.entries(days)) {
    if (d === dayIso || d.slice(0, 7) > month) continue;
    if (!day || typeof day !== "object" || Array.isArray(day)) continue;
    const r = day[emp.id];
    if (r?.status === "leave" && r.leavePaid) used++;
  }
  return emp.openingLeave + accrued - used;
}
