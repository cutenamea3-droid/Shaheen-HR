/**
 * Isolated secure-memory backend — mirrors Driver RPC semantics for CI / staging tests.
 *
 * NOT prod. NOT tracker_sections. NOT AppData localStorage.
 * Simulates independent persistent tables so save → “reload” → still present,
 * without writing live Supabase.
 */
import {
  emptyRateCard,
  normalizeRateInput,
  type DriverRateCard,
  type RatePayMethod,
} from "./rate-card-types";
import type { DrugTestEvent } from "./drug-tests";
import { recordSensitiveAudit } from "./sensitive-audit";

function scrubRates(rates: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(rates)) {
    const t = (v ?? "").trim();
    if (t) out[k] = t;
  }
  return out;
}

const rateCards = new Map<string, DriverRateCard>();
const drugEvents = new Map<string, DrugTestEvent>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function subscribeSecureMemory(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function clearSecureMemory() {
  rateCards.clear();
  drugEvents.clear();
  emit();
}

/** Simulate process restart / new page load within the same test process by cloning maps. */
export function snapshotSecureMemory() {
  return {
    rates: new Map(rateCards),
    drugs: new Map(drugEvents),
  };
}

export function restoreSecureMemory(snap: ReturnType<typeof snapshotSecureMemory>) {
  rateCards.clear();
  drugEvents.clear();
  for (const [k, v] of snap.rates) rateCards.set(k, { ...v, rates: { ...v.rates } });
  for (const [k, v] of snap.drugs) drugEvents.set(k, { ...v });
  emit();
}

// ---- Rate cards (independent of drug events) ----

export function memoryGetRateCard(driverId: string, actor = "test"): DriverRateCard {
  recordSensitiveAudit({ actor, action: "rate_card_view", driverId });
  return rateCards.get(driverId) ?? emptyRateCard(driverId);
}

export function memoryUpsertRateCard(card: DriverRateCard, actor = "test"): DriverRateCard {
  const next: DriverRateCard = {
    ...card,
    rates: scrubRates(card.rates),
    payMethod: card.payMethod,
    payMethodNote: card.payMethodNote ?? "",
    updatedAt: Date.now(),
  };
  rateCards.set(card.driverId, next);
  recordSensitiveAudit({ actor, action: "rate_card_upsert", driverId: card.driverId });
  emit();
  return { ...next, rates: { ...next.rates } };
}

export function memorySetRateField(
  driverId: string,
  key: string,
  raw: string,
  actor = "test",
): { ok: true; card: DriverRateCard } | { ok: false; error: string } {
  const norm = normalizeRateInput(raw);
  if (norm === null) return { ok: false, error: "Enter a number (decimals allowed) or leave blank." };
  const prev = memoryGetRateCard(driverId, actor);
  const rates = { ...prev.rates };
  if (norm === "") delete rates[key];
  else rates[key] = norm;
  return { ok: true, card: memoryUpsertRateCard({ ...prev, rates }, actor) };
}

export function memorySetPayMethod(
  driverId: string,
  payMethod: RatePayMethod,
  payMethodNote?: string,
  actor = "test",
): DriverRateCard {
  const prev = memoryGetRateCard(driverId, actor);
  return memoryUpsertRateCard(
    {
      ...prev,
      payMethod,
      payMethodNote: payMethodNote !== undefined ? payMethodNote : prev.payMethodNote,
    },
    actor,
  );
}

// ---- Drug tests (independent of rate cards) ----

export function memoryListDrugTests(driverId: string, actor = "test"): DrugTestEvent[] {
  recordSensitiveAudit({ actor, action: "drug_test_list", driverId });
  return [...drugEvents.values()]
    .filter((e) => e.driverId === driverId)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((e) => ({ ...e }));
}

export function memoryAddDrugTest(
  input: Omit<DrugTestEvent, "id" | "createdAt">,
  actor = "test",
): DrugTestEvent {
  const ev: DrugTestEvent = {
    ...input,
    id: crypto.randomUUID?.() ?? `mem_${Math.random().toString(36).slice(2)}`,
    specimenId: input.specimenId ?? "",
    reason: input.reason ?? "",
    collectionContext: input.collectionContext ?? "",
    eventDate: input.eventDate ?? "",
    notes: input.notes ?? "",
    createdAt: Date.now(),
  };
  drugEvents.set(ev.id, ev);
  recordSensitiveAudit({
    actor,
    action: "drug_test_add",
    driverId: ev.driverId,
    detail: `specimen=${ev.specimenId}`,
  });
  emit();
  return { ...ev };
}

export function memoryUpdateDrugTest(
  id: string,
  patch: Partial<Pick<DrugTestEvent, "kind" | "specimenId" | "reason" | "collectionContext" | "eventDate" | "notes">>,
  actor = "test",
): DrugTestEvent | null {
  const prev = drugEvents.get(id);
  if (!prev) return null;
  const next: DrugTestEvent = {
    ...prev,
    kind: patch.kind !== undefined ? patch.kind : prev.kind,
    specimenId: patch.specimenId !== undefined ? patch.specimenId : prev.specimenId,
    reason: patch.reason !== undefined ? patch.reason : prev.reason,
    collectionContext: patch.collectionContext !== undefined ? patch.collectionContext : prev.collectionContext,
    eventDate: patch.eventDate !== undefined ? patch.eventDate : prev.eventDate,
    notes: patch.notes !== undefined ? patch.notes : prev.notes,
  };
  drugEvents.set(id, next);
  recordSensitiveAudit({ actor, action: "drug_test_update", driverId: next.driverId, detail: id });
  emit();
  return { ...next };
}

export function memoryDeleteDrugTest(id: string, actor = "test"): boolean {
  const prev = drugEvents.get(id);
  if (!prev) return false;
  drugEvents.delete(id);
  recordSensitiveAudit({ actor, action: "drug_test_delete", driverId: prev.driverId, detail: id });
  emit();
  return true;
}
