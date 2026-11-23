/**
 * SHRP-161 — Same-driverId multi-row guards + Steven-class reconciliation fixtures.
 * Isolated fixtures only. Never writes Prod.
 */
import { describe, expect, test, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  MULTIROW_GUARD_POLICY,
  SINGLE_ROW_COMPLIANCE_SECTION_IDS,
  countSameIdMultiRowOccurrences,
  guardAddDriverIdentity,
  wouldCreateSameIdMultiRow,
} from "@/lib/driver-multirow-guards";
import {
  findSameIdMultiRowFindings,
  primaryRowForDriver,
  rowFilledScore,
  rowsForDriver,
} from "@/lib/driver-selectors";
import { buildDriverProfileCompletion } from "@/lib/driver-profile-completion";
import { buildSeed, linkDrivers, type AppData, type Row } from "@/lib/sections";
import { addDriver, addRowForDriver, getData, importBackup } from "@/lib/store";

function loadFixture(data: AppData) {
  importBackup(
    JSON.stringify({
      app: "shaheen-driver-tracker",
      version: 2,
      exportedAt: new Date().toISOString(),
      coverage: {
        plans: true,
        notes: true,
        docs: true,
        followUps: true,
        records: true,
        drugTests: "none",
      },
      data,
    }),
  );
}

function row(partial: Partial<Row> & { cells: string[] }): Row {
  const r: Row = {
    id: partial.id ?? "r1",
    driverId: partial.driverId ?? "d1",
    cells: partial.cells,
  };
  if (typeof partial.addedAt === "number") r.addedAt = partial.addedAt;
  return r;
}

function blankData(): AppData {
  const data = JSON.parse(JSON.stringify(buildSeed())) as AppData;
  for (const id of Object.keys(data.sections)) data.sections[id].rows = [];
  return data;
}

/** Prod-shaped Steven residue: filled primary + sparse remapped shell. */
function stevenFixture() {
  const data = blankData();
  const id = "d_2zv6u4s7nw8n";
  const name = "Steven Couts";
  for (const sid of SINGLE_ROW_COMPLIANCE_SECTION_IDS) {
    const filled =
      sid === "info"
        ? [name, "530-351-4592", "bigstevee88@gmail.com", "CA"]
        : sid === "docs"
          ? [name, "", ...Array.from({ length: 12 }, () => "Valid"), "", "Active", ""]
          : [name, "A6984984", "Valid", "2027-02-12", "", "", "Active", "plan", "CA", "note"];
    const sparse =
      sid === "info"
        ? [name, "", "", "CA"]
        : sid === "docs"
          ? [name, "", ...Array.from({ length: 12 }, () => "Missing"), "", "Active", ""]
          : [name, "A6984984", "Missing", "", "", "", "Active", "", "CA", ""];
    data.sections[sid].rows = [
      row({ id: `${sid}_nw8n`, driverId: id, addedAt: 1_794_509_567_735, cells: filled }),
      row({ id: `${sid}_40r6`, driverId: id, addedAt: 1_795_010_845_650, cells: sparse }),
    ];
  }
  return { data, id, name };
}

