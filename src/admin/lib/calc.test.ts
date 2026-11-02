import { describe, expect, it } from "vitest";
import { calcDay, parseTime } from "./calc";
import { emptyRec, type Employee, type Settings } from "./types";

const s: Settings = { company: "", grace: 15, breakMin: 45, breakLeeway: 3, satTargetHours: 4, overpay: true };
const dept = { id: "d", name: "Dispatch", start: 300, end: 900 }; // 5 AM – 3 PM
const emp: Employee = { id: "e", name: "A", deptId: "d", afterHours: false, joinMonth: "2026-10", openingLeave: 0 };
const night: Employee = { ...emp, afterHours: true };
const nightDept = { id: "n", name: "Night", start: 1020, end: 180 }; // 5 PM – 3 AM
const rec = (a: string, b: string, c: string, d: string, extra = {}) => ({
  ...emptyRec(), in: parseTime(a), bin: parseTime(b), bout: parseTime(c), out: parseTime(d), ...extra,
});
const WED = "2026-10-21", SAT = "2026-10-24", SUN = "2026-10-25";

describe("attendance rules", () => {
  it("12 min late is under grace, 16 min is late", () => {
    expect(calcDay(emp, dept, WED, rec("5:12 AM", "9:00 AM", "9:45 AM", "3:00 PM"), s).lateLevel).toBe("grace");
    expect(calcDay(emp, dept, WED, rec("5:16 AM", "9:00 AM", "9:45 AM", "3:00 PM"), s).lateLevel).toBe("late");
  });
  it("break up to 48 min is leeway, 49 is over", () => {
    expect(calcDay(emp, dept, WED, rec("5:00 AM", "9:00 AM", "9:48 AM", "3:00 PM"), s).breakLevel).toBe("leeway");
    expect(calcDay(emp, dept, WED, rec("5:00 AM", "9:00 AM", "9:49 AM", "3:00 PM"), s).breakLevel).toBe("over");
  });
  it("break is not subtracted from worked hours", () => {
    expect(calcDay(emp, dept, WED, rec("5:00 AM", "9:00 AM", "10:00 AM", "3:00 PM"), s).worked).toBe(600);
  });
  it("marked auto overtime for 5 to 5 is 2 hours", () => {
    expect(calcDay(emp, dept, WED, rec("5:00 AM", "9:00 AM", "9:45 AM", "5:00 PM", { otMarked: true }), s).overtimeMin).toBe(120);
  });
  it("unmarked overtime counts zero", () => {
    expect(calcDay(emp, dept, WED, rec("5:00 AM", "9:00 AM", "9:45 AM", "5:00 PM"), s).overtimeMin).toBe(0);
  });
  it("missing several punches counts as one miss punch", () => {
    const c = calcDay(emp, dept, WED, rec("5:00 AM", "", "", ""), s);
    expect(c.missPunch).toBe(true);
    expect(c.missing).toHaveLength(3);
  });
  it("overnight employee 5 PM to 3 AM works 10 h with no miss punch", () => {
    const c = calcDay(night, nightDept, WED, rec("5:00 PM", "11:00 PM", "12:30 AM", "3:00 AM"), s);
    expect(c.worked).toBe(600);
    expect(c.missPunch).toBe(false);
    expect(c.breakTaken).toBe(90);
  });
  it("normal employee crossing midnight is not adjusted", () => {
    expect(calcDay(emp, nightDept, WED, rec("5:00 PM", "", "", "3:00 AM", { noBreak: true }), s).worked).toBeNull();
  });
  it("Saturday: no late, target 4 h", () => {
    const c = calcDay(emp, dept, SAT, rec("6:00 AM", "", "", "10:30 AM"), s);
    expect(c.lateLevel).toBe("none");
    expect(c.missPunch).toBe(false);
    expect(c.satTargetMiss).toBe(false);
    expect(calcDay(emp, dept, SAT, rec("6:00 AM", "", "", "9:30 AM"), s).satTargetMiss).toBe(true);
  });
  it("Sunday is an additional day for normal staff, duty for after-hours", () => {
    expect(calcDay(emp, dept, SUN, rec("5:00 AM", "9:00 AM", "9:45 AM", "3:00 PM"), s).extraDay).toBe(true);
    expect(calcDay(night, dept, SUN, rec("5:00 AM", "9:00 AM", "9:45 AM", "3:00 PM"), s).extraDay).toBe(false);
  });
  it("Saturday is an additional day for after-hours staff with custom hours", () => {
    const c = calcDay(night, dept, SAT, rec("9:00 AM", "", "", "1:00 PM", { extraHours: 3.5 }), s);
    expect(c.extraDay).toBe(true);
    expect(c.extraDayMin).toBe(210);
  });
});

describe("manual additional day", () => {
  it("any weekday can be ticked as an additional day", () => {
    const r = { ...emptyRec(), in: 300, out: 600, extraMarked: true };
    const c = calcDay(emp, undefined, "2026-10-21", r, s);
    expect(c.extraDay).toBe(true);
    expect(c.extraDayMin).toBe(300);
  });
  it("after-hours double shift: 20 h on Sunday = full additional day", () => {
    const c = calcDay(night, nightDept, SUN, rec("5:00 PM", "11:00 PM", "11:45 PM", "1:00 PM", { doubleShift: true }), s);
    expect(c.worked).toBe(1200);
    expect(c.extraDay).toBe(true);
    expect(c.extraDayMin).toBe(600);
  });
  it("after-hours double shift: 16 h gives 6 additional hours", () => {
    const c = calcDay(night, nightDept, WED, rec("5:00 PM", "11:00 PM", "11:45 PM", "9:00 AM", { doubleShift: true }), s);
    expect(c.extraDayMin).toBe(360);
  });
});
