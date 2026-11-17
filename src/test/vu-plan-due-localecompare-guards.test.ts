import { describe, expect, it } from "vitest";
import {
  dueSoonTodos,
  overdueTodos,
  pendencyTodos,
  VU_STUDY_PLAN,
} from "@/personal/lib/vu-plan";
import { pairDrugTestEvents } from "@/lib/driver-hr/drug-tests";
import { listRosterDrivers } from "@/lib/driver-hr/roster-drivers";
import { buildSeed } from "@/lib/sections";

describe("VU due / drug / roster localeCompare coerce", () => {
  it("pendencyTodos / dueSoonTodos / overdueTodos tolerate non-string due", () => {
    const plan = {
      ...VU_STUDY_PLAN,
      todos: [
        {
          kind: "quiz",
          courseCode: "CS101",
          title: "Q1",
          due: 20261120 as unknown as string,
          windowStart: "2026-11-01",
          windowEnd: "2026-11-30",
        },
      ],
    } as never;
    expect(() => pendencyTodos(plan, "2026-11-17")).not.toThrow();
    expect(() => dueSoonTodos(plan, "2026-11-17", 14)).not.toThrow();
    expect(() => overdueTodos(plan, "2026-12-01")).not.toThrow();
  });

  it("pairDrugTestEvents / listRosterDrivers sort without throw on seed", () => {
    expect(() => pairDrugTestEvents([])).not.toThrow();
    expect(() => listRosterDrivers(buildSeed())).not.toThrow();
  });
});
