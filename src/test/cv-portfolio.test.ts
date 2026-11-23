import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { METRICS, METRICS_PUBLIC, PROFILE, PROJECTS } from "@/cv/content";

describe("Split CV: web portfolio + separate A4 PDF", () => {
  it("keeps separate React surfaces under src/cv/", () => {
    expect(existsSync(resolve(process.cwd(), "src/cv/CvPortfolio.tsx"))).toBe(true);
    expect(existsSync(resolve(process.cwd(), "src/cv/CvA4Resume.tsx"))).toBe(true);
    expect(existsSync(resolve(process.cwd(), "src/cv/resume-pdf.ts"))).toBe(true);
    expect(existsSync(resolve(process.cwd(), "src/cv/cv-portfolio.css"))).toBe(true);
  });

  it("routes /cv through the portfolio component", () => {
    const route = readFileSync(resolve(process.cwd(), "src/routes/cv.tsx"), "utf8");
    expect(route).toMatch(/CvPortfolio/);
  });

  it("portfolio is full-width interactive, not a print sheet", () => {
    const css = readFileSync(resolve(process.cwd(), "src/cv/cv-portfolio.css"), "utf8");
    const tsx = readFileSync(resolve(process.cwd(), "src/cv/CvPortfolio.tsx"), "utf8");
    expect(css).toMatch(/min\(1180px|min\(1240px/);
    expect(css).toMatch(/cv-nav|cv-hero|cv-stage/);
    expect(css).not.toMatch(/cv-page/);
    expect(tsx).toMatch(/CvA4Resume/);
    expect(tsx).toMatch(/Personal portfolio/);
    expect(tsx).toMatch(/floating|cv-nav/i);
  });

  it("keeps unverified metrics out of public surfaces until approved", () => {
    expect(METRICS_PUBLIC).toBe(false);
    expect(METRICS.every((m) => m.unverified)).toBe(true);
    const portfolio = readFileSync(resolve(process.cwd(), "src/cv/CvPortfolio.tsx"), "utf8");
    const pdf = readFileSync(resolve(process.cwd(), "src/cv/resume-pdf.ts"), "utf8");
    expect(portfolio).toMatch(/METRICS_PUBLIC/);
    expect(pdf).toMatch(/METRICS_PUBLIC/);
  });

  it("A4 PDF builder uses ATS-friendly type scale and margins", () => {
    const pdf = readFileSync(resolve(process.cwd(), "src/cv/resume-pdf.ts"), "utf8");
    expect(pdf).toMatch(/margin\s*=\s*15/);
    expect(pdf).toMatch(/setFontSize\(24\)/);
    expect(pdf).toMatch(/setFontSize\(12\)/);
    expect(pdf).toMatch(/10\.5/);
  });

  it("hides dashboard chrome on /cv after hydrate", () => {
    const root = readFileSync(resolve(process.cwd(), "src/routes/__root.tsx"), "utf8");
    expect(root).toMatch(/showDashboardChrome/);
  });

  it("keeps sanitized projects and YOUSAF facts", () => {
    expect(JSON.stringify(PROJECTS)).not.toMatch(/okzcwctsgurumnnzuxgg|service_role|eyJ/);
    expect(PROFILE.brand).toBe("YOUSAF");
    expect(PROFILE.email).toBe("yousafranaitx@gmail.com");
  });

  it("builds A4 résumé in 1–2 pages", async () => {
    const { buildResumePdf } = await import("@/cv/resume-pdf");
    const doc = buildResumePdf();
    const pages = doc.getNumberOfPages();
    expect(pages).toBeGreaterThanOrEqual(1);
    expect(pages).toBeLessThanOrEqual(2);
  });
});
