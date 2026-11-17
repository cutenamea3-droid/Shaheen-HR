import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Reproduces owner video: My HR Today paints then ~1.3s ErrorBoundary.
 * Root cause: zustand selectors that call dueOnOrBefore / openFollowUps allocate a
 * new array every getSnapshot → React #185 Maximum update depth exceeded in <MyHrToday>.
 */
describe("MyHrToday stable zustand snapshots (React #185)", () => {
  const src = readFileSync(resolve(process.cwd(), "src/admin/components/hr/MyHrToday.tsx"), "utf8");

  it("does not call dueOnOrBefore inside useHrReminders selector", () => {
    expect(src).not.toMatch(/useHrReminders\(\(s\)\s*=>\s*s\.dueOnOrBefore/);
    expect(src).toMatch(/useHrReminders\(\(s\)\s*=>\s*s\.reminders\)/);
    expect(src).toMatch(/reminders\.filter/);
  });

  it("does not call openFollowUps inside usePerfFollowUps selector", () => {
    expect(src).not.toMatch(/usePerfFollowUps\(\(s\)\s*=>\s*s\.openFollowUps/);
    expect(src).toMatch(/usePerfFollowUps\(\(s\)\s*=>\s*s\.followUps\)/);
    expect(src).toMatch(/followUps\.filter/);
  });

  it("root Error and 404 Go home use probed homePath (not hardcoded /)", () => {
    const root = readFileSync(resolve(process.cwd(), "src/routes/__root.tsx"), "utf8");
    expect(root).toMatch(/useHomePathAfterProbe/);
    expect(root).toMatch(/function NotFoundComponent/);
    // Both Error + NotFound must use probed home (Admin-/Dispatch-only safe).
    expect(root.match(/href=\{homePath\}/g)?.length).toBeGreaterThanOrEqual(2);
    expect(root).not.toMatch(/NotFoundComponent[\s\S]*?<Link[\s\S]*?to="\/"/);
  });

  it("Admin module error home returns to /admin", () => {
    const admin = readFileSync(resolve(process.cwd(), "src/routes/admin.tsx"), "utf8");
    expect(admin).toMatch(/homeTo="\/admin"/);
  });
});