describe("SHRP-161 multi-row guards", () => {
  test("policy documents single-row compliance sections", () => {
    expect(MULTIROW_GUARD_POLICY).toMatch(/≤1 physical row/);
    expect(SINGLE_ROW_COMPLIANCE_SECTION_IDS).toEqual([
      "dmv",
      "medical",
      "queries",
      "ssccdl",
      "docs",
      "info",
    ]);
  });

  test("Steven fixture: 6 section multi-rows; primary keeps unique values", () => {
    const { data, id } = stevenFixture();
    const audit = countSameIdMultiRowOccurrences(data);
    expect(audit.driversAffected).toBe(1);
    expect(audit.sectionOccurrences).toBe(6);
    const info = primaryRowForDriver(data, "info", id)!;
    expect(info.cells[1]).toBe("530-351-4592");
    expect(rowFilledScore(info)).toBeGreaterThan(
      rowFilledScore(rowsForDriver(data, "info", id)[1]),
    );
    // Sparse docs is not unique value to preserve — primary has all Valid.
    const docsPrimary = primaryRowForDriver(data, "docs", id)!;
    expect(docsPrimary.cells.filter((c) => c === "Valid").length).toBe(12);
  });

  test("completion stays honest (not forced 100%) with multi-rows + incomplete clearinghouse", () => {
    const { data, id } = stevenFixture();
    // Make queries look like Clearinghouse incomplete on primary
    data.sections.queries.rows = [
      row({
        id: "queries_nw8n",
        driverId: id,
        addedAt: 1,
        cells: ["Steven Couts", "Valid", "New Driver", "Missing", "", "", "", "", "Active", ""],
      }),
      row({
        id: "queries_40r6",
        driverId: id,
        addedAt: 2,
        cells: ["Steven Couts", "Missing", "", "Missing", "", "", "", "", "Active", ""],
      }),
    ];
    const c = buildDriverProfileCompletion(data, id);
    expect(c.percent).toBeLessThan(100);
    expect(findSameIdMultiRowFindings(data).some((f) => f.driverId === id)).toBe(true);
  });

  test("wouldCreateSameIdMultiRow true only for occupied single-row sections", () => {
    const { data, id } = stevenFixture();
    expect(wouldCreateSameIdMultiRow(data, "info", id)).toBe(true);
    expect(wouldCreateSameIdMultiRow(data, "info", "d_brand_new")).toBe(false);
    expect(wouldCreateSameIdMultiRow(data, "inactive", id)).toBe(false);
    expect(wouldCreateSameIdMultiRow(data, "rec_drivers", id)).toBe(false);
  });

  test("linkDrivers still refuses to create same-section multi-rows", () => {
    const data = blankData();
    data.sections.info.rows = [
      row({ id: "a", driverId: "d_old", cells: ["Steven Couts", "530-351-4592", "a@b.c", "CA"] }),
      row({ id: "b", driverId: "d_new", cells: ["Steven Couts", "", "", ""] }),
    ];
    const out = linkDrivers(data).data;
    expect(countSameIdMultiRowOccurrences(out).sectionOccurrences).toBe(0);
    expect(out.sections.info.rows.map((r) => r.driverId).sort()).toEqual(["d_new", "d_old"]);
  });

  test("guardAddDriverIdentity requires ack; never merges", () => {
    const data = blankData();
    data.sections.info.rows = [
      row({ id: "i1", driverId: "exist", cells: ["Steven Couts", "1", "a@b.c", "CA"] }),
    ];
    data.sections.ssccdl.rows = [
      row({
        id: "s1",
        driverId: "exist",
        cells: ["Steven Couts", "A6984984", "Valid", "", "Valid", "", "", "", "Active", ""],
      }),
    ];
    const blocked = guardAddDriverIdentity(data, { name: "Steven Couts", cdl: "A6984984" });
    expect(blocked.ok).toBe(false);
    const allowed = guardAddDriverIdentity(
      data,
      { name: "Steven Couts", cdl: "A6984984" },
      { acknowledgeIdentityDuplicate: true },
    );
    expect(allowed.ok).toBe(true);
    expect(allowed.matches.every((m) => m.reviewOnly)).toBe(true);
  });

  test("source guards: store + dialog + linkDrivers wired", () => {
    const store = readFileSync(resolve(process.cwd(), "src/lib/store.ts"), "utf8");
    expect(store).toMatch(/guardAddDriverIdentity/);
    expect(store).toMatch(/wouldCreateSameIdMultiRow/);
    expect(store).toMatch(/acknowledgeIdentityDuplicate/);

    const dialog = readFileSync(
      resolve(process.cwd(), "src/components/tracker/AddDriverDialog.tsx"),
      "utf8",
    );
    expect(dialog).toMatch(/acknowledgeIdentityDuplicate:\s*dupAck/);
    expect(dialog).toMatch(/result\.ok/);

    const link = readFileSync(resolve(process.cwd(), "src/lib/sections.ts"), "utf8");
    expect(link).toMatch(/Never create same-driverId multi-rows/);
  });
});

