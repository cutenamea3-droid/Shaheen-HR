import { describe, expect, it } from "vitest";
import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { buildMonthlyReportModel, verifyMonthlyTotals } from "./monthly-report-model";
import { buildMonthlyPdfDoc, setLogoCacheForTests } from "./monthly-pdf";
import {
  fixtureCleanOctober,
  fixtureLargeRoster,
  fixtureMessyOctober,
  fixtureMissingData,
  fixtureMultiDept,
  fixtureOtAndExtra,
} from "./monthly-pdf-fixtures";

const MONTH = "2026-10";

function logoFromPublic(): string | null {
  try {
    const p = resolve(process.cwd(), "public/logo.jpg");
    const b = readFileSync(p);
    return `data:image/jpeg;base64,${b.toString("base64")}`;
  } catch {
    return null;
  }
}

describe("monthly report model totals", () => {
  const cases = [
    ["clean", fixtureCleanOctober()],
    ["messy", fixtureMessyOctober()],
    ["ot", fixtureOtAndExtra()],
    ["depts", fixtureMultiDept()],
    ["missing", fixtureMissingData()],
    ["large", fixtureLargeRoster(24)],
  ] as const;

  for (const [name, data] of cases) {
    it(`${name}: model totals match direct calcDay pass`, () => {
      const model = buildMonthlyReportModel(data, MONTH);
      const v = verifyMonthlyTotals(data, MONTH, model);
      expect(v.hoursMatch).toBe(true);
      expect(v.lateMatch).toBe(true);
      expect(v.otMatch).toBe(true);
      expect(v.extraMatch).toBe(true);
      expect(v.absentMatch).toBe(true);
    });
  }

  it("messy fixture surfaces exceptions and notes", () => {
    const model = buildMonthlyReportModel(fixtureMessyOctober(), MONTH);
    expect(model.exceptions.length).toBeGreaterThan(0);
    expect(model.notes.length).toBeGreaterThan(0);
    expect(model.overview.totalLate).toBeGreaterThan(0);
    expect(model.overview.totalAbsent).toBeGreaterThan(0);
  });

  it("missing-data fixture keeps roster count but fewer with records", () => {
    const model = buildMonthlyReportModel(fixtureMissingData(), MONTH);
    expect(model.overview.rosterCount).toBe(3);
    expect(model.overview.employeesWithRecords).toBe(1);
  });

  it("management vs audit share the same overview numbers", () => {
    const data = fixtureMessyOctober();
    const model = buildMonthlyReportModel(data, MONTH);
    const mgmt = buildMonthlyPdfDoc(data, {
      mode: "management",
      company: data.settings.company,
      month: MONTH,
      generatedAt: new Date("2026-11-13T12:00:00Z"),
      logo: null,
    });
    const audit = buildMonthlyPdfDoc(data, {
      mode: "audit",
      company: data.settings.company,
      month: MONTH,
      generatedAt: new Date("2026-11-13T12:00:00Z"),
      logo: null,
    });
    expect(mgmt.model.overview).toEqual(model.overview);
    expect(audit.model.overview).toEqual(model.overview);
    expect(mgmt.doc.getNumberOfPages()).toBeGreaterThan(0);
    expect(audit.doc.getNumberOfPages()).toBeGreaterThanOrEqual(mgmt.doc.getNumberOfPages());
  });
});

describe("monthly PDF render fixtures", () => {
  it("renders clean / messy / large without empty docs", () => {
    setLogoCacheForTests(logoFromPublic());
    const logo = logoFromPublic();
    for (const [label, data] of [
      ["clean", fixtureCleanOctober()],
      ["messy", fixtureMessyOctober()],
      ["ot", fixtureOtAndExtra()],
      ["depts", fixtureMultiDept()],
      ["missing", fixtureMissingData()],
      ["large", fixtureLargeRoster(30)],
    ] as const) {
      for (const mode of ["management", "audit"] as const) {
        const { doc, model } = buildMonthlyPdfDoc(data, {
          mode,
          company: "Shaheen Transport LLC",
          month: MONTH,
          generatedAt: new Date("2026-11-13T15:00:00Z"),
          logo,
        });
        expect(doc.getNumberOfPages()).toBeGreaterThan(0);
        expect(model.month).toBe(MONTH);
        const bytes = doc.output("arraybuffer");
        expect(bytes.byteLength).toBeGreaterThan(2000);
        void label;
      }
    }
  });

  it("writes example Management Summary + Full HR Audit PDFs when MEDIA_OUT is set", () => {
    const out = process.env.MEDIA_OUT;
    if (!out) return;
    mkdirSync(out, { recursive: true });
    const logo = logoFromPublic();
    const data = fixtureMessyOctober();
    // Prefer seed-sized messy+multi for CEO examples
    const rich = fixtureLargeRoster(18);
    // merge messy notes into a couple employees for audit demo
    const demo = {
      ...rich,
      records: { ...rich.records, ...data.records },
      perf: { ...rich.perf, ...data.perf },
      employees: [...rich.employees.slice(0, 14), ...data.employees],
    };

    for (const mode of ["management", "audit"] as const) {
      const { doc } = buildMonthlyPdfDoc(demo, {
        mode,
        company: "Shaheen Transport LLC",
        month: MONTH,
        generatedAt: new Date("2026-11-13T15:30:00Z"),
        logo,
      });
      const name =
        mode === "management"
          ? "october-2026-management-summary.pdf"
          : "october-2026-full-hr-audit.pdf";
      const path = resolve(out, name);
      writeFileSync(path, Buffer.from(doc.output("arraybuffer")));
      expect(existsSync(path)).toBe(true);
    }
  });
});
