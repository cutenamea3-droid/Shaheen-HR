/**
 * Separate A4 résumé builder (ATS-friendly) — not a web screenshot.
 * Dense two-column layout filled with real content (no empty cream bands).
 * Body ~11–12pt · Headings 11.5–12pt · Name ~24pt · Margins 14mm
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
  type SkillItem,
} from "./content";

const INK: [number, number, number] = [26, 23, 20];
const MUTED: [number, number, number] = [70, 64, 58];
const VIOLET: [number, number, number] = [76, 29, 149];
const LINE: [number, number, number] = [210, 204, 194];

const TONE_RGB: Record<SkillItem["tone"], [number, number, number]> = {
  violet: [91, 33, 182],
  teal: [15, 118, 110],
  amber: [180, 83, 9],
  rose: [190, 18, 60],
  slate: [51, 65, 85],
  indigo: [55, 48, 163],
};

type Doc = jsPDF & { __y: number };

function wrap(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text, maxWidth) as string[];
}

function colTitle(d: Doc, title: string, x: number, y: number, colW: number): number {
  d.setTextColor(...INK);
  d.setFont("helvetica", "bold");
  d.setFontSize(12);
  d.text(title.toUpperCase(), x, y);
  d.setDrawColor(...VIOLET);
  d.setLineWidth(0.5);
  d.line(x, y + 1.9, x + 14, y + 1.9);
  d.setDrawColor(...LINE);
  d.setLineWidth(0.22);
  d.line(x + 16, y + 1.9, x + colW, y + 1.9);
  return y + 7.2;
}

/** Flow skill labels with colored dots across the column width */
function drawSkillsFlow(d: Doc, group: (typeof SKILL_GROUPS)[number], x: number, y: number, colW: number): number {
  d.setFont("helvetica", "bold");
  d.setFontSize(10.2);
  d.setTextColor(...VIOLET);
  d.text(group.label.toUpperCase(), x, y);
  y += 5;

  let cx = x;
  const rowH = 5.4;
  d.setFont("helvetica", "normal");
  d.setFontSize(10.5);
  for (let i = 0; i < group.items.length; i++) {
    const item = group.items[i]!;
    const rgb = TONE_RGB[item.tone];
    const label = item.label;
    const w = d.getTextWidth(label) + 4.5 + (i < group.items.length - 1 ? 3.2 : 0);
    if (cx + w > x + colW && cx > x) {
      cx = x;
      y += rowH;
    }
    d.setFillColor(rgb[0], rgb[1], rgb[2]);
    d.circle(cx + 1.2, y - 1.15, 1.1, "F");
    d.setTextColor(...INK);
    d.text(label, cx + 3.5, y);
    cx += w;
  }
  return y + rowH + 1.6;
}

