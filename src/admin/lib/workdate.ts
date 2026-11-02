import { create } from "zustand";
import { todayStr } from "@/admin/components/hr/common";

/** Shared working date for Attendance and Performance, kept while switching tabs. */
export const useWorkDate = create<{ date: string; setDate: (d: string) => void }>()((set) => ({
  date: todayStr(),
  setDate: (date) => set({ date }),
}));
