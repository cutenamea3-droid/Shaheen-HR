import seed from "@/admin/data/seed.json";
import { test, expect } from "vitest";
import {
  decideHrSync,
  isHrPayloadEmpty,
  isHrPayloadMissing,
  isHrSeedLike,
  isHrMeaningful,
  refuseSeedOrEmptyPush,
} from "./hr-sync-protect";

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

const richLocal = {
  depts: [{ id: "d1", name: "Ops", start: 0, end: 100 }],
  employees: [{ id: "e1", name: "Alex", deptId: "d1", afterHours: false }],
  records: { "2026-11-01": { e1: { status: "present" } } },
  perf: {},
  tasks: [],
  settings: (seed as { settings: unknown }).settings,
  team: [],
  logs: [{ id: "l1", at: 1, who: "a", action: "edit" }],
};

test("missing/empty payloads detected (including key-shaped empties)", () => {
  expect(isHrPayloadMissing(null)).toBe(true);
  expect(isHrPayloadMissing(undefined)).toBe(true);
  expect(isHrPayloadMissing({})).toBe(true);
  expect(isHrPayloadEmpty(null)).toBe(true);
  expect(isHrPayloadEmpty({})).toBe(true);
  expect(isHrPayloadEmpty(emptyShaped)).toBe(true);
  expect(isHrPayloadEmpty(richLocal)).toBe(false);
  expect(isHrMeaningful(richLocal)).toBe(true);
  expect(isHrMeaningful(emptyShaped)).toBe(false);
});

test("bundled seed is seed-like even if logs differ", () => {
  expect(isHrSeedLike(seed)).toBe(true);
  expect(isHrSeedLike({ ...seed, logs: [{ id: "x", at: 9, who: "u", action: "Signed in" }] })).toBe(true);
  expect(isHrSeedLike(richLocal)).toBe(false);
  expect(isHrMeaningful(seed)).toBe(true); // seed has employees — richness alone is not enough
});

test("empty/missing cloud never applies — keep or push real local only", () => {
  expect(decideHrSync(richLocal, null)).toBe("push_local");
  expect(decideHrSync(richLocal, undefined)).toBe("push_local");
  expect(decideHrSync(richLocal, emptyShaped)).toBe("push_local");
  expect(decideHrSync(seed, null)).toBe("keep_local");
  expect(decideHrSync(seed, emptyShaped)).toBe("keep_local");
  expect(decideHrSync(emptyShaped, null)).toBe("keep_local");
});

test("meaningful cloud applies over seed/empty; unsynced real local keeps local", () => {
  expect(decideHrSync(seed, richLocal)).toBe("apply_cloud");
  expect(decideHrSync(emptyShaped, richLocal)).toBe("apply_cloud");
  expect(decideHrSync(richLocal, richLocal, { unsynced: false })).toBe("apply_cloud");
  expect(decideHrSync(richLocal, { ...richLocal, employees: [{ id: "e2", name: "Sam", deptId: "d1", afterHours: false }] }, { unsynced: true })).toBe(
    "keep_local",
  );
});

test("refuse seed/empty push over existing meaningful cloud", () => {
  expect(refuseSeedOrEmptyPush(seed, richLocal)).toBe(true);
  expect(refuseSeedOrEmptyPush(emptyShaped, richLocal)).toBe(true);
  expect(refuseSeedOrEmptyPush(richLocal, richLocal)).toBe(false);
  // Also refuse uploading pure seed into empty cloud (no auto-seed pollution).
  expect(refuseSeedOrEmptyPush(seed, null)).toBe(true);
  expect(refuseSeedOrEmptyPush(seed, emptyShaped)).toBe(true);
});
