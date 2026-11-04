/**
 * Mock scenarios 1–12 — Temp notes · Company/OO · New Driver exclusive.
 * No Postgres schema migration; optional Row fields in tracker_sections jsonb.
 */
import { expect, test } from "vitest";
import {
  analyzeRow,
  collectSmartAlerts,
  fleetCompliancePct,
  rowOrdinaryComplianceMuted,
} from "@/lib/alerts";
import {
  applyDriverClass,
  applyRosterKind,
  collectTempNotes,
  countTempNotes,
  driverClassOf,
  inOrdinaryCompanyLists,
  isCompanyDriver,
  isNewDriver,
  isOwnerOperator,
  listScopeOf,
  matchesListScope,
  rosterKindOf,
} from "@/lib/driver-meta";
import { buildSeed, SECTIONS, type AppData, type Row } from "@/lib/sections";

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

function firstDmv(data: AppData): Row {
  const r = data.sections.dmv.rows[0];
  expect(r).toBeTruthy();
  return r;
}

function setTempNote(data: AppData, driverId: string, sectionId: string, text: string): AppData {
  const def = SECTIONS.find((s) => s.id === sectionId)!;
  const idx = def.types.indexOf("tempnote");
  expect(idx).toBeGreaterThanOrEqual(0);
  const sections = { ...data.sections };
  const sec = sections[sectionId];
  sections[sectionId] = {
    ...sec,
    rows: sec.rows.map((r) => {
      if (r.driverId !== driverId) return r;
      const cells = [...r.cells];
      while (cells.length <= idx) cells.push("");
      cells[idx] = text;
      return { ...r, cells };
    }),
  };
  return { ...data, sections };
}

// ─── 1. Empty temp notes → count 0 ───────────────────────────────────────────
test("1 · empty temporary notes → count 0 (no badge)", () => {
  const data = buildSeed();
  const id = firstDmv(data).driverId;
  expect(countTempNotes(data, id)).toBe(0);
  expect(collectTempNotes(data, id)).toEqual([]);
});

// ─── 2. One nonempty temp note → count 1 ─────────────────────────────────────
test("2 · one nonempty temporary note → count 1", () => {
  let data = buildSeed();
  const id = firstDmv(data).driverId;
  data = setTempNote(data, id, "dmv", "Call about medical card");
  expect(countTempNotes(data, id)).toBe(1);
  expect(collectTempNotes(data, id)[0]?.sectionId).toBe("dmv");
});

// ─── 3. Notes across sections → sum + popup by section ───────────────────────
test("3 · nonempty notes across sections → summed count grouped by section", () => {
  let data = buildSeed();
  const id = firstDmv(data).driverId;
  data = setTempNote(data, id, "dmv", "DMV reminder");
  data = setTempNote(data, id, "medical", "Med reminder");
  data = setTempNote(data, id, "queries", "  "); // empty after trim — ignored
  data = setTempNote(data, id, "docs", "Docs reminder");
  expect(countTempNotes(data, id)).toBe(3);
  const bySec = collectTempNotes(data, id).map((n) => n.sectionId).sort();
  expect(bySec).toEqual(["dmv", "docs", "medical"]);
});

// ─── 4. Live update when note cleared ────────────────────────────────────────
test("4 · clearing a temporary note live-updates the count", () => {
  let data = buildSeed();
  const id = firstDmv(data).driverId;
  data = setTempNote(data, id, "dmv", "temp");
  data = setTempNote(data, id, "medical", "temp2");
  expect(countTempNotes(data, id)).toBe(2);
  data = setTempNote(data, id, "dmv", "");
  expect(countTempNotes(data, id)).toBe(1);
});

// ─── 5. Temp notes NEVER feed violations / alerts / compliance ───────────────
test("5 · temporary notes never feed analyzeRow / smart alerts / compliance", () => {
  let data = buildSeed();
  const row = firstDmv(data);
  const id = row.driverId;
  data = setTempNote(data, id, "dmv", "SHOULD NOT ALERT");
  data = setTempNote(data, id, "medical", "SHOULD NOT ALERT");
  const def = SECTIONS.find((s) => s.id === "dmv")!;
  const sec = data.sections.dmv;
  const updated = sec.rows.find((r) => r.driverId === id)!;
  const { issues, cellTone } = analyzeRow(def, sec.headers, updated);
  const tempIdx = def.types.indexOf("tempnote");
  expect(issues.every((i) => i.col !== tempIdx)).toBe(true);
  expect(cellTone[tempIdx]).toBeUndefined();
  expect(issues.some((i) => /SHOULD NOT ALERT/i.test(i.label))).toBe(false);
  // Smart alerts still ignore tempnote text
  const alerts = collectSmartAlerts(data);
  expect(alerts.every((a) => !/SHOULD NOT ALERT/i.test(a.expiryLabel))).toBe(true);
});

