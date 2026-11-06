/**
 * Drug Test API — mock by default; secure when flag + migration applied.
 * Never persists into tracker_sections / AppData localStorage.
 * Soft-delete only (recoverable).
 */
import { getDriverDrugTestMode } from "./drug-test-mode";
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

export function listDrugTests(driverId: string, _actor = "portal"): DrugTestEvent[] {
  void _actor;
  return useDrugTestMock.getState().listForDriver(driverId);
}

export async function listDrugTestsAsync(driverId: string, actor = "portal"): Promise<DrugTestEvent[]> {
  if (getDriverDrugTestMode() === "secure") {
    try {
      const rows = await secureListDrugTests(driverId);
      recordSensitiveAudit({ actor, action: "drug_test_list", driverId, detail: `n=${rows.length}` });
      return rows;
    } catch {
      return [];
    }
  }
  return listDrugTests(driverId, actor);
}

export async function addDrugTestEvent(
  input: Omit<DrugTestEvent, "id" | "createdAt">,
  actor: string,
): Promise<DrugTestEvent> {
  const withGroup: Omit<DrugTestEvent, "id" | "createdAt"> = {
    ...input,
    testingEventId: input.testingEventId?.trim() || newTestingEventId(),
  };
  if (getDriverDrugTestMode() === "secure") {
    const ev = await secureAddDrugTest(withGroup);
    notifyDriverHrRefresh();
    return ev;
  }
  return useDrugTestMock.getState().add(withGroup, actor);
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
  if (getDriverDrugTestMode() === "secure") {
    const ev = await secureUpdateDrugTest(id, patch);
    notifyDriverHrRefresh();
    return ev;
  }
  return useDrugTestMock.getState().update(id, patch, actor);
}

/** Soft-delete (recoverable). */
export async function deleteDrugTestEvent(id: string, actor: string): Promise<boolean> {
  if (getDriverDrugTestMode() === "secure") {
    await secureDeleteDrugTest(id);
    notifyDriverHrRefresh();
    return true;
  }
  return useDrugTestMock.getState().remove(id, actor);
}

export async function restoreDrugTestEvent(id: string, actor: string): Promise<DrugTestEvent | null> {
  if (getDriverDrugTestMode() === "secure") {
    const ev = await secureRestoreDrugTest(id);
    notifyDriverHrRefresh();
    return ev;
  }
  return useDrugTestMock.getState().restore(id, actor);
}

/** Mock store + secure refresh bus. */
export function subscribeDrugTestMock(listener: () => void): () => void {
  const a = useDrugTestMock.subscribe(listener);
  const b = subscribeDriverHrRefresh(listener);
  return () => {
    a();
    b();
  };
}
