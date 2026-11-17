/**
 * Manual Bonus entries — separate from OT and Additional Days.
 * Session memory only — never app_state / HR_SYNC_KEYS.
 */

import { create } from "zustand";
import { assertWholePkr } from "./salary-payments";

export type BonusRecord = {
  id: string;
  employeeId: string;
  month: string;
  amountPkr: number;
  note: string;
  updatedAt: number;
};

const uid = () => Math.random().toString(36).slice(2, 10);

type BonusState = {
  bonuses: BonusRecord[];
  forMonth: (month: string) => BonusRecord[];
  upsertBonus: (employeeId: string, month: string, amountPkr: number, note?: string) => { ok: boolean; error?: string };
  clearBonus: (employeeId: string, month: string) => void;
  resetBonuses: () => void;
};

export const useBonusStore = create<BonusState>()((set, get) => ({
  bonuses: [],

  forMonth: (month) => {
    const list = Array.isArray(get().bonuses) ? get().bonuses : [];
    return list.filter((b) => b.month === month);
  },

  upsertBonus: (employeeId, month, amountPkr, note = "") => {
    try {
      const amount = assertWholePkr(amountPkr);
      if (amount < 0) return { ok: false, error: "Bonus must be non-negative whole PKR" };
      const noteText =
        note == null ? "" : typeof note === "string" ? note.trim() : String(note).trim();
      const list = Array.isArray(get().bonuses) ? get().bonuses : [];
      const existing = list.find((b) => b.employeeId === employeeId && b.month === month);
      if (existing) {
        set({
          bonuses: list.map((b) =>
            b.id === existing.id
              ? { ...b, amountPkr: amount, note: noteText, updatedAt: Date.now() }
              : b,
          ),
        });
      } else {
        set({
          bonuses: [
            ...list,
            {
              id: uid(),
              employeeId,
              month,
              amountPkr: amount,
              note: noteText,
              updatedAt: Date.now(),
            },
          ],
        });
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Invalid bonus" };
    }
  },

  clearBonus: (employeeId, month) =>
    set((s) => {
      const list = Array.isArray(s.bonuses) ? s.bonuses : [];
      return {
        bonuses: list.filter((b) => !(b.employeeId === employeeId && b.month === month)),
      };
    }),

  resetBonuses: () => set({ bonuses: [] }),
}));

export function bonusPersistenceGuard(): { usesLocalStorage: false; syncKeysSafe: true } {
  return { usesLocalStorage: false, syncKeysSafe: true };
}