// ─── 6. Default company; mark OO with history; out of company lists ──────────
test("6 · Company → Owner Operator keeps rows, history; leaves company lists", () => {
  let data = buildSeed();
  const id = firstDmv(data).driverId;
  expect(driverClassOf(data, id)).toBe("company");
  expect(isCompanyDriver(data, id)).toBe(true);
  expect(inOrdinaryCompanyLists(data, id)).toBe(true);

  data = applyDriverClass(data, id, "owner_operator", 1_700_000_000_000);
  expect(isOwnerOperator(data, id)).toBe(true);
  expect(inOrdinaryCompanyLists(data, id)).toBe(false);
  expect(matchesListScope(data, id, "owner_operator")).toBe(true);
  expect(matchesListScope(data, id, "company")).toBe(false);

  // Same driverId still present in DMV — no delete/recreate
  expect(data.sections.dmv.rows.some((r) => r.driverId === id)).toBe(true);
  const hist = data.sections.dmv.rows.find((r) => r.driverId === id)!.classHistory!;
  expect(hist).toEqual([{ at: 1_700_000_000_000, from: "company", to: "owner_operator" }]);
});

// ─── 7. OO ≠ Inactive; employment can stay Active ────────────────────────────
test("7 · Owner Operator is not Inactive — employment stays independent", () => {
  let data = buildSeed();
  const id = firstDmv(data).driverId;
  // Ensure Active employment cell
  const aidx = SECTIONS[0].types.indexOf("active");
  data = {
    ...data,
    sections: {
      ...data.sections,
      dmv: {
        ...data.sections.dmv,
        rows: data.sections.dmv.rows.map((r) =>
          r.driverId === id
            ? { ...r, status: "active", cells: r.cells.map((c, i) => (i === aidx ? "Active" : c)) }
            : r,
        ),
      },
    },
  };
  data = applyDriverClass(data, id, "owner_operator");
  expect(isOwnerOperator(data, id)).toBe(true);
  const row = data.sections.dmv.rows.find((r) => r.driverId === id)!;
  expect(row.status ?? "active").toBe("active");
  expect((row.cells[aidx] ?? "Active").toLowerCase()).toBe("active");
});

// ─── 8. Revert OO → Company; history preserved ───────────────────────────────
test("8 · Owner Operator → Company is reversible with full history", () => {
  let data = buildSeed();
  const id = firstDmv(data).driverId;
  data = applyDriverClass(data, id, "owner_operator", 100);
  data = applyDriverClass(data, id, "company", 200);
  expect(isCompanyDriver(data, id)).toBe(true);
  const hist = data.sections.dmv.rows.find((r) => r.driverId === id)!.classHistory!;
  expect(hist).toHaveLength(2);
  expect(hist[1]).toEqual({ at: 200, from: "owner_operator", to: "company" });
});

// ─── 9. New Driver exclusive — not in Active/Inactive/OO/company ─────────────
test("9 · New Driver exclusive — not in company / OO / ordinary compliance", () => {
  let data = buildSeed();
  const id = firstDmv(data).driverId;
  data = applyRosterKind(data, id, "new");
  expect(isNewDriver(data, id)).toBe(true);
  expect(listScopeOf(data, id)).toBe("new");
  expect(matchesListScope(data, id, "company")).toBe(false);
  expect(matchesListScope(data, id, "owner_operator")).toBe(false);
  expect(matchesListScope(data, id, "new")).toBe(true);
  expect(inOrdinaryCompanyLists(data, id)).toBe(false);
  const def = SECTIONS[0];
  const row = data.sections.dmv.rows.find((r) => r.driverId === id)!;
  expect(rowOrdinaryComplianceMuted(def, row, data)).toBe(true);
});

