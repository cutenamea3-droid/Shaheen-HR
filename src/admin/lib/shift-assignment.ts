import type { Dept, DeptAssignment, Employee } from "./types";

function asDay(v: unknown): string {
  return v == null ? "" : typeof v === "string" ? v : String(v);
}

/**
 * Resolve which department (shift) applied to an employee on a given date.
 * Uses `deptAssignments` history when present; otherwise falls back to `deptId`.
 * Does not invent policy — preserves historical effective dates for Late/Early display.
 */
export function resolveDeptIdAsOf(
  emp: Pick<Employee, "deptId" | "deptAssignments" | "joinMonth">,
  date: unknown,
): string {
  const day = asDay(date);
  const assignments = normalizeAssignments(emp);
  let best: DeptAssignment | null = null;
  for (const a of assignments) {
    const from = asDay(a.effectiveFrom);
    if (from <= day && (!best || from > asDay(best.effectiveFrom))) {
      best = a;
    }
  }
  return best?.deptId ?? emp.deptId;
}

export function resolveDeptAsOf(
  emp: Pick<Employee, "deptId" | "deptAssignments" | "joinMonth">,
  depts: Dept[],
  date: unknown,
): Dept | undefined {
  const id = resolveDeptIdAsOf(emp, date);
  const list = Array.isArray(depts) ? depts : [];
  return list.find((d) => d.id === id);
}

/** Sorted copy of assignments (oldest first). Seeds current deptId when history is empty. */
export function normalizeAssignments(
  emp: Pick<Employee, "deptId" | "deptAssignments" | "joinMonth">,
): DeptAssignment[] {
  const raw = emp.deptAssignments;
  if (Array.isArray(raw) && raw.length > 0) {
    return [...raw]
      .map((a) => ({
        ...a,
        effectiveFrom: asDay(a?.effectiveFrom),
      }))
      .filter((a) => a && typeof a.deptId === "string" && /^\d{4}-\d{2}-\d{2}$/.test(a.effectiveFrom))
      .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  }
  const join = asDay(emp.joinMonth);
  const from = /^\d{4}-\d{2}$/.test(join) ? `${join}-01` : "1970-01-01";
  return [{ deptId: emp.deptId, effectiveFrom: from }];
}

/**
 * Apply a department change while preserving prior effective-dated rows.
 * If the same dept is already current as of `effectiveFrom`, returns unchanged history.
 */
export function appendDeptAssignment(
  emp: Pick<Employee, "deptId" | "deptAssignments" | "joinMonth">,
  nextDeptId: string,
  effectiveFrom: unknown,
): { deptId: string; deptAssignments: DeptAssignment[] } {
  const rawDay = asDay(effectiveFrom);
  const day = /^\d{4}-\d{2}-\d{2}$/.test(rawDay)
    ? rawDay
    : new Date().toISOString().slice(0, 10);
  const existing = normalizeAssignments(emp);
  const asOf = resolveDeptIdAsOf({ ...emp, deptAssignments: existing }, day);
  if (asOf === nextDeptId) {
    return { deptId: nextDeptId, deptAssignments: existing };
  }
  // Drop same-day prior row for this effectiveFrom (edit same day), keep all earlier history.
  const kept = existing.filter((a) => asDay(a.effectiveFrom) !== day);
  return {
    deptId: nextDeptId,
    deptAssignments: [...kept, { deptId: nextDeptId, effectiveFrom: day }].sort((a, b) =>
      asDay(a.effectiveFrom).localeCompare(asDay(b.effectiveFrom)),
    ),
  };
}
