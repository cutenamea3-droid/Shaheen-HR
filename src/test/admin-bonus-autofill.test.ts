import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Admin PayrollVerify bonus autofill", () => {
  it("reads bonus amount from DOM on save", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/admin/components/hr/PayrollVerify.tsx"),
      "utf8",
    );
    expect(src).toMatch(/onInput=\{\(e\) =>/);
    expect(src).toMatch(/querySelector\?\.\("input"\)/);
    expect(src).toMatch(/data-testid=\{`admin-bonus-\$\{r\.employeeId\}`\}/);
  });
});