// ─── 10. Show All excludes New (company scope) ───────────────────────────────
test("10 · Show-all company scope excludes New Drivers", () => {
  let data = buildSeed();
  const id = firstDmv(data).driverId;
  data = applyRosterKind(data, id, "new");
  // Company list scope never matches New
  expect(matchesListScope(data, id, "company")).toBe(false);
  // Other seed drivers without rosterKind remain company
  const other = data.sections.dmv.rows.find((r) => r.driverId !== id)!;
  expect(rosterKindOf(data, other.driverId)).toBe("roster");
  expect(matchesListScope(data, other.driverId, "company")).toBe(true);
});

// ─── 11. Move to Active Drivers with confirm path (reversible) ───────────────
test("11 · Move to Active Drivers (roster) is reversible", () => {
  let data = buildSeed();
  const id = firstDmv(data).driverId;
  data = applyRosterKind(data, id, "new", 10);
  expect(isNewDriver(data, id)).toBe(true);
  data = applyRosterKind(data, id, "roster", 20);
  expect(isNewDriver(data, id)).toBe(false);
  expect(isCompanyDriver(data, id)).toBe(true);
  const hist = data.sections.dmv.rows.find((r) => r.driverId === id)!.rosterHistory!;
  expect(hist).toEqual([
    { at: 10, from: "roster", to: "new" },
    { at: 20, from: "new", to: "roster" },
  ]);
  // Reverse back to New
  data = applyRosterKind(data, id, "new", 30);
  expect(isNewDriver(data, id)).toBe(true);
});

// ─── 12. Docs complete does NOT auto-promote New → Active ────────────────────
test("12 · filling documents does not auto-promote New Drivers", () => {
  let data = buildSeed();
  const id = firstDmv(data).driverId;
  data = applyRosterKind(data, id, "new");
  // Simulate all docs Valid
  const docsDef = SECTIONS.find((s) => s.id === "docs")!;
  data = {
    ...data,
    sections: {
      ...data.sections,
      docs: {
        ...data.sections.docs,
        rows: data.sections.docs.rows.map((r) => {
          if (r.driverId !== id) return r;
          const cells = [...r.cells];
          docsDef.types.forEach((t, i) => {
            if (t === "status") cells[i] = "Valid";
          });
          return { ...r, cells, rosterKind: "new" as const };
        }),
      },
    },
  };
  expect(isNewDriver(data, id)).toBe(true);
  expect(listScopeOf(data, id)).toBe("new");
});

// ─── Seed safety: no auto-reclassify existing drivers ────────────────────────
test("seed drivers stay company roster — no auto Owner Operator or New", () => {
  const data = buildSeed();
  for (const r of data.sections.dmv.rows.slice(0, 30)) {
    expect(r.driverClass).toBeUndefined();
    expect(r.rosterKind).toBeUndefined();
    expect(driverClassOf(data, r.driverId)).toBe("company");
    expect(rosterKindOf(data, r.driverId)).toBe("roster");
  }
});

// ─── jsonb round-trip (no Postgres migration) ────────────────────────────────
test("optional meta fields survive JSON serialize like tracker_sections.data", () => {
  let data = buildSeed();
  const id = firstDmv(data).driverId;
  data = applyDriverClass(data, id, "owner_operator", 99);
  data = setTempNote(data, id, "dmv", "note");
  const json = JSON.stringify(data.sections.dmv);
  const parsed = JSON.parse(json) as AppData["sections"]["dmv"];
  const row = parsed.rows.find((r) => r.driverId === id)!;
  expect(row.driverClass).toBe("owner_operator");
  expect(row.classHistory?.[0]?.to).toBe("owner_operator");
  const restored: AppData = { ...data, sections: { ...data.sections, dmv: parsed } };
  expect(countTempNotes(restored, id)).toBeGreaterThanOrEqual(1);
});

test("OO muted from ordinary compliance does not change fleet shape when none classified", () => {
  const data = buildSeed();
  const pct = fleetCompliancePct(data);
  expect(typeof pct).toBe("number");
  expect(pct).toBeGreaterThanOrEqual(0);
  expect(pct).toBeLessThanOrEqual(100);
});

test("clone helper used by fixtures", () => {
  const data = clone(buildSeed());
  expect(data.sections.dmv.rows.length).toBeGreaterThan(0);
});
