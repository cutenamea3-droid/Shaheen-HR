import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { METRICS, PROFILE, PROJECTS } from "@/cv/content";

describe("Recruiter-friendly CV resume isolation", () => {
  it("keeps CV content package under src/cv/", () => {
    expect(existsSync(resolve(process.cwd(), "src/cv/content.ts"))).toBe(true);
    expect(existsSync(resolve(process.cwd(), "src/cv/CvPortfolio.tsx"))).toBe(true);
    expect(existsSync(resolve(process.cwd(), "src/cv/cv-portfolio.css"))).toBe(true);
    expect(existsSync(resolve(process.cwd(), "src/cv/resume-pdf.ts"))).toBe(true);
  });

  it("routes /cv through the isolated resume component", () => {
    const route = readFileSync(resolve(process.cwd(), "src/routes/cv.tsx"), "utf8");
    expect(route).toMatch(/CvPortfolio/);
    expect(route).toMatch(/@\/cv\/CvPortfolio/);
  });

  it("uses print-first A4 resume styles without decorative hero chrome", () => {
    const css = readFileSync(resolve(process.cwd(), "src/cv/cv-portfolio.css"), "utf8");
    expect(css).toMatch(/\.cv-theme\s*\{/);
    expect(css).toMatch(/@page\s*\{[\s\S]*size:\s*A4/);
    expect(css).toMatch(/--cv-accent:\s*#3730a3/);
    expect(css).not.toMatch(/cv-portrait|cv-pill|cv-nav-mono/);
    expect(css).not.toMatch(/#f97316/);
  });

  it("renders resume structure without portrait / giant hero / FAQ", () => {
    const tsx = readFileSync(resolve(process.cwd(), "src/cv/CvPortfolio.tsx"), "utf8");
    expect(tsx).toMatch(/Professional summary/);
    expect(tsx).toMatch(/Core skills/);
    expect(tsx).toMatch(/Experience/);
    expect(tsx).toMatch(/Projects/);
    expect(tsx).toMatch(/Education/);
    expect(tsx).toMatch(/Languages/);
    expect(tsx).not.toMatch(/cv-portrait|FAQ|Get in touch|Personal portfolio/);
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

  it("exports A4 résumé builder and downloader", async () => {
    const mod = await import("@/cv/resume-pdf");
    expect(typeof mod.buildResumePdf).toBe("function");
    expect(typeof mod.downloadResumePdf).toBe("function");
    const doc = mod.buildResumePdf();
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    expect(doc.getNumberOfPages()).toBeLessThanOrEqual(2);
  });
});
