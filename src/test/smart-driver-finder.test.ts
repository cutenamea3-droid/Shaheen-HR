/**
 * Smart Driver Finder — index labels + search values (read-only, no mutations).
 */
import { expect, test } from "vitest";
import { applyRosterKind, applyDriverClass } from "@/lib/driver-meta";
import {
  buildFinderDrivers,
  finderSearchValue,
  formatExpiringLabel,
  formatScopeShort,
} from "@/lib/quick-find";
import { buildSeed, SECTIONS, type AppData, type Row } from "@/lib/sections";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

function firstDmv(data: AppData): Row {
  const r = data.sections.dmv.rows[0];
  expect(r).toBeTruthy();
  return r;
}

test("formatExpiringLabel never claims None unless checked", () => {
  expect(formatExpiringLabel({ expiryChecked: false, expiring: 0 })).toBe("Not checked.");
  expect(formatExpiringLabel({ expiryChecked: true, expiring: 0 })).toBe("None expiring");
  expect(formatExpiringLabel({ expiryChecked: true, expiring: 2 })).toBe("2 expiring");
});

test("formatScopeShort maps list scopes", () => {
  expect(formatScopeShort("company")).toBe("Company");
  expect(formatScopeShort("owner_operator")).toBe("OO");
  expect(formatScopeShort("new")).toBe("New");
});

test("buildFinderDrivers indexes name, CDL, id and real meta from seed", () => {
  const data = buildSeed();
  const list = buildFinderDrivers(data);
  expect(list.length).toBeGreaterThan(10);

  const withCdl = list.find((d) => d.cdl.trim().length > 0);
  expect(withCdl).toBeTruthy();
  expect(withCdl!.expiryChecked).toBe(true);
  expect(finderSearchValue(withCdl!)).toContain(withCdl!.driverId);
  expect(finderSearchValue(withCdl!)).toContain(withCdl!.name);

  // Every entry has stable id; selecting would navigate by that id only.
  for (const d of list.slice(0, 30)) {
    expect(d.driverId.length).toBeGreaterThan(0);
    expect(["Active", "Leave", "Inactive", "New"]).toContain(d.employmentLabel);
  }
});

test("New / OO badges come from real meta — not invented on seed", () => {
  let data = clone(buildSeed());
  const id = firstDmv(data).driverId;
  expect(buildFinderDrivers(data).find((d) => d.driverId === id)?.employmentLabel).not.toBe("New");

  data = applyRosterKind(data, id, "new");
  const asNew = buildFinderDrivers(data).find((d) => d.driverId === id)!;
  expect(asNew.employmentLabel).toBe("New");
  expect(asNew.scope).toBe("new");
  expect(formatScopeShort(asNew.scope)).toBe("New");

  data = applyRosterKind(data, id, "roster");
  data = applyDriverClass(data, id, "owner_operator");
  const asOo = buildFinderDrivers(data).find((d) => d.driverId === id)!;
  expect(asOo.scope).toBe("owner_operator");
  expect(formatScopeShort(asOo.scope)).toBe("OO");
});

test("missing docs counted from Other Docs status cells only", () => {
  let data = clone(buildSeed());
  const docs = data.sections.docs;
  expect(docs?.rows.length).toBeGreaterThan(0);
  const row = docs.rows[0];
  const def = SECTIONS.find((s) => s.id === "docs")!;
  const statusIdx = def.types
    .map((t, i) => (t === "status" ? i : -1))
    .filter((i) => i >= 0);

  const cells = [...row.cells];
  while (cells.length < def.types.length) cells.push("");
  for (const i of statusIdx.slice(0, 3)) cells[i] = "Missing";
  data = {
    ...data,
    sections: {
      ...data.sections,
      docs: {
        ...docs,
        rows: docs.rows.map((r) => (r.id === row.id ? { ...r, cells } : r)),
      },
    },
  };

  const d = buildFinderDrivers(data).find((x) => x.driverId === row.driverId)!;
  expect(d.missingDocs).toBeGreaterThanOrEqual(3);
  expect(d.docsRowId).toBe(row.id);
});

test("QuickFind UI keeps Search drivers placeholder and read-only actions", () => {
  const src = readFileSync(resolve(process.cwd(), "src/components/tracker/QuickFind.tsx"), "utf8");
  expect(src).toMatch(/Search drivers by name, CDL, or ID/);
  expect(src).toMatch(/Open Driver Card/);
  expect(src).toMatch(/Driver Information/);
  expect(src).toMatch(/View Alerts/);
  expect(src).toMatch(/View relevant docs/);
  expect(src).toMatch(/never edits/);
  // Must navigate by driverId — no setCell / apply* mutations in the finder UI.
  expect(src).not.toMatch(/setCell|applyDriverClass|applyRosterKind|updateRow/);
  expect(src).toMatch(/search:\s*\{\s*driver:\s*d\.driverId\s*\}/);
});

test("CommandDialog allows Escape dismiss and large panel for finder", () => {
  const src = readFileSync(resolve(process.cwd(), "src/components/ui/command.tsx"), "utf8");
  expect(src).toMatch(/max-w-\[860px\]/);
  expect(src).toMatch(/max-h-\[85vh\]/);
  // Palette uses DialogPrimitive.Content (Escape closes) — not the form DialogContent import.
  expect(src).toMatch(/DialogPrimitive\.Content/);
  expect(src).not.toMatch(/import\s*\{[^}]*DialogContent[^}]*\}\s*from\s*["']@\/components\/ui\/dialog["']/);
});
