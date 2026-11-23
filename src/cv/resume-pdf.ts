/**
 * Recruiter-friendly A4 résumé (1–2 pages) — print-first, not a web screenshot.
 */
import { jsPDF } from "jspdf";
import {
  EDUCATION,
  EXPERIENCE,
  LANGUAGES,
  METRICS,
  PROFILE,
  PROJECTS,
  SKILL_GROUPS,
} from "./content";

const INK: [number, number, number] = [26, 26, 26];
const MUTED: [number, number, number] = [68, 68, 68];
const ACCENT: [number, number, number] = [55, 48, 163];
const LINE: [number, number, number] = [200, 196, 188];
const SOFT: [number, number, number] = [240, 238, 234];

type Doc = jsPDF & { __y: number; __page: number };

function wrap(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text, maxWidth) as string[];
}

function ensureSpace(d: Doc, need: number, margin: number, pageH: number) {
  if (d.__y + need <= pageH - margin) return;
  d.addPage();
  d.__page += 1;
  d.__y = margin;
  // subtle top rule on continuation pages
  d.setDrawColor(...LINE);
  d.setLineWidth(0.3);
  d.line(margin, d.__y, d.internal.pageSize.getWidth() - margin, d.__y);
  d.__y += 6;
}

function sectionRule(d: Doc, title: string, margin: number, pageW: number) {
  ensureSpace(d, 10, margin, d.internal.pageSize.getHeight());
  d.setTextColor(...INK);
  d.setFont("helvetica", "bold");
  d.setFontSize(9.5);
  d.text(title.toUpperCase(), margin, d.__y);
  d.__y += 1.8;
  d.setDrawColor(...INK);
  d.setLineWidth(0.45);
  d.line(margin, d.__y, pageW - margin, d.__y);
  d.__y += 5;
}

