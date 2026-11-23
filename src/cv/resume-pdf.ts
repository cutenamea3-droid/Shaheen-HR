/**
 * Separate A4 résumé builder (ATS-friendly) — not a web screenshot.
 * Body 10.5–11.5pt · Headings 12–14pt · Name 24–28pt · Margins 15–18mm
 * Metrics excluded while METRICS_PUBLIC is false.
 */
import { jsPDF } from "jspdf";
import {
  EDUCATION,
  EXPERIENCE,
  INTERESTS,
  LANGUAGES,
  METRICS,
  METRICS_PUBLIC,
  PROFILE,
  PROJECTS,
  SKILL_GROUPS,
} from "./content";

const INK: [number, number, number] = [26, 23, 20];
const MUTED: [number, number, number] = [70, 64, 58];
const VIOLET: [number, number, number] = [76, 29, 149];
const LINE: [number, number, number] = [210, 204, 194];

type Doc = jsPDF & { __y: number };

function wrap(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text, maxWidth) as string[];
}

function ensureSpace(d: Doc, need: number, margin: number, pageH: number) {
  if (d.__y + need <= pageH - margin - 8) return;
  d.addPage();
  d.__y = margin;
}

function sectionTitle(d: Doc, title: string, margin: number, pageW: number, pageH: number) {
  ensureSpace(d, 11, margin, pageH);
  d.__y += 2;
  d.setTextColor(...INK);
  d.setFont("helvetica", "bold");
  d.setFontSize(12);
  d.text(title.toUpperCase(), margin, d.__y);
  d.__y += 2;
  d.setDrawColor(...VIOLET);
  d.setLineWidth(0.55);
  d.line(margin, d.__y, margin + 16, d.__y);
  d.setDrawColor(...LINE);
  d.setLineWidth(0.25);
  d.line(margin + 18, d.__y, pageW - margin, d.__y);
  d.__y += 5.2;
}

