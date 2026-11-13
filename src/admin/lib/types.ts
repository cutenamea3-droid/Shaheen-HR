export type Dept = { id: string; name: string; start: number; end: number };

/** Historical department/shift assignment — Late/Early resolve as-of attendance date. */
export type DeptAssignment = {
  deptId: string;
  /** YYYY-MM-DD inclusive start for this assignment. */
  effectiveFrom: string;
};

export type Employee = {
  id: string;
  name: string;
  deptId: string;
  afterHours: boolean;
  joinMonth: string; // YYYY-MM, leave accrual starts here
  openingLeave: number; // saved paid leaves carried in
  /**
   * Optional history of department (shift) assignments.
   * When missing, `deptId` is treated as current (seeded from joinMonth-01).
   * Changing department appends — never rewrites prior effective dates.
   */
  deptAssignments?: DeptAssignment[];
};
export type Status = "present" | "leave" | "absent" | "half";
export type DayRec = {
  status: Status;
  in: number | null;
  bin: number | null;
  bout: number | null;
  out: number | null;
  noBreak: boolean;
  otMarked: boolean;
  otMode: "auto" | "custom";
  otHours: number;
  extraHours: number | null; // custom hours for an additional day
  doubleShift?: boolean; // after-hours: stayed past normal shift, extra time counts as additional day
  extraMarked?: boolean; // HR manually marks any day as an additional day
  leavePaid: boolean;
  halfReason: string;
  note: string;
};
export type Rating = "excellent" | "good" | "average" | "needs" | "poor";
export type Perf = { rating: Rating | ""; note: string };
export type Task = {
  id: string;
  title: string;
  kind: "dated" | "daily";
  due: string; // YYYY-MM-DD (dated) or start date (daily)
  done: boolean; // dated only
  doneDays: string[]; // daily only
};
export type Settings = {
  company: string;
  grace: number;
  breakMin: number;
  breakLeeway: number;
  satTargetHours: number;
  overpay: boolean;
};

export const emptyRec = (): DayRec => ({
  status: "present",
  in: null,
  bin: null,
  bout: null,
  out: null,
  noBreak: false,
  otMarked: false,
  otMode: "auto",
  otHours: 0,
  extraHours: null,
  leavePaid: true,
  halfReason: "",
  note: "",
});

export const RATING_LABEL: Record<Rating, string> = {
  excellent: "Excellent",
  good: "Good",
  average: "Average",
  needs: "Needs improvement",
  poor: "Poor",
};

export type Role = "admin" | "standard";
export type TeamMember = { id: string; name: string; email: string; role: Role; active: boolean };
export type LogEntry = { id: string; at: number; who: string; action: string; count?: number };
