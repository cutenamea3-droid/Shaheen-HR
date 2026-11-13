import { describe, expect, it } from "vitest";
import { decideHrSync } from "./hr-sync-protect";
import {
  clearHrPendingUnsynced,
  hasHrLocalOnlySessionFlag,
  hasHrPendingUnsynced,
  HR_ATTENDANCE_LOCAL_ONLY_KEY,
  HR_ATTENDANCE_UNSYNCED_KEY,
  markHrPendingUnsynced,
  reconnectTreatAsUnsynced,
  saveNowMessage,
  setHrLocalOnlySessionFlag,
} from "./hr-local-pending";

function memStorage(initial: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(initial));
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, String(v));
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    key: (i: number) => [...map.keys()][i] ?? null,
  };
}

const richLocal = {
  depts: [{ id: "d1", name: "Ops", start: 0, end: 100 }],
  employees: [{ id: "e1", name: "Alex", deptId: "d1", afterHours: false }],
  records: { "2026-11-01": { e1: { status: "present" } } },
  perf: {},
  tasks: [],
  settings: { company: "X", grace: 0, breakMins: 0, satTarget: 0, overpay: 0 },
  team: [],
  logs: [],
};

const richCloud = {
  ...richLocal,
  employees: [{ id: "e2", name: "Sam", deptId: "d1", afterHours: false }],
  records: { "2026-11-02": { e2: { status: "present" } } },
};

describe("hr-local-pending flags", () => {
  it("marks and clears unsynced bit", () => {
    const s = memStorage();
    expect(hasHrPendingUnsynced(s)).toBe(false);
    markHrPendingUnsynced(s);
    expect(s.getItem(HR_ATTENDANCE_UNSYNCED_KEY)).toBe("1");
    expect(hasHrPendingUnsynced(s)).toBe(true);
    clearHrPendingUnsynced(s);
    expect(hasHrPendingUnsynced(s)).toBe(false);
  });

  it("toggles local-only session flag", () => {
    const s = memStorage();
    setHrLocalOnlySessionFlag(true, s);
    expect(hasHrLocalOnlySessionFlag(s)).toBe(true);
    expect(s.getItem(HR_ATTENDANCE_LOCAL_ONLY_KEY)).toBe("1");
    setHrLocalOnlySessionFlag(false, s);
    expect(hasHrLocalOnlySessionFlag(s)).toBe(false);
  });
});

describe("reconnectTreatAsUnsynced", () => {
  it("is true when either unsynced or local-only flag is set", () => {
    expect(reconnectTreatAsUnsynced({ unsyncedFlag: false, localOnlyFlag: false })).toBe(false);
    expect(reconnectTreatAsUnsynced({ unsyncedFlag: true, localOnlyFlag: false })).toBe(true);
    expect(reconnectTreatAsUnsynced({ unsyncedFlag: false, localOnlyFlag: true })).toBe(true);
    expect(reconnectTreatAsUnsynced({ unsyncedFlag: true, localOnlyFlag: true })).toBe(true);
  });

  it("with treat-as-unsynced, decideHrSync keeps local over meaningful cloud (no silent overwrite)", () => {
    const treat = reconnectTreatAsUnsynced({ unsyncedFlag: false, localOnlyFlag: true });
    expect(decideHrSync(richLocal, richCloud, { unsynced: treat })).toBe("keep_local");
    expect(decideHrSync(richLocal, richCloud, { unsynced: false })).toBe("apply_cloud");
  });
});

describe("saveNowMessage — never claims cloud without cloud", () => {
  it("local_only and preview are ok locally but cloud=false", () => {
    expect(saveNowMessage("local_only")).toEqual({
      ok: true,
      cloud: false,
      message: "Saved on this browser only — Sign In Required for cloud sync.",
    });
    expect(saveNowMessage("preview").cloud).toBe(false);
    expect(saveNowMessage("cloud_ok")).toEqual({ ok: true, cloud: true, message: "Cloud Saved." });
    expect(saveNowMessage("cloud_fail").ok).toBe(false);
    expect(saveNowMessage("cloud_fail").cloud).toBe(false);
    expect(saveNowMessage("conflict").cloud).toBe(false);
  });
});
