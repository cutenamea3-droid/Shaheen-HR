import type { Dept, DeptAssignment, Employee } from "./types";

/**
 * Resolve which department (shift) applied to an employee on a given date.
 * Uses `deptAssignments` history when present; otherwise falls back to `deptId`.
 * Does not invent policy — preserves historical effective dates for Late/Early display.
 */
export function resolveDeptIdAsOf(
  emp: Pick<Employee, "deptId" | "deptAssignments" | "joinMonth">,
  date: string,
): string {
  const assignments = normalizeAssignments(emp);
  let best: DeptAssignment | null = null;
  for (const a of assignments) {
    if (a.effectiveFrom <= date && (!best || a.effectiveFrom > best.effectiveFrom)) {
      best = a;
    }
  }
  return best?.deptId ?? emp.deptId;
}

export function resolveDeptAsOf(
  emp: Pick<Employee, "deptId" | "deptAssignments" | "joinMonth">,
  depts: Dept[],
  date: string,
): Dept | undefined {
  const id = resolveDeptIdAsOf(emp, date);
  return depts.find((d) => d.id === id);
}

/** Sorted copy of assignments (oldest first). Seeds current deptId when history is empty. */
export function normalizeAssignments(
  emp: Pick<Employee, "deptId" | "deptAssignments" | "joinMonth">,
): DeptAssignment[] {
  const raw = emp.deptAssignments;
  if (Array.isArray(raw) && raw.length > 0) {
    return [...raw]
      .filter((a) => a && typeof a.deptId === "string" && /^\d{4}-\d{2}-\d{2}$/.test(a.effectiveFrom))
      .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  }
  const from =
    emp.joinMonth && /^\d{4}-\d{2}$/.test(emp.joinMonth) ? `${emp.joinMonth}-01` : "1970-01-01";
  return [{ deptId: emp.deptId, effectiveFrom: from }];
}

/**
 * Apply a department change while preserving prior effective-dated rows.
 * If the same dept is already current as of `effectiveFrom`, returns unchanged history.
 */
export function appendDeptAssignment(
  emp: Pick<Employee, "deptId" | "deptAssignments" | "joinMonth">,
  nextDeptId: string,
  effectiveFrom: string,
): { deptId: string; deptAssignments: DeptAssignment[] } {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)
    ? effectiveFrom
    : new Date().toISOString().slice(0, 10);
  const existing = normalizeAssignments(emp);
  const asOf = resolveDeptIdAsOf({ ...emp, deptAssignments: existing }, day);
  if (asOf === nextDeptId) {
    return { deptId: nextDeptId, deptAssignments: existing };
  }
  // Drop same-day prior row for this effectiveFrom (edit same day), keep all earlier history.
  const kept = existing.filter((a) => a.effectiveFrom !== day);
  return {
    deptId: nextDeptId,
    deptAssignments: [...kept, { deptId: nextDeptId, effectiveFrom: day }].sort((a, b) =>
      a.effectiveFrom.localeCompare(b.effectiveFrom),
    ),
  };
}
