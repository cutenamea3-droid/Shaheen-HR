/**
 * Shared Rate Card API — mock by default; secure when flag + migration applied.
 */
import { getDriverRateCardMode } from "./rate-card-mode";
import { useRateCardMock } from "./rate-card-mock";
import { secureGetRateCard, secureUpsertRateCard } from "./rate-card-secure";
import {
  emptyRateCard,
  normalizeRateInput,
  type DriverRateCard,
  type RatePayMethod,
} from "./rate-card-types";
import { recordSensitiveAudit } from "./sensitive-audit";
import { notifyDriverHrRefresh, subscribeDriverHrRefresh } from "./refresh-bus";

export async function getRateCard(driverId: string, actor = "portal"): Promise<DriverRateCard> {
  if (getDriverRateCardMode() === "secure") {
    try {
      const card = await secureGetRateCard(driverId);
      recordSensitiveAudit({ actor, action: "rate_card_view", driverId });
      return card;
    } catch {
      // Fall back to empty — do not invent rates; surface empty until backend ready.
      return emptyRateCard(driverId);
    }
  }
  return useRateCardMock.getState().get(driverId);
}

export async function setRateField(
  driverId: string,
  key: string,
  raw: string,
  actor = "portal",
): Promise<{ ok: true; card: DriverRateCard } | { ok: false; error: string }> {
  const norm = normalizeRateInput(raw);
  if (norm === null) return { ok: false, error: "Enter a number (decimals allowed) or leave blank." };

  if (getDriverRateCardMode() === "secure") {
    const prev = await getRateCard(driverId, actor);
    const rates = { ...prev.rates };
    if (norm === "") delete rates[key];
    else rates[key] = norm;
    const card = await secureUpsertRateCard({ ...prev, rates, updatedAt: Date.now() });
    // Round-trip get to match DB scrub semantics after apply.
    const reloaded = await secureGetRateCard(driverId).catch(() => card);
    recordSensitiveAudit({ actor, action: "rate_card_upsert", driverId, detail: key });
    notifyDriverHrRefresh();
    return { ok: true, card: reloaded };
  }
  const result = useRateCardMock.getState().setRate(driverId, key, raw);
  if (result.ok) recordSensitiveAudit({ actor, action: "rate_card_upsert", driverId, detail: key });
  return result;
}

export async function setPayMethod(
  driverId: string,
  payMethod: RatePayMethod,
  payMethodNote?: string,
  actor = "portal",
): Promise<DriverRateCard> {
  if (getDriverRateCardMode() === "secure") {
    const prev = await getRateCard(driverId, actor);
    await secureUpsertRateCard({
      ...prev,
      payMethod,
      payMethodNote: payMethodNote !== undefined ? payMethodNote : prev.payMethodNote,
      updatedAt: Date.now(),
    });
    const reloaded = await secureGetRateCard(driverId).catch(() => prev);
    recordSensitiveAudit({ actor, action: "rate_card_upsert", driverId, detail: "payMethod" });
    notifyDriverHrRefresh();
    return reloaded;
  }
  const card = useRateCardMock.getState().setPayMethod(driverId, payMethod, payMethodNote);
  recordSensitiveAudit({ actor, action: "rate_card_upsert", driverId, detail: "payMethod" });
  return card;
}

/** Subscribe for mock + secure refresh reactivity. */
export function subscribeRateCardMock(listener: () => void): () => void {
  const a = useRateCardMock.subscribe(listener);
  const b = subscribeDriverHrRefresh(listener);
  return () => {
    a();
    b();
  };
}

export function peekRateCardMock(driverId: string): DriverRateCard {
  return useRateCardMock.getState().get(driverId);
}
