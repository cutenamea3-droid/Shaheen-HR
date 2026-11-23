import { describe, expect, it } from "vitest";
import {
  healDispatchAccessorial,
  healDispatchLoad,
  healLoadStop,
  listLoads,
  resetDispatchFixtureMemory,
  saveAccessorial,
  saveLoad,
} from "@/dispatch/lib/cloud";
import type { DispatchAccessorial, DispatchLoad, LoadStop } from "@/dispatch/lib/types";

describe("Dispatch load / stop / accessorial text heal", () => {
  it("healLoadStop / healDispatchLoad / healDispatchAccessorial coerce scalars", () => {
    const stop = healLoadStop({
      sequence: 1,
      stop_type: "pickup",
      name: 7 as unknown as string,
      address: true as unknown as string,
      city: null as unknown as string,
      state: "",
      postal_code: 90210 as unknown as string,
      planned_at: null,
      actual_at: null,
      notes: { n: 1 } as unknown as string,
    } as LoadStop);
    expect(stop.name).toBe("7");
    expect(stop.address).toBe("true");
    expect(stop.city).toBe("");
    expect(stop.postal_code).toBe("90210");
    expect(stop.notes).toBe("[object Object]");

    const load = healDispatchLoad({
      id: "l1",
      load_number: 1001 as unknown as string,
      customer_name: true as unknown as string,
      commodity: null,
      equipment: null,
      notes: { x: 1 } as unknown as string,
      status: "planned",
      exception_open: false,
      bol_status: "missing",
      pod_status: "missing",
      assigned_driver_id: null,
      assigned_driver_name: 3 as unknown as string,
      external_ref_label: null,
      external_ref_url: null,
      planned_pickup_at: null,
      actual_pickup_at: null,
      planned_delivery_at: null,
      actual_delivery_at: null,
      last_manual_location: null,
      last_manual_location_at: null,
      last_manual_location_by: null,
      cancel_reason: null,
      reschedule_note: null,
      closeout_note: null,
      closed_at: null,
      reopen_reason: null,
      reopened_at: null,
      payment_status: "unpaid",
      stale_after_minutes: 180,
      created_by: null,
      updated_by: null,
      created_at: "",
      updated_at: "",
      stops: [stop],
    } as DispatchLoad);
    expect(load.load_number).toBe("1001");
    expect(load.customer_name).toBe("true");
    expect(load.notes).toBe("[object Object]");
    expect(load.assigned_driver_name).toBe("3");
    expect(load.stops?.[0]?.name).toBe("7");

    const acc = healDispatchAccessorial({
      id: "a1",
      load_id: "l1",
      kind: "detention",
      status: "draft",
      description: 9 as unknown as string,
      amount_manual: null,
      hours_manual: null,
      free_time_note: true as unknown as string,
      currency: null as unknown as string,
      created_by: null,
      created_at: "",
      updated_at: "",
    } as DispatchAccessorial);
    expect(acc.description).toBe("9");
    expect(acc.free_time_note).toBe("true");
    expect(acc.currency).toBe("USD");
  });

  it("saveLoad / saveAccessorial stringify on write", async () => {
    resetDispatchFixtureMemory();
    const saved = await saveLoad({
      load_number: 555 as unknown as string,
      customer_name: true as unknown as string,
      stops: [
        {
          sequence: 1,
          stop_type: "pickup",
          name: 1 as unknown as string,
          address: "",
          city: "",
          state: "",
          postal_code: "",
          planned_at: null,
          actual_at: null,
          notes: "",
        },
      ],
    });
    expect(saved.load_number).toBe("555");
    expect(saved.customer_name).toBe("true");
    expect(saved.stops?.[0]?.name).toBe("1");

    const loads = await listLoads();
    expect(loads.some((l) => l.load_number === "555")).toBe(true);

    const acc = await saveAccessorial({
      load_id: saved.id,
      kind: "detention",
      description: 12 as unknown as string,
      free_time_note: false as unknown as string,
    });
    expect(acc.description).toBe("12");
    expect(acc.free_time_note).toBe("false");
  });
});
