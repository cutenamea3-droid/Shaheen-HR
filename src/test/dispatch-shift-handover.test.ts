import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/preview-isolated", () => ({
  isPreviewIsolated: () => true,
}));

/**
 * Batch 7 acceptance: Shift Handover morning continuity with isolated test data only.
 * Does not invent locations/ETAs/GPS; does not touch Compliance/Admin/Personal stores.
 */
describe("Batch 7 Shift Handover acceptance (isolated fixtures)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("night desk saves handover of open loads; morning lists the same isolated ids", async () => {
    const cloud = await import("@/dispatch/lib/cloud");
    cloud.resetDispatchFixtureMemory();

    const drivers = await cloud.listRosterDrivers();
    expect(drivers.length).toBeGreaterThan(0);
    const driver = drivers[0];

    // Isolated Batch 7 loads — unique numbers so fixture seeds are irrelevant.
    const openA = await cloud.saveLoad({
      load_number: "B7-HANDOVER-A",
      status: "in_transit",
      customer_name: "Batch7 Isolated Shipper",
      assigned_driver_id: driver.id,
      assigned_driver_name: driver.display_name,
      last_manual_location: "I-94 MP 12 (manual)",
      last_manual_location_at: new Date().toISOString(),
    });
    const openB = await cloud.saveLoad({
      load_number: "B7-HANDOVER-B",
      status: "at_pickup",
      customer_name: "Batch7 Isolated Consignee",
      assigned_driver_id: driver.id,
      assigned_driver_name: driver.display_name,
    });
    const delivered = await cloud.saveLoad({
      load_number: "B7-HANDOVER-DEL",
      status: "delivered",
      assigned_driver_id: driver.id,
      assigned_driver_name: driver.display_name,
      bol_status: "pending",
      pod_status: "missing",
    });
    // Closed load must not be treated as open continuity work.
    await cloud.saveLoad({
      load_number: "B7-HANDOVER-CLOSED",
      status: "closed",
      assigned_driver_id: driver.id,
      assigned_driver_name: driver.display_name,
    });

    const all = await cloud.listLoads();
    const openForHandover = all.filter(
      (l) =>
        l.load_number.startsWith("B7-HANDOVER-") &&
        (l.status !== "closed" && l.status !== "cancelled"),
    );
    expect(openForHandover.map((l) => l.load_number).sort()).toEqual(
      ["B7-HANDOVER-A", "B7-HANDOVER-B", "B7-HANDOVER-DEL"].sort(),
    );

    await cloud.addCheckCall({
      load_id: openA.id,
      notes: "Night check-call — driver OK",
      manual_location: "I-94 MP 12 (manual)",
    });
    const calls = await cloud.listCheckCalls(openA.id);
    expect(calls[0]?.manual_location).toBe("I-94 MP 12 (manual)");
    expect(JSON.stringify(calls).toLowerCase()).not.toContain("live gps");
    expect(JSON.stringify(calls).toLowerCase()).not.toContain("eta");

    const handover = await cloud.saveHandover({
      shift_date: "2026-11-13",
      from_dispatcher: "Night Desk (B7)",
      to_dispatcher: "Morning Desk (B7)",
      summary: "Carry B7-HANDOVER-A/B; close DEL after POD — isolated test only.",
      open_load_ids: [openA.id, openB.id, delivered.id],
      watch_items: "Call shipper on B7-HANDOVER-B appointment (manual note).",
      next_day_priorities: "1) Update A location 2) Collect POD for DEL",
    });

    expect(handover.from_dispatcher).toBe("Night Desk (B7)");
    expect(handover.to_dispatcher).toBe("Morning Desk (B7)");
    expect(handover.open_load_ids).toEqual(
      expect.arrayContaining([openA.id, openB.id, delivered.id]),
    );
    expect(handover.open_load_ids).toHaveLength(3);
    expect(handover.watch_items).toContain("B7-HANDOVER-B");
    expect(handover.next_day_priorities).toContain("POD");

    // Morning continuity: re-list handovers and resolve open loads from isolated ids only.
    const rows = await cloud.listHandovers();
    const morning = rows.find((h) => h.id === handover.id);
    expect(morning).toBeTruthy();
    const morningLoads = (await cloud.listLoads()).filter((l) =>
      morning!.open_load_ids.includes(l.id),
    );
    expect(morningLoads.map((l) => l.load_number).sort()).toEqual(
      ["B7-HANDOVER-A", "B7-HANDOVER-B", "B7-HANDOVER-DEL"].sort(),
    );
    expect(morningLoads.every((l) => l.load_number.startsWith("B7-HANDOVER-"))).toBe(true);
    expect(JSON.stringify(morningLoads).toLowerCase()).not.toContain("live gps");
    // No Compliance / Admin / Personal leakage markers in handover payload.
    const blob = JSON.stringify(morning);
    expect(blob).not.toMatch(/tracker_sections|drug_test|rate_card|app_state|personal/i);
  });
});
