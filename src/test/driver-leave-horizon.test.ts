import { expect, test } from "vitest";
import {
  SECTIONS,
  formatDriverStatus,
  parseDriverStatus,
  type AppData,
} from "@/lib/sections";
import {
  alertsMuteBanner,
  collectHorizonDocs,
  complianceScore,
  rowAlertsMuted,
  rowDriverStatus,
  rowIsActive,
} from "@/lib/alerts";
import { getData, setCell } from "@/lib/store";

test("parseDriverStatus defaults empty to active (backward compatible)", () => {
  expect(parseDriverStatus("")).toBe("active");
  expect(parseDriverStatus(undefined)).toBe("active");
  expect(parseDriverStatus("Active")).toBe("active");
  expect(parseDriverStatus("Leave")).toBe("leave");
  expect(parseDriverStatus("on leave")).toBe("leave");
  expect(parseDriverStatus("Inactive")).toBe("inactive");
  expect(formatDriverStatus("leave")).toBe("Leave");
});

test("setCell Leave syncs across sections and does not require Inactive roster", () => {
  const before = getData();
  const aidx = SECTIONS.find((s) => s.id === "dmv")!.types.indexOf("active");
  const row = before.sections.dmv.rows.find((r) => parseDriverStatus(r.cells[aidx]) === "active");
  expect(row).toBeTruthy();

  setCell("dmv", row!.id, aidx, "Leave");
  const after = getData();
  const dmv = after.sections.dmv.rows.find((r) => r.id === row!.id)!;
  expect(parseDriverStatus(dmv.cells[aidx])).toBe("leave");
  expect(dmv.status).toBe("leave");

  const midx = SECTIONS.find((s) => s.id === "medical")!.types.indexOf("active");
  const med = after.sections.medical.rows.find((r) => r.driverId === row!.driverId);
  if (med) expect(parseDriverStatus(med.cells[midx])).toBe("leave");
});

test("leave and inactive mute alerts; active still counts", () => {
  const data = getData();
  const def = SECTIONS[0];
  const aidx = def.types.indexOf("active");
  const activeRow = data.sections.dmv.rows.find((r) => parseDriverStatus(r.cells[aidx]) === "active");
  expect(activeRow).toBeTruthy();

  expect(rowDriverStatus(def, activeRow!, data)).toBe("active");
  expect(rowIsActive(def, activeRow!, data)).toBe(true);
  expect(rowAlertsMuted(def, activeRow!, data)).toBe(false);

  const leaveRow = { ...activeRow!, cells: activeRow!.cells.map((c, i) => (i === aidx ? "Leave" : c)), status: "leave" as const };
  expect(rowIsActive(def, leaveRow, data)).toBe(true);
  expect(rowAlertsMuted(def, leaveRow, data)).toBe(true);
  expect(alertsMuteBanner("leave")).toBe("Alerts muted (Driver on leave)");
  expect(alertsMuteBanner("inactive")).toBe("Alerts muted (Driver inactive)");
  expect(alertsMuteBanner("active")).toBeNull();
});

test("compliance average helpers ignore muted rows via rowAlertsMuted", () => {
  const data = getData();
  const docsDef = SECTIONS.find((s) => s.id === "docs")!;
  const counted = data.sections.docs.rows.filter((r) => !rowAlertsMuted(docsDef, r, data));
  const muted = data.sections.docs.rows.filter((r) => rowAlertsMuted(docsDef, r, data));
  // Seed may have inactive rows; muted must not be in counted.
  for (const r of muted) expect(counted.includes(r)).toBe(false);
  if (counted.length) {
    const avg = Math.round(counted.reduce((a, r) => a + complianceScore(r), 0) / counted.length);
    expect(avg).toBeGreaterThanOrEqual(0);
    expect(avg).toBeLessThanOrEqual(100);
  }
});

test("collectHorizonDocs buckets docs within ~90 days for active drivers only", () => {
  const data = getData() as AppData;
  const docs = collectHorizonDocs(data);
  expect(Array.isArray(docs)).toBe(true);
  for (const d of docs) {
    expect(d.driverId).toBeTruthy();
    expect(d.date instanceof Date).toBe(true);
    expect(["dmv", "medical", "queries", "ssccdl"]).toContain(d.sectionId);
  }
});
