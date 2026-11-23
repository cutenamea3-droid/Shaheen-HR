import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { classifyHrLoginError } from "@/admin/lib/hr-login";

describe("auth error / DriverCards / DOT / dispatch report coerce guards", () => {
  it("classifyHrLoginError coerces non-string message before toLowerCase", () => {
    expect(classifyHrLoginError({ message: 12345, status: 400 })).toBe("credentials");
    expect(classifyHrLoginError({ message: "failed to fetch", status: 0 })).toBe("network");
  });

  it("cloud friendlyAuthError / isMissingAccountsTable use asErrText", () => {
    const src = readFileSync(resolve(process.cwd(), "src/lib/cloud.ts"), "utf8");
    expect(src).toMatch(/function asErrText\(/);
    expect(src).toMatch(/asErrText\(err\?\.message\)/);
    expect(src).toMatch(/asErrText\(error\.message\)/);
    expect(src).not.toMatch(/\(err\?\.message \?\? ""\)\.toLowerCase\(\)/);
  });

  it("DriverCards hydrate/display uses asName coerce for name", () => {
    const src = readFileSync(resolve(process.cwd(), "src/components/tracker/DriverCards.tsx"), "utf8");
    expect(src).toMatch(/if \(!asName\(d\.name\)\) d\.name = asName\(r\.cells\[0\]\)/);
    expect(src).not.toMatch(/if \(!d\.name\.trim\(\)\)/);
  });

  it("DOT audit coerces row.name before emptiness check", () => {
    const src = readFileSync(resolve(process.cwd(), "src/lib/dot-audit.ts"), "utf8");
    expect(src).toMatch(/if \(!asN\(row\.name\)\) row\.name = asN\(cells\[0\]\)/);
    expect(src).not.toMatch(/if \(!row\.name\.trim\(\)\)/);
  });

  it("dispatch reports coerce load_number / summary before PDF helpers", () => {
    const src = readFileSync(resolve(process.cwd(), "src/dispatch/lib/reports.ts"), "utf8");
    expect(src).toMatch(/function asReportText\(/);
    expect(src).toMatch(/asReportText\(load\.load_number\)/);
    expect(src).toMatch(/asReportText\(handover\.summary\)/);
    expect(src).not.toMatch(/doc\.splitTextToSize\(handover\.summary \|\|/);
  });
});