export function buildResumePdf(): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" }) as Doc;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = pageW - margin * 2;

  doc.__y = margin;
  doc.__page = 1;

  // Header
  doc.setTextColor(...INK);
  doc.setFont("times", "bold");
  doc.setFontSize(18);
  doc.text(PROFILE.fullName, margin, doc.__y);
  doc.__y += 6.2;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...ACCENT);
  doc.text(`${PROFILE.role} · ${PROFILE.company}`, margin, doc.__y);
  doc.__y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.2);
  doc.setTextColor(...MUTED);
  doc.text(
    `${PROFILE.location}  ·  ${PROFILE.phone}  ·  ${PROFILE.email}`,
    margin,
    doc.__y,
  );
  doc.__y += 4;
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.7);
  doc.line(margin, doc.__y, pageW - margin, doc.__y);
  doc.__y += 7;

  // Summary
  sectionRule(doc, "Professional summary", margin, pageW);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.4);
  doc.setTextColor(...MUTED);
  const summary = wrap(doc, PROFILE.summary, contentW);
  ensureSpace(doc, summary.length * 4 + 2, margin, pageH);
  doc.text(summary, margin, doc.__y);
  doc.__y += summary.length * 4 + 3;

  // Metrics box
  const metricLines = METRICS.map((m) => `${m.value} — ${m.caption}`);
  const metricWrapped = metricLines.flatMap((line) => wrap(doc, `•  ${line}`, contentW - 4));
  const boxH = 7 + metricWrapped.length * 3.6 + 5;
  ensureSpace(doc, boxH + 2, margin, pageH);
  doc.setFillColor(...SOFT);
  doc.roundedRect(margin, doc.__y, contentW, boxH, 1.2, 1.2, "F");
  let by = doc.__y + 4.5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...INK);
  doc.text("Selected highlights", margin + 2.5, by);
  by += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.4);
  doc.setTextColor(...MUTED);
  for (const line of metricWrapped) {
    doc.text(line, margin + 2.5, by);
    by += 3.6;
  }
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.4);
  doc.setTextColor(...ACCENT);
  doc.text(
    "Metrics flagged for confirmation — from prior CV page; not independently verified.",
    margin + 2.5,
    by + 0.5,
  );
  doc.__y += boxH + 5;

  // Skills
  sectionRule(doc, "Core skills", margin, pageW);
  for (const group of SKILL_GROUPS) {
    const label = `${group.label}: `;
    const body = group.items.join(" · ");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    const labelW = doc.getTextWidth(label);
    const lines = wrap(doc, body, contentW - labelW);
    ensureSpace(doc, lines.length * 3.7 + 1.2, margin, pageH);
    doc.setTextColor(...INK);
    doc.text(label, margin, doc.__y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED);
    doc.text(lines[0] ?? "", margin + labelW, doc.__y);
    for (let i = 1; i < lines.length; i++) {
      doc.__y += 3.7;
      doc.text(lines[i]!, margin + labelW, doc.__y);
    }
    doc.__y += 4.2;
  }
  doc.__y += 1.5;

  // Experience
  sectionRule(doc, "Experience", margin, pageW);
  for (const job of EXPERIENCE) {
    const roleLines = wrap(doc, job.role, contentW - 42);
    const body = wrap(doc, job.text, contentW);
    const blockH = roleLines.length * 3.8 + 3.6 + body.length * 3.5 + 3.2;
    ensureSpace(doc, blockH, margin, pageH);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.6);
    doc.setTextColor(...INK);
    doc.text(roleLines, margin, doc.__y);
    doc.setFontSize(8.5);
    doc.setTextColor(...ACCENT);
    doc.text(job.time, pageW - margin, doc.__y, { align: "right" });
    doc.__y += roleLines.length * 3.8;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.7);
    doc.setTextColor(...MUTED);
    doc.text(job.company, margin, doc.__y);
    doc.__y += 3.6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.7);
    doc.setTextColor(...MUTED);
    doc.text(body, margin, doc.__y);
    doc.__y += body.length * 3.5 + 3.2;
  }

  // Projects (compact one-liners + stack)
  sectionRule(doc, "Projects", margin, pageW);
  for (const project of PROJECTS) {
    const oneLine = `${project.summary} (${project.stack.join(", ")})`;
    const body = wrap(doc, oneLine, contentW);
    ensureSpace(doc, 3.8 + body.length * 3.4 + 3, margin, pageH);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.4);
    doc.setTextColor(...INK);
    doc.text(project.name, margin, doc.__y);
    doc.__y += 3.8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    doc.text(body, margin, doc.__y);
    doc.__y += body.length * 3.4 + 3;
  }

  // Education + Languages kept together when possible
  const eduBlock =
    EDUCATION.length * 9 + 14 + 10;
  ensureSpace(doc, eduBlock, margin, pageH);
  sectionRule(doc, "Education", margin, pageW);
  for (const ed of EDUCATION) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.2);
    doc.setTextColor(...INK);
    doc.text(ed.title, margin, doc.__y);
    doc.__y += 3.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    doc.text(`${ed.place}  ·  `, margin, doc.__y);
    const placeW = doc.getTextWidth(`${ed.place}  ·  `);
    doc.setTextColor(...ACCENT);
    doc.setFont("helvetica", "bold");
    doc.text(ed.note, margin + placeW, doc.__y);
    doc.__y += 4.8;
  }

  sectionRule(doc, "Languages", margin, pageW);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  const langLine = LANGUAGES.map((l) => `${l.name} (${l.level})`).join("   ·   ");
  doc.text(langLine, margin, doc.__y);
  doc.__y += 6;

  // Footer on each page
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text("Muhammad Yousaf Shahzad — Curriculum Vitae", margin, pageH - 8);
    doc.setTextColor(...ACCENT);
    doc.text(`Page ${i} of ${total}`, pageW - margin, pageH - 8, { align: "right" });
  }

  return doc;
}

export function downloadResumePdf() {
  buildResumePdf().save("Yousaf-Shahzad-CV.pdf");
}
