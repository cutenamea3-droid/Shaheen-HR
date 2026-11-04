import { describe, expect, it } from "vitest";
import { parseTime } from "./calc";
import { shiftVariance } from "./shift-variance";
import { emptyRec, type DayRec, type Dept, type Employee } from "./types";
import seed from "@/admin/data/seed.json";

const grace = 15;
const WED = "2026-10-21"; // Wednesday
const SAT = "2026-10-03"; // Saturday (seed day with ~10:xx AM outs)
const SUN = "2026-10-25";

const dayDept: Dept = { id: "d", name: "HR & Compliance", start: 360, end: 960 }; // 6 AM – 4 PM
const dispatch: Dept = { id: "z", name: "Dispatch", start: 300, end: 900 }; // 5 AM – 3 PM
const nightDept: Dept = { id: "n", name: "After Hours", start: 1020, end: 300 }; // 5 PM – 5 AM

const emp: Employee = { id: "e", name: "A", deptId: "d", afterHours: false, joinMonth: "2026-10", openingLeave: 0 };
const nightEmp: Employee = { ...emp, afterHours: true, deptId: "n" };

const rec = (partial: Partial<DayRec> = {}): DayRec => ({ ...emptyRec(), ...partial });

describe("shiftVariance — in punches", () => {
  it("early arrival is On Time, not Late (no +1440 wrap)", () => {
    const v = shiftVariance(dayDept, rec({ in: parseTime("5:48 AM") }), { grace, date: WED, employee: emp });
    expect(v.lateMin).toBe(0);
    expect(v.lateLevel).toBe("none");
    expect(v.onTime).toBe(true);
  });

  it("exact start is On Time", () => {
    const v = shiftVariance(dayDept, rec({ in: parseTime("6:00 AM"), out: parseTime("4:00 PM") }), { grace, date: WED, employee: emp });
    expect(v.lateLevel).toBe("none");
    expect(v.earlyOutMin).toBe(0);
    expect(v.onTime).toBe(true);
  });

  it("12 min late is under grace → On Time pill, lateLevel grace", () => {
    const v = shiftVariance(dayDept, rec({ in: parseTime("6:12 AM") }), { grace, date: WED, employee: emp });
    expect(v.lateLevel).toBe("grace");
    expect(v.lateMin).toBe(0); // pill suppressed under grace
    expect(v.onTime).toBe(true);
  });

  it("16 min late shows Late (+16)", () => {
    const v = shiftVariance(dayDept, rec({ in: parseTime("6:16 AM") }), { grace, date: WED, employee: emp });
    expect(v.lateLevel).toBe("late");
    expect(v.lateMin).toBe(16);
    expect(v.onTime).toBe(false);
  });
});

describe("shiftVariance — out punches", () => {
  it("on-time out at shift end", () => {
    const v = shiftVariance(dayDept, rec({ in: parseTime("6:00 AM"), out: parseTime("4:00 PM") }), { grace, date: WED, employee: emp });
    expect(v.earlyOutMin).toBe(0);
    expect(v.onTime).toBe(true);
  });

  it("early out beyond grace", () => {
    const v = shiftVariance(dayDept, rec({ in: parseTime("6:00 AM"), out: parseTime("3:00 PM") }), { grace, date: WED, employee: emp });
    expect(v.earlyOutMin).toBe(60);
    expect(v.onTime).toBe(false);
  });

  it("stayed past end is not Early Out", () => {
    const v = shiftVariance(dayDept, rec({ in: parseTime("6:00 AM"), out: parseTime("5:00 PM") }), { grace, date: WED, employee: emp });
    expect(v.earlyOutMin).toBe(0);
    expect(v.onTime).toBe(true);
  });

  it("early out within grace is On Time", () => {
    const v = shiftVariance(dayDept, rec({ in: parseTime("6:00 AM"), out: parseTime("3:50 PM") }), { grace, date: WED, employee: emp });
    expect(v.earlyOutMin).toBe(0);
    expect(v.onTime).toBe(true);
  });
});

