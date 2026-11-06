/**
 * In-memory ONLY mock for driver rate cards.
 * Does NOT use localStorage, sessionStorage, or tracker_sections.
 */
import { create } from "zustand";
import {
  emptyRateCard,
  normalizeRateInput,
  type DriverRateCard,
  type RatePayMethod,
} from "./rate-card-types";

type RateCardState = {
  byDriver: Record<string, DriverRateCard>;
  get: (driverId: string) => DriverRateCard;
  upsert: (driverId: string, patch: Partial<Omit<DriverRateCard, "driverId">>) => DriverRateCard;
  setRate: (driverId: string, key: string, raw: string) => { ok: true; card: DriverRateCard } | { ok: false; error: string };
  setPayMethod: (driverId: string, payMethod: RatePayMethod, payMethodNote?: string) => DriverRateCard;
  clearAll: () => void;
};

export const useRateCardMock = create<RateCardState>((set, get) => ({
  byDriver: {},
  get: (driverId) => get().byDriver[driverId] ?? emptyRateCard(driverId),
  upsert: (driverId, patch) => {
    const prev = get().byDriver[driverId] ?? emptyRateCard(driverId);
    const next: DriverRateCard = {
      ...prev,
      ...patch,
      driverId,
      // Replace rates object when provided so cleared keys stay cleared (blank ≠ keep prior).
      rates: patch.rates !== undefined ? { ...patch.rates } : prev.rates,
      updatedAt: Date.now(),
    };
    set((s) => ({ byDriver: { ...s.byDriver, [driverId]: next } }));
    return next;
  },
  setRate: (driverId, key, raw) => {
    const norm = normalizeRateInput(raw);
    if (norm === null) return { ok: false, error: "Enter a number (decimals allowed) or leave blank." };
    const prev = get().byDriver[driverId] ?? emptyRateCard(driverId);
    const rates = { ...prev.rates };
    if (norm === "") delete rates[key];
    else rates[key] = norm;
    const card = get().upsert(driverId, { rates });
    return { ok: true, card };
  },
  setPayMethod: (driverId, payMethod, payMethodNote) => {
    return get().upsert(driverId, {
      payMethod,
      ...(payMethodNote !== undefined ? { payMethodNote } : {}),
    });
  },
  clearAll: () => set({ byDriver: {} }),
}));
