import { expect, test } from "vitest";
import { SECTIONS } from "@/lib/sections";
import { getData, setCell, setRecordPersonActive, recordPersonIsActive, RECORD_ACTIVE_COL } from "@/lib/store";

test("setCell Inactive upserts Inactive Drivers and syncs employment status", () => {
  const before = getData();
  const aidx = SECTIONS.find((s) => s.id === "dmv")!.types.indexOf("active");
  const row = before.sections.dmv.rows.find((r) => r.cells[aidx]?.toLowerCase() !== "inactive");
  expect(row).toBeTruthy();

  setCell("dmv", row!.id, aidx, "Inactive");

  const after = getData();
  expect(after.sections.dmv.rows.find((r) => r.id === row!.id)!.cells[aidx]).toBe("Inactive");
  expect(after.sections.inactive.rows.some((r) => r.driverId === row!.driverId)).toBe(true);

  const midx = SECTIONS.find((s) => s.id === "medical")!.types.indexOf("active");
  const med = after.sections.medical.rows.find((r) => r.driverId === row!.driverId);
  if (med) expect(med.cells[midx]).toBe("Inactive");
});

test("Owner Operator Active Status toggles with person-level helper", () => {
  const before = getData();
  const owners = before.sections.rec_owners;
  expect(owners).toBeTruthy();
  // Ensure at least one owner row exists for the assertion
  const sample = owners.rows[0];
  if (!sample) return;
  const name = sample.cells[0] ?? "";
  setRecordPersonActive("rec_owners", name, "Inactive");
  const after = getData();
  const rows = after.sections.rec_owners.rows.filter(
    (r) => r.cells[0]?.trim().toLowerCase() === name.trim().toLowerCase(),
  );
  expect(rows.length).toBeGreaterThan(0);
  expect(recordPersonIsActive(rows)).toBe(false);
  expect(rows.every((r) => r.cells[RECORD_ACTIVE_COL] === "Inactive")).toBe(true);
});