export function buildResumePdf(): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" }) as Doc;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = pageW - margin * 2;
  const gutter = 6.5;
  const colW = (contentW - gutter) / 2;
  const leftX = margin;
  const rightX = margin + colW + gutter;
  const footerY = pageH - 9;
  const maxY = footerY - 8;

  let y = margin;
  doc.setTextColor(...INK);
  doc.setFont("times", "bold");
  doc.setFontSize(23);
  doc.text(PROFILE.fullName, margin, y);
  y += 6.2;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...VIOLET);
  doc.text(`${PROFILE.role}  ·  ${PROFILE.company}`, margin, y);
  y += 4.8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.6);
  doc.setTextColor(...MUTED);
  doc.text(`${PROFILE.location}  ·  ${PROFILE.phone}  ·  ${PROFILE.email}`, margin, y);
  y += 3.8;
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.55);
  doc.line(margin, y, pageW - margin, y);
  y += 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...INK);
  doc.text("PROFILE", margin, y);
  y += 1.9;
  doc.setDrawColor(...VIOLET);
  doc.setLineWidth(0.5);
  doc.line(margin, y, margin + 14, y);
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.22);
  doc.line(margin + 16, y, pageW - margin, y);
  y += 5.2;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11.2);
  doc.setTextColor(...MUTED);
  const summary = wrap(doc, PROFILE.summary, contentW);
  doc.text(summary, margin, y);
  y += summary.length * 4.6 + 2.8;

  if (METRICS_PUBLIC) {
    for (const m of METRICS) {
      doc.setFontSize(10.5);
      doc.text(`•  ${m.value} — ${m.caption}`, margin, y);
      y += 4.6;
    }
    y += 2;
  }

  let yL = y;
  let yR = y;

  // LEFT — Skills (flowing, larger)
  yL = colTitle(doc, "Skills", leftX, yL, colW);
  for (const group of SKILL_GROUPS) {
    yL = drawSkillsFlow(doc, group, leftX, yL, colW);
  }

  // LEFT — Education (detailed but compact enough for interests)
  yL = colTitle(doc, "Education", leftX, yL, colW);
  for (const ed of EDUCATION) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.8);
    doc.setTextColor(...INK);
    const titleLines = wrap(doc, ed.title, colW);
    doc.text(titleLines, leftX, yL);
    yL += titleLines.length * 4.3 + 0.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.3);
    doc.setTextColor(...VIOLET);
    doc.text(`${ed.place}  ·  ${ed.note}`, leftX, yL);
    yL += 4.2;
    doc.setTextColor(...MUTED);
    doc.setFontSize(10.3);
    const detail = wrap(doc, ed.detail, colW);
    doc.text(detail, leftX, yL);
    yL += detail.length * 4.05 + 2.6;
  }

  // LEFT — Languages (tight inline)
  yL = colTitle(doc, "Languages", leftX, yL, colW);
  for (const lang of LANGUAGES) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.8);
    doc.setTextColor(...INK);
    doc.text(`${lang.name} · ${lang.level}`, leftX, yL);
    yL += 5.2;
  }

  // LEFT — Interests (always both entries; keep readable)
  yL += 0.5;
  yL = colTitle(doc, "Interests", leftX, yL, colW);
  for (const interest of INTERESTS) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.6);
    doc.setTextColor(...INK);
    doc.text(interest.title, leftX, yL);
    yL += 4.2;
    const body = wrap(doc, interest.text, colW);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.2);
    doc.setTextColor(...MUTED);
    doc.text(body, leftX, yL);
    yL += body.length * 4.05 + 2.2;
  }

  // RIGHT — Experience (rich bullets on current role; concise earlier roles)
  yR = colTitle(doc, "Experience", rightX, yR, colW);
  for (const job of EXPERIENCE) {
    if (yR + 18 > maxY) break;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    const roleLines = wrap(doc, job.role, colW);
    doc.text(roleLines, rightX, yR);
    yR += roleLines.length * 4.4;
    doc.setFontSize(10.2);
    doc.setTextColor(...VIOLET);
    doc.text(`${job.time}  ·  ${job.company}`, rightX, yR);
    yR += 4.6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.6);
    doc.setTextColor(...MUTED);
    for (const bullet of job.bullets) {
      const lines = wrap(doc, `•  ${bullet}`, colW);
      doc.text(lines, rightX, yR);
      yR += lines.length * 4.2 + 0.7;
    }
    yR += 2.0;
  }

  // RIGHT — Projects (readable summaries + outcomes) — fill toward footer
  const projectBlurbs: Record<string, string> = {
    compliance:
      "Fleet compliance workspace for driver documents, medical cards, drug tests, and renewal plans with expiry-aware alerts.",
    admin:
      "Isolated HR desk for attendance, directory, expenses, and payroll-adjacent workflows — separated from driver compliance.",
  };
  yR = colTitle(doc, "Selected projects", rightX, yR, colW);
  for (const project of PROJECTS) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.text(project.name, rightX, yR);
    yR += 4.4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(...MUTED);
    const blurb = projectBlurbs[project.id] ?? project.summary;
    const summaryLines = wrap(doc, blurb, colW);
    doc.text(summaryLines, rightX, yR);
    yR += summaryLines.length * 4.2 + 1;
    for (const outcome of project.outcomes) {
      const lines = wrap(doc, `•  ${outcome}`, colW);
      doc.text(lines, rightX, yR);
      yR += lines.length * 4.05 + 0.45;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.6);
    doc.setTextColor(...VIOLET);
    doc.text(project.stack.join(" · "), rightX, yR);
    yR += 3.8;
  }

  // Balance shorter column with contact (never leave a void under one side)
  const paintContact = (x: number, startY: number) => {
    let cy = startY + 1.2;
    if (cy + 20 > maxY) return startY;
    cy = colTitle(doc, "Contact", x, cy, colW);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.6);
    doc.setTextColor(...MUTED);
    for (const line of [
      PROFILE.location,
      `${PROFILE.phone}  ·  ${PROFILE.email}`,
      "Interactive portfolio at /cv.",
      "References available on request.",
    ]) {
      const wrapped = wrap(doc, line, colW);
      if (cy + wrapped.length * 4.4 > maxY) break;
      doc.text(wrapped, x, cy);
      cy += wrapped.length * 4.4 + 1.2;
    }
    return cy;
  };

  if (yL < maxY - 18 && yL <= yR) yL = paintContact(leftX, yL);
  else if (yR < maxY - 18) yR = paintContact(rightX, yR);

  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.25);
  doc.line(margin, footerY - 3, pageW - margin, footerY - 3);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text("Muhammad Yousaf Shahzad — Curriculum Vitae", margin, footerY);
  doc.setTextColor(...VIOLET);
  doc.text("A4 résumé", pageW - margin, footerY, { align: "right" });

  doc.__y = Math.max(yL, yR);
  // Soft overflow protection: if content exceeded page, still return 1 page
  // (layout is designed to fit; callers expect 1–2 pages)
  return doc;
}

export function downloadResumePdf() {
  buildResumePdf().save("Yousaf-Shahzad-CV.pdf");
}
