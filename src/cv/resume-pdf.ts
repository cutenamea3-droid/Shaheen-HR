/**
 * Dense A4 multi-column résumé — visual cousin of the portfolio, not a print of the long scroll.
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

const ACCENT: [number, number, number] = [79, 70, 229]; // indigo
const INK: [number, number, number] = [28, 25, 23];
const MUTED: [number, number, number] = [92, 86, 80];
const LINE: [number, number, number] = [230, 224, 214];
const SOFT: [number, number, number] = [246, 243, 238];

function wrap(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text, maxWidth) as string[];
}

export function downloadResumePdf() {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;
  const gutter = 6;
  const colGap = 7;
  const leftW = 62;
  const rightX = margin + leftW + colGap;
  const rightW = pageW - rightX - margin;

  // Soft page wash
  doc.setFillColor(...SOFT);
  doc.rect(0, 0, pageW, pageH, "F");

  // Accent bar
  doc.setFillColor(...ACCENT);
  doc.rect(0, 0, pageW, 2.2, "F");

  // —— Header ——
  let y = 14;
  doc.setTextColor(...INK);
  doc.setFont("times", "bold");
  doc.setFontSize(22);
  doc.text(PROFILE.fullName, margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...ACCENT);
  doc.text(`${PROFILE.role} · ${PROFILE.company}`, margin, y);
  y += 5;
  doc.setTextColor(...MUTED);
  doc.setFontSize(8.5);
  doc.text(
    `${PROFILE.location}  ·  ${PROFILE.phone}  ·  ${PROFILE.email}`,
    margin,
    y,
  );
  y += 4;
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageW - margin, y);
  y += 6;

  // Summary
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("PROFILE", margin, y);
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.4);
  doc.setTextColor(...MUTED);
  const summaryLines = wrap(doc, PROFILE.summary, pageW - margin * 2);
  doc.text(summaryLines, margin, y);
  y += summaryLines.length * 3.6 + 3;

  // Metrics strip (flag unverified in tiny note)
  const metrics = METRICS.slice(0, 5);
  const cellW = (pageW - margin * 2 - gutter * (metrics.length - 1)) / metrics.length;
  metrics.forEach((m, i) => {
    const x = margin + i * (cellW + gutter);
    doc.setFillColor(255, 252, 248);
    doc.roundedRect(x, y, cellW, 14, 1.5, 1.5, "F");
    doc.setTextColor(...ACCENT);
    doc.setFont("times", "bold");
    doc.setFontSize(11);
    doc.text(m.value, x + cellW / 2, y + 5.5, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.8);
    doc.setTextColor(...MUTED);
    const cap = wrap(doc, m.caption, cellW - 3);
    doc.text(cap.slice(0, 2), x + cellW / 2, y + 9.2, { align: "center" });
  });
  y += 16;
  doc.setFontSize(6.2);
  doc.setTextColor(...ACCENT);
  doc.text("Metrics pending owner confirmation · sourced from prior CV page", margin, y);
  y += 5;
  doc.setDrawColor(...LINE);
  doc.line(margin, y, pageW - margin, y);
  y += 6;

  const colTop = y;

  // —— Left column ——
  let ly = colTop;
  const leftRule = (title: string) => {
    doc.setTextColor(...INK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(title, margin, ly);
    ly += 1.5;
    doc.setDrawColor(...ACCENT);
    doc.setLineWidth(0.6);
    doc.line(margin, ly, margin + 14, ly);
    ly += 4.5;
  };

  leftRule("SKILLS");
  for (const group of SKILL_GROUPS) {
    doc.setTextColor(...ACCENT);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text(group.label.toUpperCase(), margin, ly);
    ly += 3.4;
    doc.setTextColor(...MUTED);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.6);
    for (const item of group.items) {
      doc.text(`•  ${item}`, margin, ly);
      ly += 3.2;
    }
    ly += 2;
  }

  leftRule("EDUCATION");
  for (const ed of EDUCATION) {
    doc.setTextColor(...INK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.6);
    const titleLines = wrap(doc, ed.title, leftW - 1);
    doc.text(titleLines, margin, ly);
    ly += titleLines.length * 3.1;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED);
    doc.setFontSize(7.2);
    const placeLines = wrap(doc, ed.place, leftW - 1);
    doc.text(placeLines, margin, ly);
    ly += placeLines.length * 3;
    doc.setTextColor(...ACCENT);
    doc.text(ed.note, margin, ly);
    ly += 4.2;
  }

  leftRule("LANGUAGES");
  for (const lang of LANGUAGES) {
    doc.setTextColor(...INK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.6);
    doc.text(lang.name, margin, ly);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED);
    doc.text(lang.level, margin + leftW - 1, ly, { align: "right" });
    ly += 3.8;
  }

  // —— Right column ——
  let ry = colTop;
  const rightRule = (title: string) => {
    doc.setTextColor(...INK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(title, rightX, ry);
    ry += 1.5;
    doc.setDrawColor(...ACCENT);
    doc.setLineWidth(0.6);
    doc.line(rightX, ry, rightX + 14, ry);
    ry += 4.5;
  };

  rightRule("EXPERIENCE");
  for (const job of EXPERIENCE) {
    if (ry > pageH - 28) break;
    doc.setTextColor(...INK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.2);
    const roleLines = wrap(doc, job.role, rightW);
    doc.text(roleLines, rightX, ry);
    ry += roleLines.length * 3.2;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.4);
    doc.setTextColor(...MUTED);
    doc.text(job.company, rightX, ry);
    doc.setTextColor(...ACCENT);
    doc.setFont("helvetica", "bold");
    doc.text(job.time, rightX + rightW, ry, { align: "right" });
    ry += 3.4;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED);
    doc.setFontSize(7.5);
    const body = wrap(doc, job.text, rightW);
    doc.text(body, rightX, ry);
    ry += body.length * 3.15 + 3.2;
  }

  rightRule("SELECTED PROJECTS");
  for (const project of PROJECTS) {
    if (ry > pageH - 22) break;
    doc.setTextColor(...INK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.2);
    doc.text(project.name, rightX, ry);
    ry += 3.4;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED);
    doc.setFontSize(7.5);
    const body = wrap(doc, project.summary, rightW);
    doc.text(body.slice(0, 4), rightX, ry);
    ry += Math.min(body.length, 4) * 3.15 + 2.5;
    doc.setFontSize(7);
    doc.setTextColor(...ACCENT);
    doc.text(project.stack.join("  ·  "), rightX, ry);
    ry += 4.5;
  }

  // Footer
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.line(margin, pageH - 10, pageW - margin, pageH - 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...MUTED);
  doc.text("Muhammad Yousaf Shahzad — Personal CV", margin, pageH - 6);
  doc.setTextColor(...ACCENT);
  doc.text("A4 résumé", pageW - margin, pageH - 6, { align: "right" });

  doc.save("Yousaf-Shahzad-CV.pdf");
}
