import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  accessorialsBleedIntoHrFinance,
  assertDeliveredClosedPaidDistinct,
  awaitingCloseoutLoads,
  buildCompleteLoadHistory,
  canCloseLoad,
  canReopenLoad,
  validateAccessorialInput,
  validateCloseout,
  validateCommunication,
  validateReopen,
} from "@/dispatch/lib/closeout";
import {
  fixtureAccessorials,
  fixtureCheckCalls,
  fixtureCommunications,
  fixtureFollowUps,
  fixtureIssues,
  fixtureLoads,
} from "@/dispatch/lib/fixtures";
import { loadsToCsv, accessorialsToCsv } from "@/dispatch/lib/reports";
import { canTransition } from "@/dispatch/lib/status";

describe("Batch 9 closeout helpers", () => {
  it("keeps Delivered ≠ Closed ≠ Paid", () => {
    const delivered = fixtureLoads.find((l) => l.status === "delivered")!;
    const flags = assertDeliveredClosedPaidDistinct(delivered);
    expect(flags.delivered).toBe(true);
    expect(flags.closed).toBe(false);
    expect(flags.paid).toBe(false);
    expect(canCloseLoad("delivered")).toBe(true);
    expect(canCloseLoad("in_transit")).toBe(false);
    expect(canReopenLoad("closed")).toBe(true);
    expect(canTransition("closed", "delivered")).toBe(true);
    expect(canTransition("delivered", "closed")).toBe(true);
  });

  it("requires closeout note and reopen reason", () => {
    expect(validateCloseout("")).toMatch(/note/i);
    expect(validateCloseout("POD verified — file complete")).toBeNull();
    expect(validateReopen("")).toMatch(/reason/i);
    expect(validateReopen("POD corrected — reopen")).toBeNull();
  });

  it("rejects invented accessorial amounts and requires description", () => {
    expect(
      validateAccessorialInput({
        kind: "detention",
        description: "",
        amount_manual: null,
      }),
    ).toMatch(/description/i);
    expect(
      validateAccessorialInput({
        kind: "detention",
        description: "Receiver hold",
        amount_manual: -5,
      }),
    ).toMatch(/negative/i);
    expect(
      validateAccessorialInput({
        kind: "detention",
        description: "Receiver hold",
        amount_manual: null,
        hours_manual: 2,
      }),
    ).toBeNull();
    expect(accessorialsBleedIntoHrFinance()).toBe(false);
  });

  it("requires decision action for decision kind; never implies notify", () => {
    expect(validateCommunication({ kind: "call", summary: "Called shipper" })).toBeNull();
    expect(validateCommunication({ kind: "decision", summary: "Hold close", decided_action: "" })).toMatch(
      /decided action/i,
    );
    expect(
      validateCommunication({
        kind: "decision",
        summary: "Hold close",
        decided_action: "Wait for POD",
      }),
    ).toBeNull();
  });

  it("lists awaiting closeout and builds complete history without Live GPS invention", () => {
    const awaiting = awaitingCloseoutLoads(fixtureLoads);
    expect(awaiting.some((l) => l.load_number === "SH-0990")).toBe(true);
    const load = awaiting[0];
    const events = buildCompleteLoadHistory({
      load,
      checkCalls: fixtureCheckCalls.filter((c) => c.load_id === load.id),
      issues: fixtureIssues.filter((i) => i.load_id === load.id),
      followUps: fixtureFollowUps.filter((f) => f.load_id === load.id),
      communications: fixtureCommunications.filter((c) => c.load_id === load.id),
      accessorials: fixtureAccessorials.filter((a) => a.load_id === load.id),
    });
    expect(events.some((e) => e.source === "accessorial")).toBe(true);
    expect(events.some((e) => e.source === "communication")).toBe(true);
    expect(JSON.stringify(events).toLowerCase()).not.toContain("live gps");
    expect(JSON.stringify(events).toLowerCase()).not.toContain("push notification");
  });

  it("CSV exports include payment/closeout and accessorials without payroll bleed", () => {
    const csv = loadsToCsv(fixtureLoads);
    expect(csv).toContain("payment_status");
    expect(csv).toContain("closeout_note");
    expect(csv.toLowerCase()).not.toContain("payroll");
    const acc = accessorialsToCsv(fixtureAccessorials);
    expect(acc).toContain("amount_manual");
    expect(acc).toContain("free_time_note");
    expect(acc.toLowerCase()).not.toContain("expense");
  });
});

describe("Batch 9 fixture cloud close / reopen / accessorial / communication", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("closes delivered without paying, reopens, saves detention + decision", async () => {
    vi.doMock("@/lib/preview-isolated", () => ({
      isPreviewIsolated: () => true,
    }));
    const cloud = await import("@/dispatch/lib/cloud");
    cloud.resetDispatchFixtureMemory();

    const loads = await cloud.listLoads();
    const delivered = loads.find((l) => l.status === "delivered")!;
    expect(delivered.payment_status).toBe("unpaid");

    await expect(cloud.closeLoad(delivered, "")).rejects.toThrow(/note/i);
    const closed = await cloud.closeLoad(delivered, "POD verified — close file");
    expect(closed.status).toBe("closed");
    expect(closed.payment_status).toBe("unpaid");
    expect(closed.closeout_note).toMatch(/POD verified/);

    const paid = await cloud.setLoadPaymentStatus(closed, "paid");
    expect(paid.status).toBe("closed");
    expect(paid.payment_status).toBe("paid");

    const reopened = await cloud.reopenLoad(paid, "POD correction needed");
    expect(reopened.status).toBe("delivered");
    expect(reopened.payment_status).toBe("paid");

    const acc = await cloud.saveAccessorial({
      load_id: reopened.id,
      kind: "detention",
      description: "B9 detention claim",
      amount_manual: null,
      hours_manual: 3,
      free_time_note: "Needs Policy Confirmation",
    });
    expect(acc.amount_manual).toBeNull();
    expect(acc.status).toBe("draft");

    const com = await cloud.saveCommunication({
      load_id: reopened.id,
      kind: "decision",
      summary: "Keep unpaid until broker confirms",
      decided_action: "Do not invent rate; leave amount blank",
    });
    expect(com.kind).toBe("decision");
    expect(com.decided_action).toMatch(/Do not invent/);
  });
});
