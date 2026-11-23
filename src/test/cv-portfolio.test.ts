import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { METRICS_PUBLIC, PROFILE, PROJECTS } from "@/cv/content";

describe("Final CV split: Framer portfolio + A4 PDF", () => {
  it("keeps separate portfolio and résumé components", () => {
    expect(existsSync(resolve(process.cwd(), "src/cv/CvPortfolio.tsx"))).toBe(true);
    expect(existsSync(resolve(process.cwd(), "src/cv/CvA4Resume.tsx"))).toBe(true);
    expect(existsSync(resolve(process.cwd(), "src/cv/resume-pdf.ts"))).toBe(true);
  });

  it("portfolio has editorial hero without empty initials panel", () => {
    const tsx = readFileSync(resolve(process.cwd(), "src/cv/CvPortfolio.tsx"), "utf8");
    const css = readFileSync(resolve(process.cwd(), "src/cv/cv-portfolio.css"), "utf8");
    expect(tsx).not.toMatch(/cv-stage|cv-stage-mono|cv-portrait/);
    expect(css).not.toMatch(/cv-stage-mono|cv-portrait/);
    expect(css).toMatch(/clamp\(3\.6rem,\s*7\.2vw,\s*5\.5rem\)/);
    expect(css).toMatch(/min\(1260px|min\(1280px/);
    expect(tsx).toMatch(/cv-exp-row/);
    expect(tsx).toMatch(/cv-case/);
    expect(tsx).toMatch(/cv-skill-tiles/);
    expect(tsx).toMatch(/cv-nav-chrome/);
    expect(css).toMatch(/background:\s*#fffcf8/);
  });

  it("keeps metrics off public surfaces", () => {
    expect(METRICS_PUBLIC).toBe(false);
  });

  it("A4 PDF uses ATS type scale and fills 1–2 pages", async () => {
    const pdfSrc = readFileSync(resolve(process.cwd(), "src/cv/resume-pdf.ts"), "utf8");
    expect(pdfSrc).toMatch(/margin\s*=\s*14/);
    expect(pdfSrc).toMatch(/setFontSize\(23\)/);
    expect(pdfSrc).toMatch(/10\.(2|5|6|8)/);
    expect(pdfSrc).not.toMatch(/roundedRect/); // no empty cream filler bands
    const { buildResumePdf } = await import("@/cv/resume-pdf");
    const pages = buildResumePdf().getNumberOfPages();
    expect(pages).toBeGreaterThanOrEqual(1);
    expect(pages).toBeLessThanOrEqual(2);
  });

  it("preserves YOUSAF facts and sanitized projects", () => {
    expect(PROFILE.brand).toBe("YOUSAF");
    expect(PROFILE.email).toBe("yousafranaitx@gmail.com");
    expect(JSON.stringify(PROJECTS)).not.toMatch(/okzcwctsgurumnnzuxgg|service_role|eyJ/);
  });
});