describe("shiftVariance — overnight", () => {
  it("overnight on-time 5 PM – 5 AM", () => {
    const v = shiftVariance(nightDept, rec({ in: parseTime("5:00 PM"), out: parseTime("5:00 AM") }), {
      grace,
      date: WED,
      employee: nightEmp,
    });
    expect(v.lateMin).toBe(0);
    expect(v.earlyOutMin).toBe(0);
    expect(v.onTime).toBe(true);
  });

  it("overnight late in and early out", () => {
    const v = shiftVariance(nightDept, rec({ in: parseTime("5:30 PM"), out: parseTime("4:30 AM") }), {
      grace,
      date: WED,
      employee: nightEmp,
    });
    expect(v.lateMin).toBe(30);
    expect(v.earlyOutMin).toBe(30);
    expect(v.onTime).toBe(false);
  });

  it("overnight early arrival before start is not Late", () => {
    const v = shiftVariance(nightDept, rec({ in: parseTime("4:50 PM"), out: parseTime("5:00 AM") }), {
      grace,
      date: WED,
      employee: nightEmp,
    });
    expect(v.lateLevel).toBe("none");
    expect(v.lateMin).toBe(0);
  });
});

describe("shiftVariance — per-employee dept + missing shift", () => {
  it("uses that employee department start/end", () => {
    // Dispatch 5 AM: 5:06 is 6 min late → grace; HR 6 AM: 5:06 is early → on time
    const atDispatch = shiftVariance(dispatch, rec({ in: parseTime("5:06 AM") }), { grace, date: WED, employee: emp });
    const atHr = shiftVariance(dayDept, rec({ in: parseTime("5:06 AM") }), { grace, date: WED, employee: emp });
    expect(atDispatch.lateLevel).toBe("grace");
    expect(atHr.lateLevel).toBe("none");
    expect(atHr.onTime).toBe(true);
  });

  it("missing dept → Shift Not Configured", () => {
    const v = shiftVariance(undefined, rec({ in: parseTime("6:00 AM") }), { grace, date: WED, employee: emp });
    expect(v.shiftNotConfigured).toBe(true);
    expect(v.lateMin).toBe(0);
    expect(v.earlyOutMin).toBe(0);
    expect(v.onTime).toBe(false);
  });
});

describe("shiftVariance — reproduce live bogus Late / Early Out from seed shapes", () => {
  const seedDepts = (seed as { depts: Dept[] }).depts;
  const hr = seedDepts.find((d) => d.name === "HR & Compliance")!;
  const safety = seedDepts.find((d) => d.name === "Safety")!;

  it("5:48 AM vs HR 6:00 AM was Late +1428; now On Time", () => {
    // Old bug: pin < start → +1440 → 348+1440-360 = 1428
    expect(348 + 1440 - 360).toBe(1428);
    const v = shiftVariance(hr, rec({ in: 348, out: 994 }), { grace, date: "2026-10-01", employee: emp });
    expect(v.lateMin).toBe(0);
    expect(v.lateLevel).toBe("none");
    expect(v.onTime).toBe(true);
  });

  it("5:06 AM vs 6:00 AM was Late +1386; now On Time (early)", () => {
    expect(306 + 1440 - 360).toBe(1386);
    const v = shiftVariance(safety, rec({ in: 306 }), { grace, date: WED, employee: emp });
    expect(v.lateMin).toBe(0);
    expect(v.onTime).toBe(true);
  });

  it("Saturday ~10:55 AM out is not Early Out vs weekday 3 PM end", () => {
    const booking = seedDepts.find((d) => d.name === "Booking")!;
    // 10:55 AM = 655; weekday end 900 → would be 245 min early under old day-shift compare
    expect(900 - 655).toBe(245);
    const v = shiftVariance(booking, rec({ in: 320, out: 655 }), { grace, date: SAT, employee: emp });
    expect(v.skipped).toBe(true);
    expect(v.earlyOutMin).toBe(0);
    expect(v.lateMin).toBe(0);
  });

  it("weekday 10:55 AM out vs 3 PM end is Early Out", () => {
    const v = shiftVariance(dispatch, rec({ in: parseTime("5:00 AM"), out: parseTime("10:55 AM") }), {
      grace,
      date: WED,
      employee: emp,
    });
    expect(v.earlyOutMin).toBe(900 - 655);
  });
});

describe("shiftVariance — leave / Sunday extra day", () => {
  it("leave skips variance chips", () => {
    const v = shiftVariance(dayDept, rec({ status: "leave", in: parseTime("7:00 AM") }), { grace, date: WED, employee: emp });
    expect(v.skipped).toBe(true);
    expect(v.lateMin).toBe(0);
  });

  it("Sunday natural extra day for normal staff skips variance", () => {
    const v = shiftVariance(dayDept, rec({ in: parseTime("6:00 AM"), out: parseTime("4:00 PM") }), {
      grace,
      date: SUN,
      employee: emp,
    });
    expect(v.skipped).toBe(true);
  });
});
