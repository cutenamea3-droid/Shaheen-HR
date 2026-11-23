/**
 * ATS-friendly A4 résumé builder — SEPARATE from the web portfolio.
 * Specs: 15–18mm margins · name 24–28pt · headings 12–14pt · body 10.5–11.5pt
 * Unconfirmed metrics are excluded until METRICS_PUBLIC is approved.
 */
import { jsPDF } from "jspdf";
import {
  EDUCATION,
  EXPERIENCE,
  LANGUAGES,
  METRICS,
  METRICS_PUBLIC,
  PROFILE,
  PROJECTS,
  SKILL_GROUPS,
} from "./content";

const INK: [number, number, number] = [28, 25, 23];
const MUTED: [number, number, number] = [70, 66, 60];
const ACCENT: [number, number, number] = [67, 56, 202];
const LINE: [number, number, number] = [210, 205, 196];

type Doc = jsPDF & { __y: number };

function wrap(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text, maxWidth) as string[];
}

function ensureSpace(d: Doc, need: number, margin: number, pageH: number) {
  if (d.__y + need <= pageH - margin - 6) return;
  d.addPage();
  d.__y = margin;
}

function sectionTitle(d: Doc, title: string, margin: number, pageW: number, pageH: number) {
  ensureSpace(d, 10, margin, pageH);
  d.__y += 1.5;
  d.setTextColor(...INK);
  d.setFont("helvetica", "bold");
  d.setFontSize(12); // 12–14pt headings
  d.text(title.toUpperCase(), margin, d.__y);
  d.__y += 2;
  d.setDrawColor(...ACCENT);
  d.setLineWidth(0.55);
  d.line(margin, d.__y, margin + 16, d.__y);
  d.setDrawColor(...LINE);
  d.setLineWidth(0.25);
  d.line(margin + 18, d.__y, pageW - margin, d.__y);
  d.__y += 5;
}

/** Build a dedicated A4 résumé (1–2 pages). Does not mirror the web portfolio. */
export function buildResumePdf(): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" }) as Doc;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15; // 15–18mm
  const contentW = pageW - margin * 2;
  doc.__y = margin;

  // Name 24–28pt
  doc.setTextColor(...INK);
  doc.setFont("times", "bold");
  doc.setFontSize(24);
  doc.text(PROFILE.fullName, margin, doc.__y);
  doc.__y += 7;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...ACCENT);
  doc.text(`${PROFILE.role}  |  ${PROFILE.company}`, margin, doc.__y);
  doc.__y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...MUTED);
  doc.text(
    `${PROFILE.location}  ·  ${PROFILE.phone}  ·  ${PROFILE.email}`,
    margin,
    doc.__y,
  );
  doc.__y += 4;
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.6);
  doc.line(margin, doc.__y, pageW - margin, doc.__y);
  doc.__y += 5.5;

  // Summary — body 10.5–11.5pt
  sectionTitle(doc, "Professional summary", margin, pageW, pageH);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...MUTED);
  const summary = wrap(doc, PROFILE.summary, contentW);
  ensureSpace(doc, summary.length * 4.2 + 2, margin, pageH);
  doc.text(summary, margin, doc.__y);
  doc.__y += summary.length * 4.2 + 2;

  if (METRICS_PUBLIC) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(...MUTED);
    for (const m of METRICS) {
      const line = wrap(doc, `•  ${m.value} — ${m.caption}`, contentW);
      ensureSpace(doc, line.length * 4.4 + 1, margin, pageH);
      doc.text(line, margin, doc.__y);
      doc.__y += line.length * 4.4 + 1;
    }
    doc.__y += 2;
  }

  // Skills
  sectionTitle(doc, "Core skills", margin, pageW, pageH);
  for (const group of SKILL_GROUPS) {
    const label = `${group.label}: `;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    const labelW = doc.getTextWidth(label);
    const lines = wrap(doc, group.items.join(", "), contentW - labelW);
    ensureSpace(doc, lines.length * 4.1 + 1.5, margin, pageH);
    doc.setTextColor(...INK);
    doc.text(label, margin, doc.__y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED);
    doc.text(lines[0] ?? "", margin + labelW, doc.__y);
    for (let i = 1; i < lines.length; i++) {
      doc.__y += 4.1;
      doc.text(lines[i]!, margin + labelW, doc.__y);
    }
    doc.__y += 4.2;
  }

  // Experience — full facts, slightly tighter leading to fill one A4 cleanly
  sectionTitle(doc, "Experience", margin, pageW, pageH);
  for (const job of EXPERIENCE) {
    const roleLines = wrap(doc, job.role, contentW - 48);
    const body = wrap(doc, job.text, contentW);
    const need = roleLines.length * 3.9 + 3.8 + body.length * 3.9 + 3.2;
    ensureSpace(doc, need, margin, pageH);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.8);
    doc.setTextColor(...INK);
    doc.text(roleLines, margin, doc.__y);
    doc.setFontSize(10.5);
    doc.setTextColor(...ACCENT);
    doc.text(job.time, pageW - margin, doc.__y, { align: "right" });
    doc.__y += roleLines.length * 3.9;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...MUTED);
    doc.text(job.company, margin, doc.__y);
    doc.__y += 3.7;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(...MUTED);
    doc.text(body, margin, doc.__y);
    doc.__y += body.length * 3.9 + 3.2;
  }

  // Projects — short ATS blurbs so Education can share page 1
  const projectBlurbs: Record<string, string> = {
    compliance:
      "Fleet compliance workspace for driver documents, medical cards, drug tests, and renewal plans.",
    admin:
      "Isolated HR desk for attendance, directory, expenses, and payroll-adjacent workflows.",
  };
  sectionTitle(doc, "Projects", margin, pageW, pageH);
  for (const project of PROJECTS) {
    const blurb = projectBlurbs[project.id] ?? project.summary;
    const line = `${blurb} (${project.stack.join(", ")})`;
    const body = wrap(doc, line, contentW);
    ensureSpace(doc, 4 + body.length * 4 + 3, margin, pageH);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.text(project.name, margin, doc.__y);
    doc.__y += 4;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(...MUTED);
    doc.text(body, margin, doc.__y);
    doc.__y += body.length * 4 + 3;
  }

  sectionTitle(doc, "Education", margin, pageW, pageH);
  for (const ed of EDUCATION) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.8);
    doc.setTextColor(...INK);
    doc.text(ed.title, margin, doc.__y);
    doc.__y += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(...MUTED);
    doc.text(`${ed.place}  ·  `, margin, doc.__y);
    const placeW = doc.getTextWidth(`${ed.place}  ·  `);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...ACCENT);
    doc.text(ed.note, margin + placeW, doc.__y);
    doc.__y += 5.5;
  }

  sectionTitle(doc, "Languages", margin, pageW, pageH);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...MUTED);
  doc.text(LANGUAGES.map((l) => `${l.name} (${l.level})`).join("   ·   "), margin, doc.__y);
  doc.__y += 6;

  // Page footers
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.25);
    doc.line(margin, pageH - 11, pageW - margin, pageH - 11);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    doc.text("Muhammad Yousaf Shahzad — Curriculum Vitae", margin, pageH - 7);
    doc.setTextColor(...ACCENT);
    doc.text(`Page ${i} of ${total}`, pageW - margin, pageH - 7, { align: "right" });
  }

  return doc;
}

export function downloadResumePdf() {
  buildResumePdf().save("Yousaf-Shahzad-CV.pdf");
}
