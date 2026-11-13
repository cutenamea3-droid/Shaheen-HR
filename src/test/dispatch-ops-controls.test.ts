import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  awaitingBolLoads,
  awaitingPodLoads,
  buildEquipmentBoard,
  buildHandoverWatchHints,
  canCancelLoad,
  dueFollowUps,
  issuesMissingSeniorInformed,
  moveStop,
  removeStop,
  renumberStops,
  validateCancel,
  validateReschedule,
} from "@/dispatch/lib/ops-controls";
import { fixtureDrivers, fixtureFollowUps, fixtureIssues, fixtureLoads } from "@/dispatch/lib/fixtures";
import type { LoadStop } from "@/dispatch/lib/types";

describe("Batch 8 ops controls", () => {
  it("lists awaiting BOL/POD without inventing document content", () => {
    const bol = awaitingBolLoads(fixtureLoads);
    const pod = awaitingPodLoads(fixtureLoads);
    expect(bol.some((l) => l.load_number === "SH-1002")).toBe(true);
    expect(pod.some((l) => l.load_number === "SH-0990" && l.pod_status === "pending")).toBe(true);
    expect(JSON.stringify(bol).toLowerCase()).not.toContain("live gps");
  });

  it("due follow-ups are desk reminders only (open + due)", () => {
    const due = dueFollowUps(fixtureFollowUps, Date.now());
    expect(due.length).toBeGreaterThan(0);
    expect(due.every((f) => f.status === "open")).toBe(true);
  });

  it("flags supervisor+ issues missing Senior Informed (manual)", () => {
    const missing = issuesMissingSeniorInformed(fixtureIssues);
    expect(missing.some((i) => i.title.includes("Detention"))).toBe(true);
    expect(missing.every((i) => !i.senior_informed)).toBe(true);
  });

  it("builds equipment board from roster + load equipment only (no HOS/availability)", () => {
    const board = buildEquipmentBoard(fixtureDrivers, fixtureLoads);
    const alex = board.find((r) => r.driver.id === "drv-1");
    expect(alex?.equipmentLabels).toContain("53' van");
    expect(alex?.activeLoads.some((l) => l.load_number === "SH-1001")).toBe(true);
    expect(JSON.stringify(board).toLowerCase()).not.toContain("hos");
    expect(JSON.stringify(board).toLowerCase()).not.toContain("available");
  });

  it("requires manual cancel reason and reschedule note", () => {
    expect(validateCancel("")).toMatch(/reason/i);
    expect(validateCancel("Shipper cancelled")).toBeNull();
    expect(canCancelLoad("in_transit")).toBe(true);
    expect(canCancelLoad("closed")).toBe(false);
    expect(validateReschedule("", "2026-11-13T12:00:00.000Z", null)).toMatch(/note/i);
    expect(validateReschedule("Moved pickup window", null, null)).toMatch(/planned/i);
    expect(validateReschedule("Moved pickup window", "2026-11-13T12:00:00.000Z", null)).toBeNull();
  });

  it("reorders and removes multi-stops with renumbered sequences", () => {
    const stops: LoadStop[] = [
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
        name: "C",
        address: "",
        city: "C",
        state: "IN",
        postal_code: "",
        planned_at: null,
        actual_at: null,
        notes: "",
      },
    ];
    const moved = moveStop(stops, 0, 1);
    expect(moved.map((s) => s.name)).toEqual(["B", "A", "C"]);
    expect(moved.map((s) => s.sequence)).toEqual([1, 2, 3]);
    const removed = removeStop(moved, 1);
    expect(removed.map((s) => s.name)).toEqual(["B", "C"]);
    expect(renumberStops(removed).map((s) => s.sequence)).toEqual([1, 2]);
  });

  it("handover watch hints include docs, issues, follow-ups — not invented ETAs", () => {
    const hints = buildHandoverWatchHints({
      loads: fixtureLoads,
      issues: fixtureIssues,
      followUps: fixtureFollowUps,
    });
    expect(hints).toMatch(/BOL\/POD|Follow-ups|Open issues/i);
    expect(hints.toLowerCase()).not.toContain("live gps");
    expect(hints.toLowerCase()).not.toContain("notification");
  });
});

describe("Batch 8 fixture cloud cancel / follow-up / senior informed", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("cancels with reason, blocks bare cancel, saves follow-up + senior informed", async () => {
    vi.doMock("@/lib/preview-isolated", () => ({
      isPreviewIsolated: () => true,
    }));
    const cloud = await import("@/dispatch/lib/cloud");
    cloud.resetDispatchFixtureMemory();

    const loads = await cloud.listLoads();
    const target = loads.find((l) => l.status === "in_transit") ?? loads[0];
    await expect(cloud.cancelLoad(target, "")).rejects.toThrow(/reason/i);

    const cancelled = await cloud.cancelLoad(target, "Shipper cancelled — desk note");
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.cancel_reason).toMatch(/Shipper cancelled/);

    const rescheduled = await cloud.rescheduleLoad(
      loads.find((l) => l.load_number === "SH-1002") ?? loads[1],
      {
        note: "Pickup moved to afternoon window",
        planned_pickup_at: new Date(Date.now() + 3 * 3600_000).toISOString(),
      },
    );
    expect(rescheduled.reschedule_note).toMatch(/Pickup moved/);

    const fu = await cloud.saveFollowUp({
      title: "B8 follow-up",
      due_at: new Date(Date.now() - 60_000).toISOString(),
      load_id: cancelled.id,
      notes: "Desk reminder only",
    });
    expect(fu.status).toBe("open");
    const listed = await cloud.listFollowUps();
    expect(listed.some((f) => f.id === fu.id)).toBe(true);

    const issue = (await cloud.listIssues())[0];
    const informed = await cloud.saveIssue({
      ...issue,
      title: issue.title,
      senior_informed: true,
      senior_informed_note: "Called supervisor at 07:10 — manual record",
    });
    expect(informed.senior_informed).toBe(true);
    expect(informed.senior_informed_at).toBeTruthy();
  });
});
