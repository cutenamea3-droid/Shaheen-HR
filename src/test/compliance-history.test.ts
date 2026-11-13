import { describe, expect, test } from "vitest";
import { buildSeed, type Row } from "@/lib/sections";
import { applyDriverClass, applyRosterKind } from "@/lib/driver-meta";
import {
  buildComplianceHistory,
  complianceHistoryEmptyMessage,
  historySourceLabel,
} from "@/lib/compliance-history";
import { recordSensitiveAudit, clearSensitiveAudit, listSensitiveAudit } from "@/lib/driver-hr/sensitive-audit";

function row(partial: Partial<Row> & { cells: string[] }): Row {
  return {
    id: partial.id ?? "r1",
    driverId: partial.driverId ?? "d1",
    cells: partial.cells,
    ...(partial.addedAt != null ? { addedAt: partial.addedAt } : {}),
  };
}

describe("compliance history timeline", () => {
  test("reuses addedAt, class/roster history, portal + sensitive audit — no invented events", () => {
    clearSensitiveAudit();
    let data = buildSeed();
    for (const id of Object.keys(data.sections)) data.sections[id].rows = [];
    const addedAt = Date.UTC(2026, 0, 15, 12);
    data.sections.dmv.rows = [
      row({
        id: "dmv1",
        driverId: "d_hist",
        cells: ["History Driver", "1", "Valid", "2027-01-01", "", "", "Active", "", "CA", ""],
        addedAt,
      }),
    ];
    data = applyDriverClass(data, "d_hist", "owner_operator", Date.UTC(2026, 1, 1));
    data = applyRosterKind(data, "d_hist", "new", Date.UTC(2026, 1, 2));

    recordSensitiveAudit({
      actor: "tester",
      action: "drug_test_list",
      driverId: "d_hist",
      detail: "n=0",
    });

    const events = buildComplianceHistory(data, {
      portalActivity: [
        {
          id: "p1",
          actor_name: "Admin",
          action: "Updated History Driver medical status",
          section_id: "medical",
          occurred_at: "2026-03-01T10:00:00.000Z",
        },
        {
          id: "p2",
          actor_name: "Admin",
          action: "Updated unrelated section",
          section_id: "docs",
          occurred_at: "2026-03-02T10:00:00.000Z",
        },
      ],
      sensitiveAudit: listSensitiveAudit(10),
      driverId: "d_hist",
    });

    expect(events.some((e) => e.source === "added_at")).toBe(true);
    expect(events.some((e) => e.source === "class_history")).toBe(true);
    expect(events.some((e) => e.source === "roster_history")).toBe(true);
    expect(events.some((e) => e.source === "portal_activity" && e.detail.includes("History Driver"))).toBe(
      true,
    );
    // Unattributable portal event excluded when filtering by driver
    expect(events.some((e) => e.detail.includes("unrelated"))).toBe(false);
    expect(events.some((e) => e.source === "sensitive_audit")).toBe(true);

    // No fabricated "inspection passed" style events
    expect(events.every((e) => !/invented|fabricat/i.test(e.detail))).toBe(true);
    expect(historySourceLabel("portal_activity")).toMatch(/portal/i);
    expect(complianceHistoryEmptyMessage(true)).toMatch(/invented/i);
  });

  test("empty driver with no history returns empty list", () => {
    const data = buildSeed();
    for (const id of Object.keys(data.sections)) data.sections[id].rows = [];
    data.sections.dmv.rows = [
      row({
        id: "x",
        driverId: "lonely",
        cells: ["Lonely", "1", "Valid", "2027-01-01", "", "", "Active", "", "CA", ""],
      }),
    ];
    const events = buildComplianceHistory(data, { driverId: "lonely", portalActivity: [] });
    expect(events).toEqual([]);
  });
});
