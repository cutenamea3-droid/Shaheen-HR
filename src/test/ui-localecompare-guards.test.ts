import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("UI localeCompare coerce guards", () => {
  it("DriverCards / Records / history / team / drug / assessments stringify before sort", () => {
    const cards = readFileSync(
      resolve(process.cwd(), "src/components/tracker/DriverCards.tsx"),
      "utf8",
    );
    const records = readFileSync(resolve(process.cwd(), "src/components/tracker/Records.tsx"), "utf8");
    const hist = readFileSync(
      resolve(process.cwd(), "src/components/tracker/ComplianceHistoryPanel.tsx"),
      "utf8",
    );
    const team = readFileSync(
      resolve(process.cwd(), "src/components/tracker/TeamManagement.tsx"),
      "utf8",
    );
    const drug = readFileSync(
      resolve(process.cwd(), "src/components/tracker/driver-hr/DrugTestRecordsPage.tsx"),
      "utf8",
    );
    const assess = readFileSync(
      resolve(process.cwd(), "src/personal/components/Assessments.tsx"),
      "utf8",
    );
    expect(cards).toMatch(/asName\(a\.name\)\.localeCompare\(asName\(b\.name\)/);
    expect(records).toMatch(/asName\(a\.name\)\.localeCompare\(asName\(b\.name\)/);
    expect(hist).toMatch(/asName\(a\.name\)\.localeCompare\(asName\(b\.name\)/);
    expect(team).toMatch(/asEmail\(a\.email\)\.localeCompare\(asEmail\(b\.email\)/);
    expect(drug).toMatch(/asDrugText\(a\.driverName\)/);
    expect(assess).toMatch(/asDue\(a\.dueDate, "9999"\)\.localeCompare/);
  });
});