export function buildResumePdf(): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" }) as Doc;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentW = pageW - margin * 2;
  doc.__y = margin;

  doc.setTextColor(...INK);
  doc.setFont("times", "bold");
  doc.setFontSize(26);
  doc.text(PROFILE.fullName, margin, doc.__y);
  doc.__y += 7.5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...VIOLET);
  doc.text(`${PROFILE.role}  |  ${PROFILE.company}`, margin, doc.__y);
  doc.__y += 5.2;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...MUTED);
  doc.text(`${PROFILE.location}  ·  ${PROFILE.phone}  ·  ${PROFILE.email}`, margin, doc.__y);
  doc.__y += 4.2;
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.65);
  doc.line(margin, doc.__y, pageW - margin, doc.__y);
  doc.__y += 6;

  sectionTitle(doc, "Professional summary", margin, pageW, pageH);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.8);
  doc.setTextColor(...MUTED);
  const summary = wrap(doc, PROFILE.summary, contentW);
  ensureSpace(doc, summary.length * 4.4 + 2, margin, pageH);
  doc.text(summary, margin, doc.__y);
  doc.__y += summary.length * 4.4 + 2.5;

  if (METRICS_PUBLIC) {
    for (const m of METRICS) {
      const line = wrap(doc, `•  ${m.value} — ${m.caption}`, contentW);
      ensureSpace(doc, line.length * 4.3 + 1, margin, pageH);
      doc.text(line, margin, doc.__y);
      doc.__y += line.length * 4.3 + 1;
    }
    doc.__y += 2;
  }

  sectionTitle(doc, "Core skills", margin, pageW, pageH);
  for (const group of SKILL_GROUPS) {
    const label = `${group.label}: `;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.6);
    const labelW = doc.getTextWidth(label);
    const lines = wrap(doc, group.items.join(", "), contentW - labelW);
    ensureSpace(doc, lines.length * 4.2 + 1.5, margin, pageH);
    doc.setTextColor(...INK);
    doc.text(label, margin, doc.__y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED);
    doc.text(lines[0] ?? "", margin + labelW, doc.__y);
    for (let i = 1; i < lines.length; i++) {
      doc.__y += 4.2;
      doc.text(lines[i]!, margin + labelW, doc.__y);
    }
    doc.__y += 4.5;
  }

  sectionTitle(doc, "Experience", margin, pageW, pageH);
  for (const job of EXPERIENCE) {
    const roleLines = wrap(doc, job.role, contentW - 46);
    const body = wrap(doc, job.text, contentW);
    ensureSpace(doc, roleLines.length * 3.9 + 3.6 + body.length * 3.9 + 3.2, margin, pageH);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.8);
    doc.setTextColor(...INK);
    doc.text(roleLines, margin, doc.__y);
    doc.setFontSize(10.5);
    doc.setTextColor(...VIOLET);
    doc.text(job.time, pageW - margin, doc.__y, { align: "right" });
    doc.__y += roleLines.length * 3.9;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...MUTED);
    doc.text(job.company, margin, doc.__y);
    doc.__y += 3.6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.text(body, margin, doc.__y);
    doc.__y += body.length * 3.9 + 3.2;
  }

  const projectBlurbs: Record<string, string> = {
    compliance:
      "Fleet compliance workspace for driver documents, medical cards, drug tests, and renewal plans with expiry-aware alerts.",
    admin:
      "Isolated HR desk for attendance, directory, expenses, and payroll-adjacent workflows — separated from driver compliance.",
  };
  sectionTitle(doc, "Projects", margin, pageW, pageH);
  for (const project of PROJECTS) {
    const blurb = projectBlurbs[project.id] ?? project.summary;
    const body = wrap(doc, `${blurb} (${project.stack.join(", ")})`, contentW);
    ensureSpace(doc, 4.2 + body.length * 4.1 + 3.5, margin, pageH);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.text(project.name, margin, doc.__y);
    doc.__y += 4.2;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(...MUTED);
    doc.text(body, margin, doc.__y);
    doc.__y += body.length * 4.1 + 3.5;
  }

  // Page 2 — Education / Languages / Interests / Contact (roomy rhythm to fill A4)
  doc.addPage();
  doc.__y = margin + 8;

  sectionTitle(doc, "Education", margin, pageW, pageH);
  for (const ed of EDUCATION) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13.5);
    doc.setTextColor(...INK);
    doc.text(ed.title, margin, doc.__y);
    doc.__y += 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11.5);
    doc.setTextColor(...MUTED);
    doc.text(`${ed.place}  ·  `, margin, doc.__y);
    const placeW = doc.getTextWidth(`${ed.place}  ·  `);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...VIOLET);
    doc.text(ed.note, margin + placeW, doc.__y);
    doc.__y += 18;
  }

  sectionTitle(doc, "Languages", margin, pageW, pageH);
  for (const lang of LANGUAGES) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12.5);
    doc.setTextColor(...INK);
    doc.text(lang.name, margin, doc.__y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED);
    doc.text(lang.level, pageW - margin, doc.__y, { align: "right" });
    doc.__y += 14;
  }

  sectionTitle(doc, "Interests", margin, pageW, pageH);
  for (const interest of INTERESTS) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12.5);
    doc.setTextColor(...INK);
    doc.text(interest.title, margin, doc.__y);
    doc.__y += 7;
    const body = wrap(doc, interest.text, contentW);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11.2);
    doc.setTextColor(...MUTED);
    doc.text(body, margin, doc.__y);
    doc.__y += body.length * 5.2 + 16;
  }

  sectionTitle(doc, "Contact", margin, pageW, pageH);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11.5);
  doc.setTextColor(...MUTED);
  const contactLines = [
    PROFILE.location,
    `${PROFILE.phone}  ·  ${PROFILE.email}`,
    "A4 résumé for applications — interactive portfolio lives at /cv (separate surface).",
    "References and verified metrics available on request after owner confirmation.",
  ];
  for (const line of contactLines) {
    doc.text(line, margin, doc.__y);
    doc.__y += 10;
  }

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
    doc.setTextColor(...VIOLET);
    doc.text(`Page ${i} of ${total}`, pageW - margin, pageH - 7, { align: "right" });
  }

  return doc;
}

export function downloadResumePdf() {
  buildResumePdf().save("Yousaf-Shahzad-CV.pdf");
}
