import { create } from "zustand";

/** Day-status focus for Attendance list (UI filter only). */
export type AttFocus = "all" | "active" | "leave" | "inactive" | "missing" | "review";

/**
 * Tiny UI nav bridge so Overview / My HR Today chips can open other Admin tabs.
 * Not business data — never synced to Supabase.
 */
export const useAdminNav = create<{
  tabRequest: string | null;
  attFocus: AttFocus;
  requestAttendance: (focus?: AttFocus) => void;
  requestTab: (tab: string, focus?: AttFocus) => void;
  clearTabRequest: () => void;
  setAttFocus: (f: AttFocus) => void;
}>((set) => ({
  tabRequest: null,
  attFocus: "all",
  requestAttendance: (focus = "all") => set({ tabRequest: "attendance", attFocus: focus }),
  requestTab: (tab, focus) =>
    set((s) => ({
      tabRequest: tab,
      attFocus: focus ?? s.attFocus,
    })),
  clearTabRequest: () => set({ tabRequest: null }),
  setAttFocus: (attFocus) => set({ attFocus }),
}));
