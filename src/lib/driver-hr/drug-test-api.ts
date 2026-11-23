/**
 * Drug Test API — secure Driver Supabase RPCs for the production path.
 * Never persists into tracker_sections / AppData localStorage.
 * Soft-delete only (recoverable). No silent mock fallback for saves.
 */
import { canPersistDrugTests, DRUG_TEST_SECURE_REQUIRED, getDriverDrugTestMode } from "./drug-test-mode";
import { useDrugTestMock } from "./drug-test-mock";
import {
  secureAddDrugTest,
  secureDeleteDrugTest,
  secureListDrugTests,
  secureRestoreDrugTest,
  secureUpdateDrugTest,
} from "./drug-test-secure";
import { asDrugText, newTestingEventId, type DrugTestEvent } from "./drug-tests";
import { recordSensitiveAudit } from "./sensitive-audit";
import { notifyDriverHrRefresh, subscribeDriverHrRefresh } from "./refresh-bus";

function assertPersistable(): void {
  if (!canPersistDrugTests()) {
    throw new Error(DRUG_TEST_SECURE_REQUIRED);
  }
}

/** Sync peek for non-secure unit harnesses only — not a production save path. */
export function listDrugTests(driverId: string, _actor = "portal"): DrugTestEvent[] {
  void _actor;
  if (canPersistDrugTests()) return [];
  return useDrugTestMock.getState().listForDriver(driverId);
}

export type DrugListResult = {
  events: DrugTestEvent[];
  error: string | null;
  secure: boolean;
};

export async function listDrugTestsAsync(driverId: string, actor = "portal"): Promise<DrugListResult> {
  if (getDriverDrugTestMode() === "secure") {
    try {
      const rows = await secureListDrugTests(driverId);
      const list = Array.isArray(rows) ? rows : [];
      recordSensitiveAudit({ actor, action: "drug_test_list", driverId, detail: `n=${list.length}` });
      return { events: list, error: null, secure: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load drug test records";
      return { events: [], error: msg, secure: true };
    }
  }
  return {
    events: [],
    error: DRUG_TEST_SECURE_REQUIRED,
    secure: false,
  };
}

/** Load active events for many drivers (one RPC per driver — reuses existing list RPC). */
export async function listDrugTestsForDrivers(
  driverIds: string[],
  actor = "portal",
): Promise<DrugListResult> {
  if (getDriverDrugTestMode() !== "secure") {
    return { events: [], error: DRUG_TEST_SECURE_REQUIRED, secure: false };
  }
  const ids = Array.isArray(driverIds) ? driverIds : [];
  const unique = [...new Set(ids.filter(Boolean))];
  const settled = await Promise.all(
    unique.map(async (id) => {
      try {
        const rows = await secureListDrugTests(id);
        const list = Array.isArray(rows) ? rows : [];
        recordSensitiveAudit({ actor, action: "drug_test_list", driverId: id, detail: `n=${list.length}` });
        return { rows: list, error: null as string | null };
      } catch (e) {
        return {
          rows: [] as DrugTestEvent[],
          error: e instanceof Error ? e.message : "Failed to load drug test records",
        };
      }
    }),
  );
  const events = settled.flatMap((s) => (Array.isArray(s.rows) ? s.rows : []));
  const firstErr = settled.find((s) => s.error)?.error ?? null;
  return { events, error: firstErr, secure: true };
}

export async function addDrugTestEvent(
  input: Omit<DrugTestEvent, "id" | "createdAt">,
  actor: string,
): Promise<DrugTestEvent> {
  void actor;
  assertPersistable();
  const withGroup: Omit<DrugTestEvent, "id" | "createdAt"> = {
    ...input,
    testingEventId: asDrugText(input.testingEventId).trim() || newTestingEventId(),
  };
  const ev = await secureAddDrugTest(withGroup);
  notifyDriverHrRefresh();
  return ev;
}

export async function updateDrugTestEvent(
  id: string,
  patch: Partial<
    Pick<
      DrugTestEvent,
      "kind" | "specimenId" | "reason" | "collectionContext" | "eventDate" | "notes" | "testingEventId"
    >
  >,
  actor: string,
): Promise<DrugTestEvent | null> {
  void actor;
  assertPersistable();
  const ev = await secureUpdateDrugTest(id, patch);
  notifyDriverHrRefresh();
  return ev;
}

/** Soft-delete (recoverable). */
export async function deleteDrugTestEvent(id: string, actor: string): Promise<boolean> {
  void actor;
  assertPersistable();
  await secureDeleteDrugTest(id);
  notifyDriverHrRefresh();
  return true;
}

export async function restoreDrugTestEvent(id: string, actor: string): Promise<DrugTestEvent | null> {
  void actor;
  assertPersistable();
  const ev = await secureRestoreDrugTest(id);
  notifyDriverHrRefresh();
  return ev;
}

/**
 * Persist a manual CCF↔MRO link by moving `movingEventId` onto `targetTestingEventId`.
 * Uses existing update RPC only — no schema change, no delete. Staff audit recorded.
 */
export async function linkDrugTestEvents(opts: {
  movingEventId: string;
  targetTestingEventId: string;
  driverId: string;
  actor: string;
}): Promise<DrugTestEvent | null> {
  assertPersistable();
  const tid = asDrugText(opts.targetTestingEventId).trim();
  if (!tid) throw new Error("Target testing event id required to link.");
  const ev = await secureUpdateDrugTest(opts.movingEventId, { testingEventId: tid });
  recordSensitiveAudit({
    actor: opts.actor,
    action: "drug_test_link",
    driverId: opts.driverId,
    detail: `moved=${opts.movingEventId} → te=${tid}`,
  });
  notifyDriverHrRefresh();
  return ev;
}

/**
 * Unlink one side into its own testing event (preserves both docs; does not delete).
 */
export async function unlinkDrugTestEvent(opts: {
  eventId: string;
  driverId: string;
  actor: string;
}): Promise<DrugTestEvent | null> {
  assertPersistable();
  const newTe = newTestingEventId();
  const ev = await secureUpdateDrugTest(opts.eventId, { testingEventId: newTe });
  recordSensitiveAudit({
    actor: opts.actor,
    action: "drug_test_unlink",
    driverId: opts.driverId,
    detail: `id=${opts.eventId} → te=${newTe}`,
  });
  notifyDriverHrRefresh();
  return ev;
}

/** Secure refresh bus (+ leftover mock subscribe for unit harness isolation). */
export function subscribeDrugTestMock(listener: () => void): () => void {
  const a = useDrugTestMock.subscribe(listener);
  const b = subscribeDriverHrRefresh(listener);
  return () => {
    a();
    b();
  };
}
