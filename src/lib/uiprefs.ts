/**
 * Remember UI-only filter / layout preferences in localStorage.
 * Never write driver, employee, payroll, or auth data here.
 */

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export type DriverCardsPrefs = {
  listScope?: "company" | "owner_operator" | "new";
  statusFilter?: "active" | "leave" | "inactive" | "all";
  exp?: "all" | "expired" | "d15" | "d30" | "compliant";
  tempNotesOnly?: boolean;
};

export type DataTablePrefs = {
  listScope?: "company" | "owner_operator" | "new";
  filter?: "all" | "active" | "inactive";
};

export type DashboardPrefs = {
  af?: "active" | "inactive" | "all";
  exp?: "all" | "expired" | "d15" | "d30" | "compliant";
  cat?: "all" | "expired" | "soon" | "applied" | "missing" | "notes";
};

export type AttendancePrefs = {
  focus?: "all" | "active" | "leave" | "inactive" | "missing" | "review";
  /** Employee ids forced open/closed; omitted = density default. */
  expanded?: Record<string, boolean>;
};

const DRIVER_CARDS = "shaheen-ui-pref-driver-cards";
const DATA_TABLE = (sectionId: string) => `shaheen-ui-pref-table-${sectionId}`;
const DASHBOARD = "shaheen-ui-pref-dashboard";
const ATTENDANCE = "shaheen-ui-pref-attendance";

export function loadDriverCardsPrefs(): DriverCardsPrefs {
  return readJson<DriverCardsPrefs>(DRIVER_CARDS) ?? {};
}
export function saveDriverCardsPrefs(p: DriverCardsPrefs) {
  writeJson(DRIVER_CARDS, { ...loadDriverCardsPrefs(), ...p });
}

export function loadDataTablePrefs(sectionId: string): DataTablePrefs {
  return readJson<DataTablePrefs>(DATA_TABLE(sectionId)) ?? {};
}
export function saveDataTablePrefs(sectionId: string, p: DataTablePrefs) {
  writeJson(DATA_TABLE(sectionId), { ...loadDataTablePrefs(sectionId), ...p });
}

export function loadDashboardPrefs(): DashboardPrefs {
  return readJson<DashboardPrefs>(DASHBOARD) ?? {};
}
export function saveDashboardPrefs(p: DashboardPrefs) {
  writeJson(DASHBOARD, { ...loadDashboardPrefs(), ...p });
}

export function loadAttendancePrefs(): AttendancePrefs {
  return readJson<AttendancePrefs>(ATTENDANCE) ?? {};
}
export function saveAttendancePrefs(p: AttendancePrefs) {
  writeJson(ATTENDANCE, { ...loadAttendancePrefs(), ...p });
}
