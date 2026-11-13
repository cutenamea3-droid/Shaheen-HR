import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/preview-isolated", () => ({
  isPreviewIsolated: () => true,
}));

describe("Dispatch fixture cloud (not production fake)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("saves loads with multi-stop and unlimited assign, keeps Delivered ≠ Closed", async () => {
    const cloud = await import("@/dispatch/lib/cloud");
    const drivers = await cloud.listRosterDrivers();
    expect(drivers.length).toBeGreaterThan(0);

    const saved = await cloud.saveLoad({
      load_number: "SH-TEST-9",
      status: "assigned",
      assigned_driver_id: drivers[0].id,
      assigned_driver_name: drivers[0].display_name,
      stops: [
        {
          sequence: 1,
          stop_type: "pickup",
          name: "A",
          address: "",
          city: "A",
          state: "IL",
          postal_code: "",
          planned_at: null,
          actual_at: null,
          notes: "",
        },
        {
          sequence: 2,
          stop_type: "delivery",
          name: "B",
          address: "",
          city: "B",
          state: "MI",
          postal_code: "",
          planned_at: null,
          actual_at: null,
          notes: "",
        },
        {
          sequence: 3,
          stop_type: "other",
          name: "Yard",
          address: "",
          city: "C",
          state: "IN",
          postal_code: "",
          planned_at: null,
          actual_at: null,
          notes: "",
        },
      ],
    });
    expect(saved.stops?.length).toBe(3);

    const second = await cloud.saveLoad({
      load_number: "SH-TEST-10",
      status: "planned",
      assigned_driver_id: drivers[0].id,
      assigned_driver_name: drivers[0].display_name,
    });
    expect(second.assigned_driver_id).toBe(drivers[0].id);

    const delivered = await cloud.saveLoad({
      id: saved.id,
      load_number: saved.load_number,
      status: "delivered",
      assigned_driver_id: drivers[0].id,
      assigned_driver_name: drivers[0].display_name,
    });
    expect(delivered.status).toBe("delivered");
    expect(delivered.status).not.toBe("closed");

    const history = cloud.driverLoadHistory(await cloud.listLoads(), drivers[0].id);
    expect(history.some((l) => l.load_number === "SH-TEST-9")).toBe(true);
    expect(history.some((l) => l.load_number === "SH-TEST-10")).toBe(true);

    await cloud.addCheckCall({
      load_id: saved.id,
      notes: "Manual check-call",
      manual_location: "I-80 MP 42",
    });
    const calls = await cloud.listCheckCalls(saved.id);
    expect(calls[0]?.manual_location).toBe("I-80 MP 42");
    expect(JSON.stringify(calls).toLowerCase()).not.toContain("live gps");

    const handover = await cloud.saveHandover({
      shift_date: "2026-11-13",
      from_dispatcher: "Night",
      to_dispatcher: "Morning",
      summary: "Carry SH-TEST-9",
      open_load_ids: [saved.id],
      watch_items: "Call shipper",
      next_day_priorities: "Close delivered loads after POD",
    });
    expect(handover.open_load_ids).toContain(saved.id);
  });
});
