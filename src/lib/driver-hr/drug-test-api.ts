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
import { newTestingEventId, type DrugTestEvent } from "./drug-tests";
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
      recordSensitiveAudit({ actor, action: "drug_test_list", driverId, detail: `n=${rows.length}` });
      return { events: rows, error: null, secure: true };
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
  const unique = [...new Set(driverIds.filter(Boolean))];
  const settled = await Promise.all(
    unique.map(async (id) => {
      try {
        const rows = await secureListDrugTests(id);
        recordSensitiveAudit({ actor, action: "drug_test_list", driverId: id, detail: `n=${rows.length}` });
        return { rows, error: null as string | null };
      } catch (e) {
        return {
          rows: [] as DrugTestEvent[],
          error: e instanceof Error ? e.message : "Failed to load drug test records",
        };
      }
    }),
  );
  const events = settled.flatMap((s) => s.rows);
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
    testingEventId: input.testingEventId?.trim() || newTestingEventId(),
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

/** Secure refresh bus (+ leftover mock subscribe for unit harness isolation). */
export function subscribeDrugTestMock(listener: () => void): () => void {
  const a = useDrugTestMock.subscribe(listener);
  const b = subscribeDriverHrRefresh(listener);
  return () => {
    a();
    b();
  };
}
