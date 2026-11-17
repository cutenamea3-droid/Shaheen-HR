import { beforeEach, describe, expect, it } from "vitest";
import { loadAttendancePrefs, saveAttendancePrefs } from "@/lib/uiprefs";

const ATTENDANCE_KEY = "shaheen-ui-pref-attendance";

describe("uiprefs attendance expanded guards", () => {
  beforeEach(() => {
    localStorage.removeItem(ATTENDANCE_KEY);
  });

  it("heals non-object expanded to undefined without throwing", () => {
    localStorage.setItem(ATTENDANCE_KEY, JSON.stringify({ focus: "active", expanded: ["bad"] }));
    const p = loadAttendancePrefs();
    expect(p.focus).toBe("active");
    expect(p.expanded).toBeUndefined();
  });

  it("preserves valid expanded map", () => {
    saveAttendancePrefs({ focus: "all", expanded: { e1: true } });
    const p = loadAttendancePrefs();
    expect(p.expanded).toEqual({ e1: true });
  });
});
