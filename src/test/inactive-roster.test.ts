import { expect, test } from "vitest";
import { buildSeed, migrateData, syncInactiveRoster, SECTIONS } from "@/lib/sections";

test("migrate backfills Inactive Drivers for every Inactive employment status", () => {
  const d = buildSeed();
  const aidx = SECTIONS.find((s) => s.id === "dmv")!.types.indexOf("active");
  const inactiveIds = new Set(
    d.sections.dmv.rows.filter((r) => r.cells[aidx]?.toLowerCase() === "inactive").map((r) => r.driverId),
  );
  for (const id of inactiveIds) {
    expect(d.sections.inactive.rows.some((r) => r.driverId === id)).toBe(true);
  }
  const inaIdx = SECTIONS.find((s) => s.id === "inactive")!.types.indexOf("active");
  for (const id of inactiveIds) {
    const row = d.sections.inactive.rows.find((r) => r.driverId === id)!;
    expect(row.cells[inaIdx].toLowerCase()).toBe("inactive");
  }
});

test("syncInactiveRoster adds a missing inactive row without dropping existing ones", () => {
  const base = buildSeed();
  const driver = base.sections.dmv.rows.find((r) => r.cells[0]?.includes("Alejandro"))!;
  const aidx = SECTIONS.find((s) => s.id === "dmv")!.types.indexOf("active");
  // Strip Alejandro from inactive roster, mark him Inactive in DMV only.
  const stripped = {
    ...base,
    sections: {
      ...base.sections,
      dmv: {
        ...base.sections.dmv,
        rows: base.sections.dmv.rows.map((r) =>
          r.driverId === driver.driverId
            ? { ...r, cells: r.cells.map((c, i) => (i === aidx ? "Inactive" : c)) }
            : r,
        ),
      },
      inactive: {
        ...base.sections.inactive,
        rows: base.sections.inactive.rows.filter((r) => r.driverId !== driver.driverId),
      },
    },
  };
  const { data, changed } = syncInactiveRoster(stripped);
  expect(changed).toContain("inactive");
  expect(data.sections.inactive.rows.some((r) => r.driverId === driver.driverId)).toBe(true);
  // Denise-only inactive rows remain
  expect(data.sections.inactive.rows.some((r) => /Denise/i.test(r.cells[0] ?? ""))).toBe(true);
});

test("migrateData is idempotent for inactive roster", () => {
  const once = migrateData(buildSeed()).data;
  const twice = migrateData(once);
  expect(twice.changed.includes("inactive")).toBe(false);
});
