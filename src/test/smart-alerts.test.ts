import { buildSeed, type AppData, type Row } from "@/lib/sections";
import {
  buildSafetyDigest,
  collectSmartAlerts,
  fleetCompliancePct,
  smartAlertCounts,
} from "@/lib/alerts";
import { test, expect } from "vitest";

function row(partial: Partial<Row> & { cells: string[] }): Row {
  const r: Row = {
    id: partial.id ?? "r1",
    driverId: partial.driverId ?? "d1",
    cells: partial.cells,
  };
  if (partial.addedAt != null) r.addedAt = partial.addedAt;
  return r;
}

test("collectSmartAlerts groups critical / upcoming / incomplete", () => {
  const data = buildSeed();
  // Inject controlled rows into medical
  const med = data.sections.medical;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const iso = (offset: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    const m = `${d.getMonth() + 1}`.padStart(2, "0");
    const day = `${d.getDate()}`.padStart(2, "0");
    return `${d.getFullYear()}-${m}-${day}`;
  };
  med.rows = [
    row({
      id: "crit",
      driverId: "dc",
      cells: ["Crit Driver", "Valid", iso(3), "", "", "Active", "", ""],
    }),
    row({
      id: "up",
      driverId: "du",
      cells: ["Up Driver", "Valid", iso(15), "", "", "Active", "", ""],
    }),
    row({
      id: "miss",
      driverId: "dm",
      cells: ["Miss Driver", "Valid", "", "", "", "Active", "", ""],
    }),
    row({
      id: "far",
      driverId: "df",
      cells: ["Far Driver", "Valid", iso(90), "", "", "Active", "", ""],
    }),
  ];
  // Clear other dated sections so only medical drives the groups
  for (const id of ["dmv", "queries", "ssccdl"] as const) {
    data.sections[id].rows = [];
  }

  const alerts = collectSmartAlerts(data);
  expect(alerts.find((a) => a.driver === "Crit Driver")?.group).toBe("critical");
  expect(alerts.find((a) => a.driver === "Up Driver")?.group).toBe("upcoming");
  expect(alerts.find((a) => a.driver === "Miss Driver")?.group).toBe("incomplete");
  expect(alerts.find((a) => a.driver === "Far Driver")).toBeUndefined();

  const counts = smartAlertCounts(data);
  expect(counts.critical).toBe(1);
  expect(counts.upcoming).toBe(1);
  expect(counts.incomplete).toBe(1);
  expect(counts.total).toBe(3);
});

test("missing CDL targets drivers page", () => {
  const data = buildSeed();
  for (const id of ["dmv", "medical", "queries"] as const) data.sections[id].rows = [];
  data.sections.ssccdl.rows = [
    row({
      id: "cdl1",
      driverId: "d-cdl",
      cells: ["No CDL", "", "Missing", "", "Valid", "", "", "", "Active", ""],
    }),
  ];
  const alerts = collectSmartAlerts(data);
  const cdl = alerts.find((a) => a.document === "CDL");
  expect(cdl?.group).toBe("incomplete");
  expect(cdl?.target).toBe("drivers");
});

test("buildSafetyDigest includes totals and critical/upcoming lists", () => {
  const data = buildSeed() as AppData;
  const text = buildSafetyDigest(data);
  expect(text).toContain("Shaheen Transport — Safety Digest");
  expect(text).toContain("Total drivers:");
  expect(text).toContain("Fleet compliance:");
  expect(text).toContain("CRITICAL");
  expect(text).toContain("UPCOMING");
  expect(typeof fleetCompliancePct(data)).toBe("number");
});
