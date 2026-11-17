import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildSeed, type AppData } from "@/lib/sections";
import { applyDriverClass, applyRosterKind, classHistoryOf } from "@/lib/driver-meta";
import { buildCompleteLoadHistory, awaitingCloseoutLoads } from "@/dispatch/lib/closeout";
import { isPersonalMeaningful } from "@/personal/lib/sync-protect";
import { healAttendanceBackupData } from "@/admin/components/hr/Settings";

describe("history / merge / backup corrupt guards", () => {
  it("class/roster history spreads tolerate non-array history", () => {
    const data = structuredClone(buildSeed()) as AppData;
    const id = data.sections.dmv.rows[0]!.driverId;
    data.sections.dmv.rows[0] = {
      ...data.sections.dmv.rows[0]!,
      classHistory: { bad: true } as unknown as [],
      rosterHistory: "nope" as unknown as [],
    };
    expect(() => applyDriverClass(data, id, "owner_operator")).not.toThrow();
    expect(() => applyRosterKind(data, id, "new")).not.toThrow();
    expect(classHistoryOf(data, id)).toEqual([]);
  });

  it("Dispatch complete history + awaitingCloseout tolerate missing arrays", () => {
    const load = {
      id: "L1",
      load_number: "X",
      status: "delivered",
      updated_at: "2026-01-01T00:00:00Z",
      created_at: "2026-01-01T00:00:00Z",
    } as Parameters<typeof buildCompleteLoadHistory>[0]["load"];
    expect(() =>
      buildCompleteLoadHistory({
        load,
        checkCalls: null as unknown as [],
        issues: { x: 1 } as unknown as [],
        followUps: undefined as unknown as [],
        communications: "bad" as unknown as [],
        accessorials: 1 as unknown as [],
      }),
    ).not.toThrow();
    expect(awaitingCloseoutLoads(null as unknown as [])).toEqual([]);
  });

  it("isPersonalMeaningful never throws on corrupt slices", () => {
    expect(
      isPersonalMeaningful({
        notes: { bad: true } as unknown as [],
        discipline: { x: 1 } as unknown as [],
        dayPlans: [] as unknown as Record<string, never>,
        weeklyReviews: ["no"] as unknown as Record<string, never>,
        vaultNotes: "",
      }),
    ).toBe(false);
  });

  it("Personal push merge uses Array.isArray before mergeById", () => {
    const src = readFileSync(resolve(process.cwd(), "src/personal/lib/cloud-sync.ts"), "utf8");
    expect(src).toMatch(/asArr\(local\.notes\)/);
    expect(src).toMatch(/asArr\(cloud\?\.notes\)/);
  });

  it("Admin healAttendanceBackupData coerces corrupt slices", () => {
    const healed = healAttendanceBackupData(
      {
        employees: [{ id: "e-audit", name: "Audit Emp" }],
        depts: [{ id: "d1", name: "Ops" }],
        tasks: { corrupt: true },
        team: "nope",
        logs: null,
        records: [],
        perf: "x",
        settings: null,
      },
      {
        depts: [],
        employees: [],
        team: [{ id: "t1" }],
        logs: [{ id: "l1" }],
        records: { keep: true },
        perf: { keep: true },
        settings: { company: "Shaheen" },
      },
    );
    expect(Array.isArray(healed.tasks)).toBe(true);
    expect(healed.tasks).toEqual([]);
    expect(Array.isArray(healed.team)).toBe(true);
    expect(healed.team).toEqual([{ id: "t1" }]);
    expect(Array.isArray(healed.logs)).toBe(true);
    expect(healed.records).toEqual({ keep: true });
    expect(healed.settings).toEqual({ company: "Shaheen" });
    expect(healed.employees).toEqual([{ id: "e-audit", name: "Audit Emp" }]);
  });
});
