import { weekday } from "./calc";
import type { DayRec, Dept, Employee } from "./types";

/** UI attendance variance vs Team department shift. Does not alter calc.ts / payroll. */
export type ShiftVarianceResult = {
  configured: boolean;
  /** Skip Late / Early Out / On Time chips (leave, absent, sat, half, natural extra day). */
  skipped: boolean;
  lateMin: number;
  lateLevel: "none" | "grace" | "late";
  earlyOutMin: number;
  onTime: boolean;
  shiftNotConfigured: boolean;
};

function isFiniteMin(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/** Adjust a punch onto the shift timeline when the shift crosses midnight. */
function onShiftTimeline(punch: number, end: number, overnight: boolean): number {
  if (!overnight) return punch;
  // Morning-side punch (at/before shift end clock) belongs to the post-midnight leg.
  if (punch <= end) return punch + 1440;
  return punch;
}

/**
 * Late / Early Out / On Time vs the employee's department shift from Team settings.
 * Grace comes from Settings (same source calc.ts uses). Saturday / half / natural
 * extra-day rows skip variance chips so short Saturday outs are not fake Early Out.
 */
export function shiftVariance(
  dept: Dept | undefined,
  r: DayRec,
  opts: { grace: number; date: string; employee?: Pick<Employee, "afterHours"> },
): ShiftVarianceResult {
  const empty: ShiftVarianceResult = {
    configured: false,
    skipped: true,
    lateMin: 0,
    lateLevel: "none",
    earlyOutMin: 0,
    onTime: false,
    shiftNotConfigured: true,
  };

  if (!dept || !isFiniteMin(dept.start) || !isFiniteMin(dept.end)) {
    const leaveOrAbsent = r.status === "leave" || r.status === "absent";
    return {
      ...empty,
      skipped: leaveOrAbsent,
      shiftNotConfigured: !leaveOrAbsent,
    };
  }

  if (r.status === "leave" || r.status === "absent") {
    return { ...empty, configured: true, skipped: true, shiftNotConfigured: false };
  }

  const wd = weekday(opts.date);
  const isSat = wd === 6;
  const isSun = wd === 0;
  const afterHours = !!opts.employee?.afterHours;
  const naturalExtraDay = (isSun && !afterHours) || (isSat && afterHours);
  const half = r.status === "half";

  // Match calc.ts: no late on Sat/half; Sat weekday-end Early Out is a false positive.
  if (isSat || half || naturalExtraDay) {
    return {
      configured: true,
      skipped: true,
      lateMin: 0,
      lateLevel: "none",
      earlyOutMin: 0,
      onTime: false,
      shiftNotConfigured: false,
    };
  }

  const start = dept.start;
  const overnight = dept.end <= dept.start;
  const end = overnight ? dept.end + 1440 : dept.end;
  const grace = Math.max(0, opts.grace);

  let lateMin = 0;
  let lateLevel: ShiftVarianceResult["lateLevel"] = "none";
  if (r.in != null && isFiniteMin(r.in)) {
    const pin = onShiftTimeline(r.in, dept.end, overnight);
    // Day shift: early arrival (pin < start) must NOT wrap +1440 (that produced Late +1428).
    // Overnight: morning-side pin is wrapped above; evening early (end < pin < start) stays as-is → negative late.
    const late = pin - start;
    if (late > 0) {
      lateMin = late;
      lateLevel = late <= grace ? "grace" : "late";
    }
  }

  let earlyOutMin = 0;
  if (r.out != null && isFiniteMin(r.out)) {
    const pout = onShiftTimeline(r.out, dept.end, overnight);
    const early = end - pout;
    if (early > grace) earlyOutMin = early;
  }

  const showLate = lateLevel === "late";
  // Under grace counts as On Time for the pill (calc still records grace separately).
  const onTime = (r.in != null || r.out != null) && !showLate && earlyOutMin === 0;

  return {
    configured: true,
    skipped: false,
    lateMin: showLate ? lateMin : 0,
    lateLevel,
    earlyOutMin,
    onTime,
    shiftNotConfigured: false,
  };
}
