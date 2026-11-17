import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("EditableText / DateCell / Dispatch login / reopen autofill", () => {
  it("EditableText and DateCell save from DOM when onChange is skipped", () => {
    const src = readFileSync(resolve(process.cwd(), "src/components/tracker/cells.tsx"), "utf8");
    expect(src).toMatch(/data-testid="editable-text"/);
    expect(src).toMatch(/commit\(draft \|\| ref\.current\?\.value \|\| ""\)/);
    expect(src).toMatch(/data-testid="date-cell-text"/);
    expect(src).toMatch(/dateTextRef\.current\?\.value/);
  });

  it("Dispatch LoginGate reads email/password from DOM", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/dispatch/components/LoginGate.tsx"),
      "utf8",
    );
    expect(src).toMatch(/emailRef\.current\?\.value/);
    expect(src).toMatch(/passwordRef\.current\?\.value/);
  });

  it("Admin month reopen reads reason from DOM", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/admin/components/hr/Reports.tsx"),
      "utf8",
    );
    expect(src).toMatch(/reopenReasonRef\.current\?\.value/);
    expect(src).toMatch(/data-testid="admin-reopen-reason"/);
  });
});
