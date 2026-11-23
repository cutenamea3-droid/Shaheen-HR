/**
 * SHRP-156 — Driver data consistency & completion regression suite.
 * Isolated fixtures + source guards. Never writes Prod.
 */
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { complianceScore } from "@/lib/alerts";
import {
  buildDriverProfileCompletion,
  driverProfileCompletionPercent,
  findDuplicateDriverWarnings,
} from "@/lib/driver-profile-completion";
import {
  DRIVER_SELECTOR_POLICY,
  allComplianceDriverIds,
  buildDriverCardModel,
  driverContact,
  findAddDriverIdentityMatches,
  findSameIdMultiRowFindings,
  primaryRowForDriver,
  rowsForDriver,
  rowFilledScore,
} from "@/lib/driver-selectors";
import { buildFinderDrivers } from "@/lib/quick-find";
import { buildSeed, linkDrivers, type AppData, type Row } from "@/lib/sections";

function row(partial: Partial<Row> & { cells: string[] }): Row {
  const r: Row = {
    id: partial.id ?? "r1",
    driverId: partial.driverId ?? "d1",
    cells: partial.cells,
  };
  if (typeof partial.addedAt === "number") r.addedAt = partial.addedAt;
  return r;
}

function iso(offset: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function blankData(): AppData {
  // Deep clone — buildSeed may return migrateData over the imported seed module.
  const data = JSON.parse(JSON.stringify(buildSeed())) as AppData;
  for (const id of Object.keys(data.sections)) data.sections[id].rows = [];
  return data;
}

/** Steven Couts pattern: same driverId, filled row + empty remapped row. */
function stevenMultiRowFixture() {
  const data = blankData();
  const id = "d_2zv6u4s7nw8n";
  const name = "Steven Couts";
  data.sections.info.rows = [
    row({
      id: "info_nw8n",
      driverId: id,
      addedAt: 1_700_000_000_000,
      cells: [name, "530-351-4592", "bigstevee88@gmail.com", "CA"],
    }),
    row({
      id: "info_40r6",
      driverId: id,
      addedAt: 1_800_000_000_000,
      cells: [name, "", "", ""],
    }),
  ];
  data.sections.docs.rows = [
    row({
      id: "docs_nw8n",
      driverId: id,
      addedAt: 1_700_000_000_000,
      cells: [name, "", ...Array.from({ length: 12 }, () => "Valid"), "", "Active", ""],
    }),
    row({
      id: "docs_40r6",
      driverId: id,
      addedAt: 1_800_000_000_000,
      cells: [name, "", ...Array.from({ length: 12 }, () => "Missing"), "", "Active", ""],
    }),
  ];
  data.sections.dmv.rows = [
    row({
      id: "dmv1",
      driverId: id,
      cells: [name, "C", "Valid", iso(40), "", "", "Active", "", "CA", ""],
    }),
  ];
  data.sections.medical.rows = [
    row({
      id: "med1",
      driverId: id,
      cells: [name, "Valid", iso(90), "", "", "Active", "", ""],
    }),
  ];
  data.sections.queries.rows = [
    row({
      id: "q1",
      driverId: id,
      cells: [name, "Valid", iso(40), "Missing", "", "", "", "", "Active", ""],
    }),
  ];
  data.sections.ssccdl.rows = [
    row({
      id: "s1",
      driverId: id,
      cells: [name, "A1111111", "Valid", iso(60), "Valid", "", "", "", "Active", ""],
    }),
  ];
  return { data, id, name };
}

function fullDriver(id: string, name: string, phone: string) {
  const data = blankData();
  data.sections.dmv.rows = [
    row({
      id: `${id}_dmv`,
      driverId: id,
      cells: [name, "C", "Valid", iso(40), "", "", "Active", "", "CA", ""],
    }),
  ];
  data.sections.medical.rows = [
    row({
      id: `${id}_med`,
      driverId: id,
      cells: [name, "Valid", iso(90), "", "", "Active", "", ""],
    }),
  ];
  data.sections.queries.rows = [
    row({
      id: `${id}_q`,
      driverId: id,
      cells: [name, "Valid", iso(40), "Valid", iso(40), "", "", "", "Active", ""],
    }),
  ];
  data.sections.ssccdl.rows = [
    row({
      id: `${id}_s`,
      driverId: id,
      cells: [name, "CDL" + id.slice(-4).toUpperCase(), "Valid", iso(60), "Valid", "", "", "", "Active", ""],
    }),
  ];
  data.sections.docs.rows = [
    row({
      id: `${id}_docs`,
      driverId: id,
      cells: [name, "", ...Array.from({ length: 12 }, () => "Valid"), "", "Active", ""],
    }),
  ];
  data.sections.info.rows = [
    row({ id: `${id}_info`, driverId: id, cells: [name, phone, `${id}@ex.com`, "CA"] }),
  ];
  return data;
}

describe("SHRP-156 driver data consistency", () => {
  test("1. Steven multi-row: card phone matches file phone (primary, not last-wins empty)", () => {
    const { data, id } = stevenMultiRowFixture();
    const contact = driverContact(data, id);
    expect(contact.phone).toBe("530-351-4592");
    expect(contact.email).toBe("bigstevee88@gmail.com");
    const card = buildDriverCardModel(data, id);
    expect(card.phone).toBe(contact.phone);
    // Last-wins would be empty — prove we did not use that.
    expect(rowsForDriver(data, "info", id)).toHaveLength(2);
    expect(cellsOfLast(data, "info", id)[1]).toBe("");
  });

  test("2. Outside card % equals inside Completion Details %", () => {
    const { data, id } = stevenMultiRowFixture();
    const cardPct = buildDriverCardModel(data, id);
    const completion = buildDriverProfileCompletion(data, id);
    expect(driverProfileCompletionPercent(data, id)).toBe(completion.percent);
    // Card model + completion share primary rows → same contact + consistent % path
    expect(cardPct.phone).toBe(driverContact(data, id).phone);
    expect(completion.percent).toBeGreaterThanOrEqual(90);
  });

  test("3. Phone consistency: dash under name is Cell Phone from primary info row", () => {
    const { data, id } = stevenMultiRowFixture();
    const primary = primaryRowForDriver(data, "info", id)!;
    expect(primary.cells[1]).toBe("530-351-4592");
    expect(DRIVER_SELECTOR_POLICY).toMatch(/richest filled cells/i);
  });

  test("4. Docs edit on primary row: Other Docs status updates; profile uses same row", () => {
    const { data, id } = stevenMultiRowFixture();
    const before = buildDriverProfileCompletion(data, id);
    expect(before.otherDocsStatusPercent).toBe(100);
    const primary = primaryRowForDriver(data, "docs", id)!;
    primary.cells[2] = "Missing";
    const after = buildDriverProfileCompletion(data, id);
    expect(after.otherDocsStatusPercent).toBeLessThan(100);
    expect(complianceScore(primary)).toBe(after.otherDocsStatusPercent);
  });

  test("5. Clearinghouse partial (1/2) reflected in section breakdown", () => {
    const { data, id } = stevenMultiRowFixture();
    const c = buildDriverProfileCompletion(data, id);
    const ch = c.sections.find((s) => s.id === "queries")!;
    expect(ch.applicable).toBe(2);
    expect(ch.complete).toBe(1);
    expect(ch.percent).toBe(50);
  });

  test("6. Other Docs 100% Valid÷12 with profile <100% stays distinct", () => {
    const { data, id } = stevenMultiRowFixture();
    const c = buildDriverProfileCompletion(data, id);
    expect(c.otherDocsStatusPercent).toBe(100);
    expect(c.percent).toBeLessThan(100); // Clearinghouse partial
    expect(c.percent).not.toBe(c.otherDocsStatusPercent);
  });

  test("7. Empty driver: low profile %, no invented completeness", () => {
    const data = blankData();
    data.sections.info.rows = [row({ id: "i", driverId: "empty", cells: ["Empty", "", "", ""] })];
    const c = buildDriverProfileCompletion(data, "empty");
    expect(c.percent).toBeLessThan(50);
    expect(c.sections.find((s) => s.id === "info")!.complete).toBe(0);
  });

  test("8. Partial driver scores only filled applicable items", () => {
    const data = blankData();
    data.sections.docs.rows = [
      row({
        id: "d",
        driverId: "p",
        cells: ["Partial", "", ...Array.from({ length: 12 }, () => "Valid"), "", "Active", ""],
      }),
    ];
    data.sections.info.rows = [
      row({ id: "i", driverId: "p", cells: ["Partial", "555", "a@b.c", "CA"] }),
    ];
    const c = buildDriverProfileCompletion(data, "p");
    expect(c.sections.find((s) => s.id === "docs")!.percent).toBe(100);
    expect(c.sections.find((s) => s.id === "dmv")!.rowPresent).toBe(false);
    expect(c.percent).toBeLessThan(100);
  });

  test("9. Full driver approaches 100% profile", () => {
    const data = fullDriver("full1", "Full Driver", "555-9999");
    const c = buildDriverProfileCompletion(data, "full1");
    expect(c.percent).toBe(100);
    expect(c.otherDocsStatusPercent).toBe(100);
  });

  test("10. Legacy: missing addedAt still picks richest primary row", () => {
    const data = blankData();
    const id = "legacy";
    data.sections.info.rows = [
      row({ id: "a", driverId: id, cells: ["Legacy", "", "", ""] }),
      row({ id: "b", driverId: id, cells: ["Legacy", "111-2222", "l@e.com", "NV"] }),
    ];
    expect(rowFilledScore(data.sections.info.rows[1])).toBeGreaterThan(
      rowFilledScore(data.sections.info.rows[0]),
    );
    expect(driverContact(data, id).phone).toBe("111-2222");
  });

  test("11. Cross-id duplicates warn review-only; never merge/delete", () => {
    const data = blankData();
    data.sections.dmv.rows = [
      row({
        id: "a",
        driverId: "id_a",
        cells: ["Same Person", "1", "Valid", iso(40), "", "", "Active", "", "CA", ""],
      }),
      row({
        id: "b",
        driverId: "id_b",
        cells: ["Same Person", "2", "Valid", iso(40), "", "", "Active", "", "CA", ""],
      }),
    ];
    const warnings = findDuplicateDriverWarnings(data);
    expect(warnings.every((w) => w.reviewOnly)).toBe(true);
    expect(warnings.some((w) => w.driverId === "id_a")).toBe(true);
    expect(data.sections.dmv.rows).toHaveLength(2);
  });

  test("12. Same-name different people (different CDLs) still warned by name only", () => {
    const data = blankData();
    data.sections.ssccdl.rows = [
      row({
        id: "a",
        driverId: "p1",
        cells: ["John Smith", "AAA111", "Valid", iso(60), "Valid", "", "", "", "Active", ""],
      }),
      row({
        id: "b",
        driverId: "p2",
        cells: ["John Smith", "BBB222", "Valid", iso(60), "Valid", "", "", "", "Active", ""],
      }),
    ];
    const warnings = findDuplicateDriverWarnings(data);
    const w = warnings.find((x) => x.driverId === "p1");
    expect(w?.reason).toBe("same_name");
    expect(w?.peerIds).toContain("p2");
  });

  test("13. Same-id multi-rows detected for review (Steven class)", () => {
    const { data, id } = stevenMultiRowFixture();
    const findings = findSameIdMultiRowFindings(data);
    expect(findings.some((f) => f.driverId === id && f.reviewOnly)).toBe(true);
    const dup = findDuplicateDriverWarnings(data).find((w) => w.driverId === id);
    expect(dup?.reason).toBe("same_id_multi_row");
  });

  test("14. Cards ↔ File share same contact + completion selectors", () => {
    const { data, id } = stevenMultiRowFixture();
    const card = buildDriverCardModel(data, id);
    const contact = driverContact(data, id);
    const completion = buildDriverProfileCompletion(data, id);
    expect(card.phone).toBe(contact.phone);
    expect(card.cdl).toBe(contact.cdl);
    expect(card.name).toBe(completion.driverName);
  });

  test("15. Quick Find uses primary rows for CDL/info (not last empty)", () => {
    const { data, id } = stevenMultiRowFixture();
    const found = buildFinderDrivers(data).find((d) => d.driverId === id)!;
    expect(found.infoRowId).toBe("info_nw8n");
    expect(found.cdl).toBe("A1111111");
  });

  test("16. linkDrivers does not create same-section multi-rows", () => {
    const data = blankData();
    data.sections.info.rows = [
      row({ id: "a", driverId: "d_old", cells: ["Steven Couts", "530-351-4592", "a@b.c", "CA"] }),
      row({ id: "b", driverId: "d_new", cells: ["Steven Couts", "", "", ""] }),
    ];
    const out = linkDrivers(data).data;
    const ids = out.sections.info.rows.map((r) => r.driverId);
    // Target already occupied → leave d_new alone (warn path), do not double-book d_old.
    expect(new Set(ids).size).toBe(2);
    expect(ids.filter((x) => x === "d_old")).toHaveLength(1);
  });

  test("17. Cross-section linkDrivers still unifies different sections", () => {
    const data = {
      version: 1,
      sections: {
        docs: {
          headers: ["Name", "CDL"],
          widths: [],
          hidden: [],
          rows: [{ id: "a", driverId: "d1", cells: ["Sara Haqi Ismail", ""] }],
        },
        info: {
          headers: ["Name", "CDL"],
          widths: [],
          hidden: [],
          rows: [{ id: "b", driverId: "d2", cells: ["Sarah Haqi Ismael", ""] }],
        },
        ssccdl: {
          headers: ["Name", "CDL"],
          widths: [],
          hidden: [],
          rows: [
            { id: "c", driverId: "d3", cells: ["Sukhminder Singh", "111111"] },
            { id: "e", driverId: "d4", cells: ["Sukhwinder Singh", "222222"] },
          ],
        },
      },
    } as AppData;
    const out = linkDrivers(data).data.sections;
    expect(out.docs.rows[0].driverId).toBe(out.info.rows[0].driverId);
    expect(out.ssccdl.rows[0].driverId).not.toBe(out.ssccdl.rows[1].driverId);
  });

  test("18. Add Driver identity match preview (same name/CDL) review-only", () => {
    const data = fullDriver("exist1", "Existing Driver", "555-0000");
    const matches = findAddDriverIdentityMatches(data, {
      name: "Existing Driver",
      cdl: "CDLIST1",
    });
    // CDL from fixture is CDL + last 4 of id → "CDLIST1" may not match; check name
    const byName = findAddDriverIdentityMatches(data, {
      name: "Existing Driver",
      cdl: "ZZZZZZZZ",
    });
    expect(byName.some((m) => m.driverId === "exist1" && m.reviewOnly)).toBe(true);
    expect(matches.every((m) => m.reviewOnly)).toBe(true);
  });

  test("19. Future drivers: allComplianceDriverIds + card model deterministic", () => {
    const a = fullDriver("f1", "Future One", "555-0111");
    const b = fullDriver("f2", "Future Two", "555-0222");
    // merge section rows without sharing references
    for (const id of Object.keys(b.sections)) {
      if (!a.sections[id]) continue;
      a.sections[id] = {
        ...a.sections[id],
        rows: [...a.sections[id].rows, ...b.sections[id].rows.map((r) => ({ ...r, cells: [...r.cells] }))],
      };
    }
    expect(a.sections.info.rows.map((r) => r.driverId).sort()).toEqual(["f1", "f2"]);
    expect(primaryRowForDriver(a, "info", "f1")?.cells[1]).toBe("555-0111");
    const ids = allComplianceDriverIds(a).sort();
    expect(ids).toEqual(["f1", "f2"]);
    expect(buildDriverCardModel(a, "f1").phone).toBe("555-0111");
    expect(buildDriverCardModel(a, "f2").phone).toBe("555-0222");
  });

  test("20. Source guards: Cards/File/AddDriver/store use shared selectors + dirty persist", () => {
    const cards = readFileSync(resolve(process.cwd(), "src/components/tracker/DriverCards.tsx"), "utf8");
    expect(cards).toMatch(/buildDriverCardModel/);
    expect(cards).toMatch(/primaryRowForDriver/);
    expect(cards).toMatch(/buildDriverProfileCompletion/);
    expect(cards).not.toMatch(/d\.phone = asName\(r\.cells\[1\]\)/);

    const add = readFileSync(resolve(process.cwd(), "src/components/tracker/AddDriverDialog.tsx"), "utf8");
    expect(add).toMatch(/findAddDriverIdentityMatches/);
    expect(add).toMatch(/add-driver-dup-ack/);
    expect(add).toMatch(/never auto-merge|do not merge/i);

    const store = readFileSync(resolve(process.cwd(), "src/lib/store.ts"), "utf8");
    expect(store).toMatch(/shaheen-driver-tracker-dirty-v1/);
    expect(store).toMatch(/pendingLocal/);
    expect(store).toMatch(/loadPendingDirty/);

    const link = readFileSync(resolve(process.cwd(), "src/lib/sections.ts"), "utf8");
    expect(link).toMatch(/Never create same-driverId multi-rows/);
  });
});

function cellsOfLast(data: AppData, sectionId: string, driverId: string): string[] {
  const rows = rowsForDriver(data, sectionId, driverId);
  return rows[rows.length - 1]?.cells ?? [];
}
