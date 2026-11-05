import { create } from "zustand";

/** Day-status focus for Attendance list (UI filter only). */
export type AttFocus = "all" | "active" | "leave" | "inactive" | "missing" | "review";

/**
 * Tiny UI nav bridge so Overview chips can open Attendance with a focus filter.
 * Not business data — never synced to Supabase.
 */
export const useAdminNav = create<{
  tabRequest: string | null;
  attFocus: AttFocus;
  requestAttendance: (focus?: AttFocus) => void;
  clearTabRequest: () => void;
  setAttFocus: (f: AttFocus) => void;
}>((set) => ({
  tabRequest: null,
  attFocus: "all",
  requestAttendance: (focus = "all") => set({ tabRequest: "attendance", attFocus: focus }),
  clearTabRequest: () => set({ tabRequest: null }),
  setAttFocus: (attFocus) => set({ attFocus }),
}));
