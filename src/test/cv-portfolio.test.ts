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
    expect(tsx).not.toMatch(/cv-stage|cv-stage-mono/);
    expect(css).not.toMatch(/cv-stage-mono/);
    expect(tsx).toMatch(/cv-portrait/);
    expect(tsx).toMatch(/\/cv\/portrait\.(webp|jpg)/);
    expect(tsx).not.toMatch(/cv-now/);
    const resumeSrc = readFileSync(resolve(process.cwd(), "src/cv/resume-pdf.ts"), "utf8");
    expect(resumeSrc).not.toMatch(/addImage|\/cv\/portrait/);
    expect(css).toMatch(/clamp\(3\.6em,\s*7\.2vw,\s*5\.5em\)/);
    expect(css).toMatch(/min\(1360px|min\(1400px|min\(1440px/);
    expect(css).toMatch(/font-size:\s*23px/);
    expect(tsx).toMatch(/cv-exp-row/);
    expect(tsx).toMatch(/cv-case/);
    expect(tsx).toMatch(/cv-skill-tiles/);
    expect(tsx).toMatch(/cv-nav-chrome/);
    expect(css).toMatch(/background:\s*#ffffff/);
    expect(css).toMatch(/backdrop-filter/);
    expect(tsx).toMatch(/Download Resume/);
    expect(tsx).not.toMatch(/label=\{?"A4 PDF"?\}|label=\{?"Download CV"?\}/);
    expect(tsx).toMatch(/cv-faq-trigger/);
    expect(tsx).toMatch(/layoutId="cv-nav-pill"/);
    // Exactly one Contact download + nav CTA; no footer download
    expect(tsx).not.toMatch(/cv-footer[\s\S]*CvA4Resume/);
  });

  it("keeps metrics off public surfaces", () => {
    expect(METRICS_PUBLIC).toBe(false);
  });

  it("A4 PDF uses ATS type scale and fills 1–2 pages", async () => {
    const pdfSrc = readFileSync(resolve(process.cwd(), "src/cv/resume-pdf.ts"), "utf8");
    expect(pdfSrc).toMatch(/margin\s*=\s*11/);
    expect(pdfSrc).toMatch(/setFontSize\(22\)/);
    expect(pdfSrc).toMatch(/11\.(5|2|8)|12/);
    expect(pdfSrc).not.toMatch(/roundedRect/); // no empty cream filler bands
    expect(pdfSrc).toMatch(/PROFILE\.fullName/);
    expect(pdfSrc).not.toMatch(/Curriculum Vitae/);
    expect(pdfSrc).not.toMatch(/"A4 résumé"/);
    expect(pdfSrc).toMatch(/Page \$\{p\} of \$\{pageCount\}/);
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
