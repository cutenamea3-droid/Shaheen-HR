import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { METRICS, PROFILE, PROJECTS } from "@/cv/content";

describe("Premium CV portfolio isolation", () => {
  it("keeps CV content package under src/cv/", () => {
    expect(existsSync(resolve(process.cwd(), "src/cv/content.ts"))).toBe(true);
    expect(existsSync(resolve(process.cwd(), "src/cv/CvPortfolio.tsx"))).toBe(true);
    expect(existsSync(resolve(process.cwd(), "src/cv/cv-portfolio.css"))).toBe(true);
    expect(existsSync(resolve(process.cwd(), "src/cv/resume-pdf.ts"))).toBe(true);
  });

  it("routes /cv through the isolated portfolio component", () => {
    const route = readFileSync(resolve(process.cwd(), "src/routes/cv.tsx"), "utf8");
    expect(route).toMatch(/CvPortfolio/);
    expect(route).toMatch(/@\/cv\/CvPortfolio/);
  });

  it("scopes portfolio tokens under .cv-theme and uses indigo accent", () => {
    const css = readFileSync(resolve(process.cwd(), "src/cv/cv-portfolio.css"), "utf8");
    expect(css).toMatch(/\.cv-theme\s*\{/);
    expect(css).toMatch(/--cv-accent:\s*#4f46e5/);
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce/);
    expect(css).not.toMatch(/#f97316/);
  });

  it("does not leave orange CV tokens in global styles.css", () => {
    const css = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");
    expect(css).not.toMatch(/\.cv-theme\s*\{[\s\S]*#f97316/);
  });

  it("hides dashboard chrome on /cv only after hydrate", () => {
    const root = readFileSync(resolve(process.cwd(), "src/routes/__root.tsx"), "utf8");
    expect(root).toMatch(/showDashboardChrome/);
    expect(root).toMatch(/!hydrated\s*\|\|\s*!isPublic/);
    const sw = readFileSync(resolve(process.cwd(), "src/components/AppSwitcher.tsx"), "utf8");
    expect(sw).toMatch(/hydrated\s*&&\s*isCv/);
  });

  it("flags unverified metrics for confirmation", () => {
    expect(METRICS.length).toBeGreaterThan(0);
    expect(METRICS.every((m) => m.unverified === true)).toBe(true);
  });

  it("keeps sanitized project case studies without prod secrets", () => {
    const blob = JSON.stringify(PROJECTS);
    expect(blob).not.toMatch(/okzcwctsgurumnnzuxgg|service_role|eyJ/);
    expect(PROJECTS.map((p) => p.id).sort()).toEqual(["admin", "compliance"]);
  });

  it("preserves YOUSAF brand + contact facts from prior CV", () => {
    expect(PROFILE.brand).toBe("YOUSAF");
    expect(PROFILE.email).toBe("yousafranaitx@gmail.com");
    expect(PROFILE.phone).toBe("03196658197");
    expect(PROFILE.company).toBe("Shaheen Transport LLC");
  });

  it("exports A4 résumé downloader", async () => {
    const mod = await import("@/cv/resume-pdf");
    expect(typeof mod.downloadResumePdf).toBe("function");
  });
});
