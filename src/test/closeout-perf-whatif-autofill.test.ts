import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Closeout / Performance / what-if autofill", () => {
  it("LoadEditor cancel/reschedule/closeout/reopen read DOM", () => {
    const src = readFileSync(resolve(process.cwd(), "src/dispatch/DispatchApp.tsx"), "utf8");
    expect(src).toMatch(/cancelReasonRef\.current\?\.value/);
    expect(src).toMatch(/closeoutNoteRef\.current\?\.value/);
    expect(src).toMatch(/reopenReasonRef\.current\?\.value/);
    expect(src).toMatch(/data-testid="dispatch-cancel-reason"/);
    expect(src).toMatch(/data-testid="dispatch-closeout-note"/);
  });

  it("Admin Performance statements update on input", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/admin/components/hr/Performance.tsx"),
      "utf8",
    );
    expect(src).toMatch(/onInput=\{\(ev\) => setStmtText/);
    expect(src).toMatch(/onInput=\{\(ev\) => setPerf\(date, e\.id, \{ note:/);
  });

  it("Personal what-if percentages read DOM", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/personal/components/Analytics.tsx"),
      "utf8",
    );
    expect(src).toMatch(/swPctRef\.current\?\.value/);
    expect(src).toMatch(/data-testid="personal-sw-pct"/);
  });
});
