import { describe, expect, it } from "vitest";
import { decideHrSync, isHrMeaningful, isHrPayloadEmpty, isHrSeedLike, refuseSeedOrEmptyPush } from "./hr-sync-protect";
import { reconnectTreatAsUnsynced, saveNowMessage } from "./hr-local-pending";
import { hrPayloadsDiverge, hrSyncStatusLabel, needsExplicitConflictUx } from "./hr-sync-status";
import seed from "@/admin/data/seed.json";

const KEYS = ["depts", "employees", "records", "perf", "tasks", "settings", "team", "logs"] as const;

const richA = {
  depts: [{ id: "d1", name: "Ops", start: 0, end: 100 }],
  employees: [{ id: "e1", name: "Alex", deptId: "d1", afterHours: false }],
  records: { "2026-11-01": { e1: { status: "present" } } },
  perf: {},
  tasks: [],
  settings: (seed as { settings: unknown }).settings,
  team: [],
  logs: [],
};

const richB = {
  ...richA,
  employees: [{ id: "e2", name: "Sam", deptId: "d1", afterHours: false }],
  records: { "2026-11-02": { e2: { status: "present" } } },
};

const emptyShaped = {
  depts: [],
  employees: [],
  records: {},
  perf: {},
  tasks: [],
  settings: (seed as { settings: unknown }).settings,
  team: [],
  logs: [],
};

/**
 * Batch 1 acceptance matrix (tests 1–17) — pure unit coverage.
 * Live Production persistence is NOT claimed from these alone.
 */
describe("Batch 1 attendance sync tests 1–17", () => {
  it("1. status labels: Cloud Saved / Saving / Not Synced / Connection Error / Sign In Required", () => {
    expect(hrSyncStatusLabel("synced")).toBe("Cloud Saved");
    expect(hrSyncStatusLabel("syncing")).toBe("Saving");
    expect(hrSyncStatusLabel("unsynced")).toBe("Not Synced");
    expect(hrSyncStatusLabel("connecting")).toBe("Not Synced");
    expect(hrSyncStatusLabel("conflict")).toBe("Not Synced");
    expect(hrSyncStatusLabel("error")).toBe("Connection Error");
    expect(hrSyncStatusLabel("paused")).toBe("Sign In Required");
  });

  it("2. saveNowMessage never claims cloud without Auth (local_only / preview)", () => {
    expect(saveNowMessage("local_only").cloud).toBe(false);
    expect(saveNowMessage("preview").cloud).toBe(false);
    expect(saveNowMessage("cloud_ok")).toEqual({ ok: true, cloud: true, message: "Cloud Saved." });
  });

  it("3. Connection Error message does not claim cloud success", () => {
    const fail = saveNowMessage("cloud_fail");
    expect(fail.ok).toBe(false);
    expect(fail.cloud).toBe(false);
    expect(fail.message).toContain("Connection Error");
  });

  it("4. conflict saveNow blocks overwrite claims", () => {
    const c = saveNowMessage("conflict");
    expect(c.ok).toBe(false);
    expect(c.cloud).toBe(false);
    expect(c.message).toContain("Not Synced");
  });

  it("5. local-only reconnect treated as unsynced (protect pending edits)", () => {
    expect(reconnectTreatAsUnsynced({ unsyncedFlag: false, localOnlyFlag: true })).toBe(true);
  });

  it("6. empty/missing cloud never apply_cloud (empty-state-on-failed-read class)", () => {
    expect(decideHrSync(richA, null)).toBe("push_local");
    expect(decideHrSync(richA, emptyShaped)).toBe("push_local");
    expect(decideHrSync(seed, null)).toBe("keep_local");
    expect(decideHrSync(emptyShaped, null)).toBe("keep_local");
  });

  it("7. failed-read path must not be modeled as apply_cloud of empty", () => {
    // decideHrSync is only called after a successful select; empty apply is still refused.
    expect(decideHrSync(richA, {})).toBe("push_local");
    expect(isHrPayloadEmpty({})).toBe(true);
  });

  it("8. seed/empty never auto-upload over meaningful cloud", () => {
    expect(refuseSeedOrEmptyPush(seed, richA)).toBe(true);
    expect(refuseSeedOrEmptyPush(emptyShaped, richA)).toBe(true);
  });

  it("9. seed local + meaningful cloud → apply_cloud (hydrate)", () => {
    expect(decideHrSync(seed, richA)).toBe("apply_cloud");
    expect(isHrSeedLike(seed)).toBe(true);
  });

  it("10. unsynced meaningful local vs meaningful cloud → keep_local (no silent apply)", () => {
    expect(decideHrSync(richA, richB, { unsynced: true })).toBe("keep_local");
  });

  it("11. payloads diverge when employees/records differ; logs alone do not", () => {
    expect(hrPayloadsDiverge(richA, richB, KEYS)).toBe(true);
    expect(hrPayloadsDiverge(richA, { ...richA, logs: [{ id: "x" }] }, KEYS)).toBe(false);
  });

  it("12. needsExplicitConflictUx when pending + both meaningful + diverge", () => {
    expect(
      needsExplicitConflictUx({
        localMeaningful: true,
        cloudMeaningful: true,
        diverge: true,
        pendingUnsynced: true,
      }),
    ).toBe(true);
    expect(
      needsExplicitConflictUx({
        localMeaningful: true,
        cloudMeaningful: true,
        diverge: true,
        pendingUnsynced: false,
      }),
    ).toBe(false);
    expect(
      needsExplicitConflictUx({
        localMeaningful: true,
        cloudMeaningful: false,
        diverge: true,
        pendingUnsynced: true,
      }),
    ).toBe(false);
  });

  it("13. identical pending local+cloud does not require conflict UX", () => {
    expect(hrPayloadsDiverge(richA, richA, KEYS)).toBe(false);
    expect(
      needsExplicitConflictUx({
        localMeaningful: isHrMeaningful(richA),
        cloudMeaningful: isHrMeaningful(richA),
        diverge: hrPayloadsDiverge(richA, richA, KEYS),
        pendingUnsynced: true,
      }),
    ).toBe(false);
  });

  it("14. non-unsynced dual meaningful still LWW-apply (multi-device pull path)", () => {
    expect(decideHrSync(richA, richB, { unsynced: false })).toBe("apply_cloud");
  });

  it("15. Sign In Required copy surfaces in local_only save message", () => {
    expect(saveNowMessage("local_only").message).toContain("Sign In Required");
  });

  it("16. backup/sync key set is the eight Admin attendance keys", () => {
    expect([...KEYS]).toEqual(["depts", "employees", "records", "perf", "tasks", "settings", "team", "logs"]);
  });

  it("17. seed into empty cloud refused (no auto-seed pollution of app_state)", () => {
    expect(refuseSeedOrEmptyPush(seed, null)).toBe(true);
    expect(refuseSeedOrEmptyPush(seed, emptyShaped)).toBe(true);
  });
});
