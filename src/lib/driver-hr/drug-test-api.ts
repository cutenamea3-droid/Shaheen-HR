/**
 * Drug Test API — mock by default; secure when flag + migration applied.
 * Never persists into tracker_sections / AppData localStorage.
 */
import { getDriverDrugTestMode } from "./drug-test-mode";
import { useDrugTestMock } from "./drug-test-mock";
import {
  secureAddDrugTest,
  secureDeleteDrugTest,
  secureListDrugTests,
  secureUpdateDrugTest,
} from "./drug-test-secure";
import type { DrugTestEvent } from "./drug-tests";
import { recordSensitiveAudit } from "./sensitive-audit";
import { notifyDriverHrRefresh, subscribeDriverHrRefresh } from "./refresh-bus";

export function listDrugTests(driverId: string, _actor = "portal"): DrugTestEvent[] {
  void _actor;
  // Sync peek for React — no audit spam on every re-render.
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
  if (getDriverDrugTestMode() === "secure") {
    const ev = await secureAddDrugTest(input);
    notifyDriverHrRefresh();
    return ev;
  }
  return useDrugTestMock.getState().add(input, actor);
}

export async function updateDrugTestEvent(
  id: string,
  patch: Partial<Pick<DrugTestEvent, "kind" | "specimenId" | "reason" | "collectionContext" | "eventDate" | "notes">>,
  actor: string,
): Promise<DrugTestEvent | null> {
  if (getDriverDrugTestMode() === "secure") {
    const ev = await secureUpdateDrugTest(id, patch);
    notifyDriverHrRefresh();
    return ev;
  }
  return useDrugTestMock.getState().update(id, patch, actor);
}

export async function deleteDrugTestEvent(id: string, actor: string): Promise<boolean> {
  if (getDriverDrugTestMode() === "secure") {
    await secureDeleteDrugTest(id);
    notifyDriverHrRefresh();
    return true;
  }
  return useDrugTestMock.getState().remove(id, actor);
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
