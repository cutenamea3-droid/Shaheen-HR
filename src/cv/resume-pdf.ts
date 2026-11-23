/**
 * Separate A4 résumé — two-column, body 11.5–12.5pt, fills to ~0.5" of footer.
 * No empty cream bands. Metrics excluded while METRICS_PUBLIC is false.
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
  d.line(x, y + 1.8, x + 14, y + 1.8);
  d.setDrawColor(...LINE);
  d.setLineWidth(0.22);
  d.line(x + 16, y + 1.8, x + colW, y + 1.8);
  return y + 6.8;
}

export function buildResumePdf(): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" }) as Doc;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 11;
  const contentW = pageW - margin * 2;
  const gutter = 5.5;
  const colW = (contentW - gutter) / 2;
  const leftX = margin;
  const rightX = margin + colW + gutter;
  const footerY = pageH - 8;
  const maxY = footerY - 11; // ~0.43"

  let y = margin;
  doc.setTextColor(...INK);
  doc.setFont("times", "bold");
  doc.setFontSize(22);
  doc.text(PROFILE.fullName, margin, y);
  y += 5.8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5);
  doc.setTextColor(...VIOLET);
  doc.text(`${PROFILE.role}  ·  ${PROFILE.company}`, margin, y);
  y += 4.6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...MUTED);
  doc.text(`${PROFILE.location}  ·  ${PROFILE.phone}  ·  ${PROFILE.email}`, margin, y);
  y += 3.6;
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageW - margin, y);
  y += 4.6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...INK);
  doc.text("PROFILE", margin, y);
  y += 1.8;
  doc.setDrawColor(...VIOLET);
  doc.setLineWidth(0.5);
  doc.line(margin, y, margin + 14, y);
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.22);
  doc.line(margin + 16, y, pageW - margin, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11.8);
  doc.setTextColor(...MUTED);
  const summary = wrap(doc, PROFILE.summary, contentW);
  doc.text(summary, margin, y);
  y += summary.length * 4.9 + 2.4;

  if (METRICS_PUBLIC) {
    for (const m of METRICS) {
      doc.text(`•  ${m.value} — ${m.caption}`, margin, y);
      y += 4.6;
    }
  }

  let yL = y;
  let yR = y;

  // LEFT Skills — flowing chips at 11.5pt
  yL = colTitle(doc, "Skills", leftX, yL, colW);
  for (const group of SKILL_GROUPS) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.8);
    doc.setTextColor(...VIOLET);
    doc.text(group.label.toUpperCase(), leftX, yL);
    yL += 4.8;
    let cx = leftX;
    const rowH = 5.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11.5);
    for (let i = 0; i < group.items.length; i++) {
      const item = group.items[i]!;
      const rgb = TONE_RGB[item.tone];
      const w = doc.getTextWidth(item.label) + 4.6 + (i < group.items.length - 1 ? 3 : 0);
      if (cx + w > leftX + colW && cx > leftX) {
        cx = leftX;
        yL += rowH;
      }
      doc.setFillColor(rgb[0], rgb[1], rgb[2]);
      doc.circle(cx + 1.2, yL - 1.15, 1.1, "F");
      doc.setTextColor(...INK);
      doc.text(item.label, cx + 3.5, yL);
      cx += w;
    }
    yL += rowH + 1.8;
  }

  // LEFT Education
  yL = colTitle(doc, "Education", leftX, yL, colW);
  for (const ed of EDUCATION) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.setTextColor(...INK);
    const titles = wrap(doc, ed.title, colW);
    doc.text(titles, leftX, yL);
    yL += titles.length * 4.5 + 0.4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(...VIOLET);
    doc.text(`${ed.place}  ·  ${ed.note}`, leftX, yL);
    yL += 4.3;
    doc.setTextColor(...MUTED);
    doc.setFontSize(11.2);
    const detail = wrap(doc, ed.detail, colW);
    doc.text(detail, leftX, yL);
    yL += detail.length * 4.5 + 2.6;
  }

  // LEFT Languages
  yL = colTitle(doc, "Languages", leftX, yL, colW);
  for (const lang of LANGUAGES) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.setTextColor(...INK);
    doc.text(`${lang.name} · ${lang.level}`, leftX, yL);
    yL += 5.4;
  }

  // LEFT Interests — both entries, compact blurbs
  yL += 0.6;
  yL = colTitle(doc, "Interests", leftX, yL, colW);
  for (const [title, text] of [
    ["Video editing & content", "Anime edits with beat syncing in CapCut and VN Editor."],
    ["Tech exploration", "Web apps and AI tools: Lovable, Vercel, GitHub, Termux, Gemini CLI."],
  ] as const) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.setTextColor(...INK);
    doc.text(title, leftX, yL);
    yL += 4.2;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11.2);
    doc.setTextColor(...MUTED);
    const body = wrap(doc, text, colW);
    doc.text(body, leftX, yL);
    yL += body.length * 4.4 + 1.8;
  }

  // RIGHT Experience — 11.5–12pt bullets
  yR = colTitle(doc, "Experience", rightX, yR, colW);
  for (const job of EXPERIENCE) {
    if (yR + 16 > maxY - 40) break; // reserve projects
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.setTextColor(...INK);
    const roles = wrap(doc, job.role, colW);
    doc.text(roles, rightX, yR);
    yR += roles.length * 4.5;
    doc.setFontSize(10.8);
    doc.setTextColor(...VIOLET);
    doc.text(`${job.time}  ·  ${job.company}`, rightX, yR);
    yR += 4.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11.5);
    doc.setTextColor(...MUTED);
    for (const bullet of job.bullets) {
      const lines = wrap(doc, `•  ${bullet}`, colW);
      if (yR + lines.length * 4.6 > maxY - 38) break;
      doc.text(lines, rightX, yR);
      yR += lines.length * 4.6 + 0.55;
    }
    yR += 2.2;
  }

  // RIGHT Projects
  const blurbs: Record<string, string> = {
    compliance:
      "Fleet compliance workspace for driver documents, medical cards, drug tests, and renewal plans with expiry-aware alerts.",
    admin:
      "Isolated HR desk for attendance, directory, expenses, and payroll-adjacent workflows — separated from driver compliance.",
  };
  yR = colTitle(doc, "Selected projects", rightX, yR, colW);
  for (const project of PROJECTS) {
    if (yR + 18 > maxY) break;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.8);
    doc.setTextColor(...INK);
    doc.text(project.name, rightX, yR);
    yR += 4.6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11.5);
    doc.setTextColor(...MUTED);
    const body = wrap(doc, blurbs[project.id] ?? project.summary, colW);
    doc.text(body, rightX, yR);
    yR += body.length * 4.6 + 1;
    for (const outcome of project.outcomes) {
      const lines = wrap(doc, `•  ${outcome}`, colW);
      if (yR + lines.length * 4.5 > maxY - 5) break;
      doc.text(lines, rightX, yR);
      yR += lines.length * 4.5 + 0.5;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...VIOLET);
    if (yR + 4 <= maxY) {
      doc.text(project.stack.join(" · "), rightX, yR);
      yR += 4.8;
    }
  }

  // Fill shorter column with contact until ~maxY
  const fillContact = (x: number, start: number) => {
    let cy = start + 1;
    if (cy + 14 > maxY) return start;
    cy = colTitle(doc, "Contact", x, cy, colW);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11.2);
    doc.setTextColor(...MUTED);
    for (const line of [
      `${PROFILE.location}  ·  ${PROFILE.phone}`,
      PROFILE.email,
      "Interactive portfolio at /cv (separate surface).",
      "References available on request after owner confirmation.",
      "Open to HR operations, compliance tooling, and sales-adjacent roles.",
    ]) {
      const w = wrap(doc, line, colW);
      if (cy + w.length * 4.6 > maxY) break;
      doc.text(w, x, cy);
      cy += w.length * 4.6 + 1.2;
    }
    return cy;
  };

  // Prefer filling the shorter column first so heights stay balanced
  if (yL <= yR) {
    yL = fillContact(leftX, yL);
    if (yR < maxY - 14) yR = fillContact(rightX, yR);
  } else {
    yR = fillContact(rightX, yR);
    if (yL < maxY - 14) yL = fillContact(leftX, yL);
  }

  const fillNotes = (x: number, start: number) => {
    let cy = start + 0.8;
    if (cy + 12 > maxY) return start;
    cy = colTitle(doc, "Notes", x, cy, colW);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(...MUTED);
    for (const line of [
      "A4 résumé for applications — facts only from confirmed CV content.",
      "Verified metrics remain gated until owner confirmation.",
    ]) {
      const w = wrap(doc, line, colW);
      if (cy + w.length * 4.5 > maxY) break;
      doc.text(w, x, cy);
      cy += w.length * 4.5 + 1.1;
    }
    return cy;
  };
  // Pad whichever column is still short
  if (yL < yR - 8 && yL < maxY - 14) yL = fillNotes(leftX, yL);
  if (yR < yL - 8 && yR < maxY - 14) yR = fillNotes(rightX, yR);
  if (yL < maxY - 14) yL = fillNotes(leftX, yL);
  if (yR < maxY - 14) yR = fillNotes(rightX, yR);

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
  return doc;
}

export function downloadResumePdf() {
  buildResumePdf().save("Yousaf-Shahzad-CV.pdf");
}