describe("SHRP-161 store mutation guards", () => {
  beforeEach(() => {
    const data = blankData();
    data.sections.info.rows = [
      row({ id: "i1", driverId: "exist", cells: ["Existing Driver", "555", "e@x.com", "CA"] }),
    ];
    data.sections.ssccdl.rows = [
      row({
        id: "s1",
        driverId: "exist",
        cells: ["Existing Driver", "CDLEXIST1", "Valid", "", "Valid", "", "", "", "Active", ""],
      }),
    ];
    for (const sid of ["dmv", "medical", "queries", "docs"] as const) {
      data.sections[sid].rows = [
        row({
          id: `${sid}_1`,
          driverId: "exist",
          cells: ["Existing Driver", "", "", "", "", "", "Active"],
        }),
      ];
    }
    loadFixture(data);
  });

  test("addDriver blocked without identity ack", () => {
    const r = addDriver(
      {
        info: ["Existing Driver", "", "", "CA"],
        ssccdl: ["Existing Driver", "CDLEXIST1", "Missing", "", "Missing", "", "", "", "Active", ""],
      },
      { name: "Existing Driver", cdl: "CDLEXIST1" },
    );
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("expected block");
    expect(r.error).toMatch(/acknowledge|match/i);
    expect(getData().sections.info.rows).toHaveLength(1);
  });

  test("addDriver succeeds with ack; does not multi-row existing id", () => {
    const before = countSameIdMultiRowOccurrences(getData()).sectionOccurrences;
    const r = addDriver(
      {
        info: ["Existing Driver", "999", "", "CA"],
        ssccdl: ["Existing Driver", "CDLEXIST1", "Missing", "", "Missing", "", "", "", "Active", ""],
        dmv: ["Existing Driver", "CDLEXIST1", "Missing", "", "", "", "Active", "", "CA", ""],
        medical: ["Existing Driver", "Missing", "", "", "", "Active", "", ""],
        queries: ["Existing Driver", "Missing", "", "Missing", "", "", "", "", "Active", ""],
        docs: ["Existing Driver", "", ...Array.from({ length: 12 }, () => "Missing"), "", "Active", ""],
      },
      {
        name: "Existing Driver",
        cdl: "CDLEXIST1",
        acknowledgeIdentityDuplicate: true,
      },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("expected ok");
    expect(r.driverId).not.toBe("exist");
    // New id is separate — no same-id multi-rows introduced for exist
    expect(rowsForDriver(getData(), "info", "exist")).toHaveLength(1);
    expect(countSameIdMultiRowOccurrences(getData()).sectionOccurrences).toBe(before);
  });

  test("addRowForDriver refuses when compliance row already exists", () => {
    const ok = addRowForDriver("info", "exist", "Existing Driver");
    expect(ok).toBe(false);
    expect(rowsForDriver(getData(), "info", "exist")).toHaveLength(1);
  });

  test("addRowForDriver allows missing section for known driver", () => {
    const d = JSON.parse(JSON.stringify(getData())) as AppData;
    d.sections.medical.rows = [];
    loadFixture(d);
    const ok = addRowForDriver("medical", "exist", "Existing Driver");
    expect(ok).toBe(true);
    expect(rowsForDriver(getData(), "medical", "exist")).toHaveLength(1);
    expect(addRowForDriver("medical", "exist", "Existing Driver")).toBe(false);
    expect(rowsForDriver(getData(), "medical", "exist")).toHaveLength(1);
  });

  test("repeated addRowForDriver / linkDrivers never inflate multi-rows", () => {
    for (let i = 0; i < 5; i++) {
      addRowForDriver("info", "exist", "Existing Driver");
      linkDrivers(getData());
    }
    expect(countSameIdMultiRowOccurrences(getData()).sectionOccurrences).toBe(0);
    expect(rowsForDriver(getData(), "info", "exist")).toHaveLength(1);
  });
});
