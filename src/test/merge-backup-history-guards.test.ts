import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildSeed, type AppData } from "@/lib/sections";
import {
  applyDriverClass,
  applyRosterKind,
  classHistoryOf,
  healClassHistoryEntry,
  healRosterHistoryEntry,
  parseDriverClass,
  parseRosterKind,
  rosterHistoryOf,
} from "@/lib/driver-meta";
import { parseDriverStatus } from "@/lib/sections";
import { buildCompleteLoadHistory, awaitingCloseoutLoads } from "@/dispatch/lib/closeout";
import { isPersonalMeaningful } from "@/personal/lib/sync-protect";
import { healAttendanceBackupData } from "@/admin/components/hr/Settings";
import { buildComplianceHistory } from "@/lib/compliance-history";

describe("history / merge / backup corrupt guards", () => {
  it("status/class/roster parsers coerce non-string values before trim", () => {
    expect(parseDriverStatus(null)).toBe("active");
    expect(parseDriverClass(42 as unknown as string)).toBe("company");
    expect(parseRosterKind(true as unknown as string)).toBe("roster");
    expect(() => parseDriverClass({} as unknown as string)).not.toThrow();
  });

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

  it("class/roster history readers drop null slots and coerce from/to/at", () => {
    const at = 1_700_000_000_000;
    expect(healClassHistoryEntry(null)).toBeNull();
    expect(healClassHistoryEntry({ at, from: "oo", to: { x: 1 } })).toEqual({
      at,
      from: "owner_operator",
      to: "company",
    });
    expect(healRosterHistoryEntry({ at: "not-a-date", from: "new", to: "roster" })).toBeNull();
    expect(healRosterHistoryEntry({ at, from: "onboarding", to: "ROSTER" })).toEqual({
      at,
      from: "new",
      to: "roster",
    });

    const data = structuredClone(buildSeed()) as AppData;
    const id = data.sections.dmv.rows[0]!.driverId;
    data.sections.dmv.rows[0] = {
      ...data.sections.dmv.rows[0]!,
      classHistory: [
        null,
        { at, from: "company", to: "owner_operator" },
        "bad",
        { at: "x", from: "company", to: "company" },
      ] as unknown as [],
      rosterHistory: [
        undefined,
        { at, from: "new", to: "roster" },
        { from: "roster", to: "new" },
      ] as unknown as [],
    };
    expect(classHistoryOf(data, id)).toEqual([
      { at, from: "company", to: "owner_operator" },
    ]);
    expect(rosterHistoryOf(data, id)).toEqual([{ at, from: "new", to: "roster" }]);
    expect(() => buildComplianceHistory(data, { driverId: id, limit: 20 })).not.toThrow();
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
    expect(() =>
      isPersonalMeaningful({ vaultNotes: 123 as unknown as string }),
    ).not.toThrow();
    expect(isPersonalMeaningful({ vaultNotes: 123 as unknown as string })).toBe(false);
    const src = readFileSync(resolve(process.cwd(), "src/personal/lib/sync-protect.ts"), "utf8");
    expect(src).toMatch(/typeof blob\.vaultNotes === \"string\"/);
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
