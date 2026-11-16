import { describe, expect, it } from "vitest";
import { missedDaily, overdueTasks } from "@/admin/components/hr/Tasks";
import { openTasksDue } from "./hr-today";
import { normalizeTask, normalizeTasks, withNormalizedTasks } from "./normalize-tasks";

describe("normalizeTasks / TaskGate crash guards", () => {
  it("fills missing doneDays so .includes never throws", () => {
    const n = normalizeTask({
      id: "t1",
      title: "Daily check",
      kind: "daily",
      due: "2026-11-01",
      done: false,
    });
    expect(n?.doneDays).toEqual([]);
  });

  it("missedDaily tolerates legacy daily tasks without doneDays", () => {
    expect(() =>
      missedDaily([
        {
          id: "t1",
          title: "Check roster",
          kind: "daily",
          due: "2026-01-01",
          done: false,
        } as never,
      ]),
    ).not.toThrow();
  });

  it("overdueTasks and openTasksDue tolerate null / non-array tasks", () => {
    expect(overdueTasks(null)).toEqual([]);
    expect(openTasksDue(undefined, "2026-11-16")).toEqual([]);
    expect(normalizeTasks("nope")).toEqual([]);
  });

  it("withNormalizedTasks heals cloud payloads without dropping other keys", () => {
    const out = withNormalizedTasks({
      employees: [{ id: "e1" }],
      tasks: [{ id: "t1", title: "X", kind: "daily", due: "2026-11-01" }],
    });
    expect(out.employees).toEqual([{ id: "e1" }]);
    expect(normalizeTasks(out.tasks)[0]!.doneDays).toEqual([]);
  });
});
