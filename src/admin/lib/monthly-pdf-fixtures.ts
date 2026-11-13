/**
 * Fixture datasets for monthly PDF rendering / total verification.
 * Synthetic only — does not touch production storage.
 */
import { emptyRec, type DayRec, type Dept, type Employee, type Perf, type Settings } from "./types";
import type { Data } from "./reports";

const settings: Settings = {
  company: "Shaheen Transport LLC",
  grace: 15,
  breakMin: 45,
  breakLeeway: 3,
  satTargetHours: 4,
  overpay: true,
};

const depts: Dept[] = [
  { id: "d1", name: "Dispatch", start: 300, end: 900 },
  { id: "d2", name: "Accounts", start: 420, end: 1020 },
  { id: "d3", name: "After Hours", start: 1020, end: 300 },
];

function emp(id: string, name: string, deptId: string, afterHours = false): Employee {
  return { id, name, deptId, afterHours, joinMonth: "2026-10", openingLeave: 0 };
}

function present(inM: number, bin: number, bout: number, out: number, extra: Partial<DayRec> = {}): DayRec {
  return { ...emptyRec(), status: "present", in: inM, bin, bout, out, ...extra };
}

/** Clean small roster — mostly on-time October weekdays. */
export function fixtureCleanOctober(): Data {
  const employees = [emp("e1", "Ali Clean", "d1"), emp("e2", "Sara Steady", "d2")];
  const records: Data["records"] = {};
  const perf: Data["perf"] = {};
  for (const day of ["2026-10-01", "2026-10-02", "2026-10-03"]) {
    records[day] = {
      e1: present(300, 540, 585, 900),
      e2: present(420, 660, 705, 1020),
    };
    perf[day] = {
      e1: { rating: "good", note: "" },
      e2: { rating: "excellent", note: "" },
    };
  }
  return { depts, employees, records, perf, settings };
}

/** Messy: lates, over break, miss punch, absent, unpaid leave, half day, long notes. */
export function fixtureMessyOctober(): Data {
  const employees = [
    emp("m1", "Late Liam", "d1"),
    emp("m2", "Break Bella", "d1"),
    emp("m3", "Missing Mo", "d2"),
    emp("m4", "Absent Ava", "d2"),
  ];
  const longNote =
    "Employee reported traffic delay near industrial zone; supervisor notified by phone. " +
    "Follow-up scheduled for next week. Additional context retained for HR audit trail only. ".repeat(3);
  const records: Data["records"] = {
    "2026-10-01": {
      m1: present(320, 540, 585, 900, { note: "Stuck in traffic" }), // 20m late
      m2: present(300, 540, 600, 900, { note: "Long lunch" }), // 60m break
      m3: { ...emptyRec(), status: "present", in: 420, bin: null, bout: null, out: null, note: "Left early for clinic" },
      m4: { ...emptyRec(), status: "absent", note: "No call" },
    },
    "2026-10-02": {
      m1: present(300, 540, 585, 900),
      m2: { ...emptyRec(), status: "half", in: 300, out: 600, noBreak: true, halfReason: "Family appointment", note: longNote },
      m3: { ...emptyRec(), status: "leave", leavePaid: false, note: "Unpaid personal" },
      m4: present(420, 660, 705, 1020, { note: "Back from absence" }),
    },
    "2026-10-03": {
      m1: present(300, 540, 585, 900, { otMarked: true, otMode: "auto", out: 1020 }), // OT
      m2: present(300, 540, 585, 900),
      m3: present(420, 660, 705, 1020),
      m4: present(420, 660, 705, 1020),
    },
  };
  const perf: Data["perf"] = {
    "2026-10-01": {
      m1: { rating: "needs", note: "Repeated late arrival this week" },
      m2: { rating: "average", note: "Break discipline" },
      m3: { rating: "poor", note: "Missed punches" },
      m4: { rating: "", note: "" },
    },
    "2026-10-02": {
      m2: { rating: "good", note: "Half day documented" },
    },
    "2026-10-03": {
      m1: { rating: "excellent", note: "Covered OT voluntarily" },
    },
  };
  return { depts, employees, records, perf, settings };
}

/** OT + additional Sunday + after-hours Saturday. */
export function fixtureOtAndExtra(): Data {
  const employees = [emp("o1", "Omar OT", "d1"), emp("o2", "Nadia Night", "d3", true)];
  const records: Data["records"] = {
    "2026-10-21": {
      o1: present(300, 540, 585, 1020, { otMarked: true, otMode: "auto" }),
      o2: present(1020, 1260, 1305, 180),
    },
    "2026-10-24": {
      o1: { ...emptyRec(), status: "present", in: 360, out: 600, noBreak: true },
      o2: { ...emptyRec(), status: "present", in: 540, out: 780, noBreak: true, extraHours: 4 },
    },
    "2026-10-25": {
      o1: present(300, 540, 585, 900),
      o2: present(1020, 1260, 1305, 180),
    },
  };
  const perf: Data["perf"] = {};
  return { depts, employees, records, perf, settings };
}

/** Multi-department medium roster. */
export function fixtureMultiDept(): Data {
  const employees = [
    emp("a", "A Dispatch", "d1"),
    emp("b", "B Accounts", "d2"),
    emp("c", "C Night", "d3", true),
    emp("d", "D Dispatch", "d1"),
    emp("e", "E Accounts", "d2"),
  ];
  const records: Data["records"] = {};
  const perf: Data["perf"] = {};
  for (const day of ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09"]) {
    records[day] = {};
    perf[day] = {};
    for (const e of employees) {
      if (e.afterHours) records[day]![e.id] = present(1020, 1260, 1305, 180);
      else if (e.deptId === "d2") records[day]![e.id] = present(420, 660, 705, 1020);
      else records[day]![e.id] = present(300, 540, 585, 900);
      perf[day]![e.id] = { rating: "good", note: "" };
    }
  }
  return { depts, employees, records, perf, settings };
}

/** Missing data — employees on roster with no month records. */
export function fixtureMissingData(): Data {
  const employees = [emp("x1", "Has Data", "d1"), emp("x2", "No Data Yet", "d2"), emp("x3", "Also Empty", "d1")];
  return {
    depts,
    employees,
    records: {
      "2026-10-01": { x1: present(300, 540, 585, 900) },
    },
    perf: { "2026-10-01": { x1: { rating: "average", note: "Only one day" } } },
    settings,
  };
}

/** Large roster — 40 employees × ~10 days for pagination stress. */
export function fixtureLargeRoster(count = 40): Data {
  const employees = Array.from({ length: count }, (_, i) =>
    emp(`L${i}`, `Employee ${String(i + 1).padStart(2, "0")}`, i % 2 === 0 ? "d1" : "d2", false),
  );
  const days = Array.from({ length: 12 }, (_, i) => `2026-10-${String(i + 1).padStart(2, "0")}`);
  const records: Data["records"] = {};
  const perf: Data["perf"] = {};
  for (const day of days) {
    records[day] = {};
    perf[day] = {};
    for (const e of employees) {
      const late = e.id.endsWith("3");
      records[day]![e.id] = present(late ? 330 : 300, 540, late ? 600 : 585, 900, {
        note: late ? `Late note ${day}` : "",
        otMarked: e.id.endsWith("7"),
        otMode: "auto",
        out: e.id.endsWith("7") ? 1020 : 900,
      });
      if (late) {
        perf[day]![e.id] = { rating: "needs", note: `Performance follow-up ${day}` };
      } else {
        perf[day]![e.id] = { rating: "good", note: "" };
      }
    }
  }
  return { depts, employees, records, perf, settings };
}

export type { Perf };
