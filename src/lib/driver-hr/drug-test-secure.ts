/**
 * Secure Drug Test client — admin RPCs on Driver Supabase (migration required).
 */
import { supabase } from "@/integrations/supabase/client";
import type { DrugDocKind, DrugTestEvent } from "./drug-tests";
import { parseDrugDocKind } from "./drug-tests";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

function mapRow(row: {
  id: string;
  driver_id: string;
  testing_event_id?: string | null;
  kind: string | null;
  specimen_id: string | null;
  reason: string | null;
  collection_context: string | null;
  event_date: string | null;
  notes: string | null;
  created_at: string;
  deleted_at?: string | null;
}): DrugTestEvent {
  const deletedMs = row.deleted_at ? Date.parse(row.deleted_at) : NaN;
  const base: DrugTestEvent = {
    id: row.id,
    driverId: row.driver_id,
    testingEventId: row.testing_event_id ?? row.id,
    kind: parseDrugDocKind(row.kind) as DrugDocKind | "",
    specimenId: row.specimen_id ?? "",
    reason: row.reason ?? "",
    collectionContext: row.collection_context ?? "",
    eventDate: row.event_date ?? "",
    notes: row.notes ?? "",
    createdAt: Date.parse(row.created_at) || 0,
  };
  if (Number.isFinite(deletedMs)) base.deletedAt = deletedMs;
  return base;
}

export async function secureListDrugTests(driverId: string): Promise<DrugTestEvent[]> {
  const { data, error } = await db.rpc("driver_drug_test_list", { p_driver_id: driverId });
  if (error) throw new Error(error.message);
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  return rows.map(mapRow);
}

export async function secureAddDrugTest(
  ev: Omit<DrugTestEvent, "id" | "createdAt">,
): Promise<DrugTestEvent> {
  const { data, error } = await db.rpc("driver_drug_test_add", {
    p_driver_id: ev.driverId,
    p_kind: ev.kind || null,
    p_specimen_id: ev.specimenId || null,
    p_reason: ev.reason || null,
    p_collection_context: ev.collectionContext || null,
    p_event_date: ev.eventDate || null,
    p_notes: ev.notes || null,
    p_testing_event_id: ev.testingEventId || null,
  });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return mapRow(row);
}

export async function secureUpdateDrugTest(
  id: string,
  patch: Partial<
    Pick<
      DrugTestEvent,
      "kind" | "specimenId" | "reason" | "collectionContext" | "eventDate" | "notes" | "testingEventId"
    >
  >,
): Promise<DrugTestEvent> {
  const { data, error } = await db.rpc("driver_drug_test_update", {
    p_id: id,
    p_kind: patch.kind !== undefined ? patch.kind || null : undefined,
    p_specimen_id: patch.specimenId,
    p_reason: patch.reason,
    p_collection_context: patch.collectionContext,
    p_event_date: patch.eventDate,
    p_notes: patch.notes,
    p_testing_event_id: patch.testingEventId || undefined,
  });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return mapRow(row);
}

/** Soft-delete (recoverable). */
export async function secureDeleteDrugTest(id: string): Promise<void> {
  const { error } = await db.rpc("driver_drug_test_delete", { p_id: id });
  if (error) throw new Error(error.message);
}

export async function secureRestoreDrugTest(id: string): Promise<DrugTestEvent> {
  const { data, error } = await db.rpc("driver_drug_test_restore", { p_id: id });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return mapRow(row);
}
