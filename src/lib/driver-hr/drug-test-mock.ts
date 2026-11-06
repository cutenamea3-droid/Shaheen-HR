/**
 * In-memory ONLY drug test events.
 * Does NOT use localStorage, sessionStorage, or tracker_sections.
 * Never invents historical tests — starts empty. Soft-delete only.
 */
import { create } from "zustand";
import { newTestingEventId, type DrugTestEvent } from "./drug-tests";
import { recordSensitiveAudit } from "./sensitive-audit";

const uid = () => "dt_" + Math.random().toString(36).slice(2, 10);

type DrugTestState = {
  events: DrugTestEvent[];
  listForDriver: (driverId: string) => DrugTestEvent[];
  add: (
    input: Omit<DrugTestEvent, "id" | "createdAt"> & { id?: string; createdAt?: number },
    actor: string,
  ) => DrugTestEvent;
  update: (
    id: string,
    patch: Partial<
      Pick<
        DrugTestEvent,
        "kind" | "specimenId" | "reason" | "collectionContext" | "eventDate" | "notes" | "testingEventId"
      >
    >,
    actor: string,
  ) => DrugTestEvent | null;
  /** Soft-delete (recoverable). */
  remove: (id: string, actor: string) => boolean;
  restore: (id: string, actor: string) => DrugTestEvent | null;
  clearAll: () => void;
};

export const useDrugTestMock = create<DrugTestState>((set, get) => ({
  events: [],
  listForDriver: (driverId) =>
    get().events.filter((e) => e.driverId === driverId && !e.deletedAt),
  add: (input, actor) => {
    const ev: DrugTestEvent = {
      id: input.id ?? uid(),
      driverId: input.driverId,
      testingEventId: input.testingEventId?.trim() || newTestingEventId(),
      kind: input.kind,
      specimenId: input.specimenId ?? "",
      reason: input.reason ?? "",
      collectionContext: input.collectionContext ?? "",
      eventDate: input.eventDate ?? "",
      notes: input.notes ?? "",
      createdAt: input.createdAt ?? Date.now(),
    };
    set((s) => ({ events: [ev, ...s.events] }));
    recordSensitiveAudit({
      actor,
      action: "drug_test_add",
      driverId: ev.driverId,
      detail: `${ev.kind || "incomplete"} specimen=${ev.specimenId || "—"} te=${ev.testingEventId}`,
    });
    return ev;
  },
  update: (id, patch, actor) => {
    const prev = get().events.find((e) => e.id === id && !e.deletedAt);
    if (!prev) return null;
    const next: DrugTestEvent = {
      ...prev,
      kind: patch.kind !== undefined ? patch.kind : prev.kind,
      specimenId: patch.specimenId !== undefined ? patch.specimenId : prev.specimenId,
      reason: patch.reason !== undefined ? patch.reason : prev.reason,
      collectionContext:
        patch.collectionContext !== undefined ? patch.collectionContext : prev.collectionContext,
      eventDate: patch.eventDate !== undefined ? patch.eventDate : prev.eventDate,
      notes: patch.notes !== undefined ? patch.notes : prev.notes,
      testingEventId:
        patch.testingEventId !== undefined && patch.testingEventId.trim()
          ? patch.testingEventId.trim()
          : prev.testingEventId,
    };
    set((s) => ({ events: s.events.map((e) => (e.id === id ? next : e)) }));
    recordSensitiveAudit({
      actor,
      action: "drug_test_update",
      driverId: next.driverId,
      detail: JSON.stringify({ id, before: prev, correction: true }),
    });
    return next;
  },
  remove: (id, actor) => {
    const prev = get().events.find((e) => e.id === id && !e.deletedAt);
    if (!prev) return false;
    const next = { ...prev, deletedAt: Date.now() };
    set((s) => ({ events: s.events.map((e) => (e.id === id ? next : e)) }));
    recordSensitiveAudit({
      actor,
      action: "drug_test_soft_delete",
      driverId: prev.driverId,
      detail: `id=${id}`,
    });
    return true;
  },
  restore: (id, actor) => {
    const prev = get().events.find((e) => e.id === id && e.deletedAt);
    if (!prev) return null;
    const { deletedAt: _removed, ...rest } = prev;
    void _removed;
    const next: DrugTestEvent = { ...rest };
    set((s) => ({ events: s.events.map((e) => (e.id === id ? next : e)) }));
    recordSensitiveAudit({
      actor,
      action: "drug_test_restore",
      driverId: prev.driverId,
      detail: `id=${id}`,
    });
    return next;
  },
  clearAll: () => set({ events: [] }),
}));
