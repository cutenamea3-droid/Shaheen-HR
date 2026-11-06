/**
 * In-memory ONLY drug test events.
 * Does NOT use localStorage, sessionStorage, or tracker_sections.
 * Never invents historical tests — starts empty.
 */
import { create } from "zustand";
import type { DrugTestEvent } from "./drug-tests";
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
    patch: Partial<Pick<DrugTestEvent, "kind" | "specimenId" | "reason" | "collectionContext" | "eventDate" | "notes">>,
    actor: string,
  ) => DrugTestEvent | null;
  remove: (id: string, actor: string) => boolean;
  clearAll: () => void;
};

export const useDrugTestMock = create<DrugTestState>((set, get) => ({
  events: [],
  listForDriver: (driverId) => get().events.filter((e) => e.driverId === driverId),
  add: (input, actor) => {
    const ev: DrugTestEvent = {
      id: input.id ?? uid(),
      driverId: input.driverId,
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
      detail: `${ev.kind || "incomplete"} specimen=${ev.specimenId || "—"}`,
    });
    return ev;
  },
  update: (id, patch, actor) => {
    const prev = get().events.find((e) => e.id === id);
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
    };
    set((s) => ({ events: s.events.map((e) => (e.id === id ? next : e)) }));
    recordSensitiveAudit({
      actor,
      action: "drug_test_update",
      driverId: next.driverId,
      detail: `id=${id}`,
    });
    return next;
  },
  remove: (id, actor) => {
    const prev = get().events.find((e) => e.id === id);
    if (!prev) return false;
    set((s) => ({ events: s.events.filter((e) => e.id !== id) }));
    recordSensitiveAudit({
      actor,
      action: "drug_test_delete",
      driverId: prev.driverId,
      detail: `id=${id}`,
    });
    return true;
  },
  clearAll: () => set({ events: [] }),
}));
