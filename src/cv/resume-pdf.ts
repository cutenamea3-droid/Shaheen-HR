/**
 * Separate A4 résumé builder (ATS-friendly) — not a web screenshot.
 * Body ~11–11.5pt · Headings 12–13pt · Name 24–28pt · Margins 15–18mm
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

function ensureSpace(d: Doc, need: number, margin: number, pageH: number) {
  if (d.__y + need <= pageH - margin - 8) return;
  d.addPage();
  d.__y = margin;
}

function sectionTitle(d: Doc, title: string, margin: number, pageW: number, pageH: number) {
  ensureSpace(d, 10, margin, pageH);
  d.__y += 1.5;
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
  d.__y += 5;
}

/** Compact skill row: colored accent dots + readable labels */
function drawSkillGroup(d: Doc, group: (typeof SKILL_GROUPS)[number], margin: number, contentW: number, pageH: number) {
  ensureSpace(d, 10, margin, pageH);
  d.setFont("helvetica", "bold");
  d.setFontSize(10.8);
  d.setTextColor(...VIOLET);
  d.text(group.label, margin, d.__y);
  d.__y += 4.8;

  let x = margin;
  const maxX = margin + contentW;
  d.setFont("helvetica", "normal");
  d.setFontSize(10.6);
  for (let i = 0; i < group.items.length; i++) {
    const item = group.items[i]!;
    const rgb = TONE_RGB[item.tone];
    const label = item.label;
    const labelW = d.getTextWidth(label);
    const chipW = 3.4 + labelW + (i < group.items.length - 1 ? 4.2 : 0);
    if (x + chipW > maxX) {
      x = margin;
      d.__y += 5.2;
      ensureSpace(d, 6, margin, pageH);
    }
    d.setFillColor(rgb[0], rgb[1], rgb[2]);
    d.circle(x + 1.2, d.__y - 1.1, 1.05, "F");
    d.setTextColor(...INK);
    d.text(label, x + 3.4, d.__y);
    x += chipW;
  }
  d.__y += 4.6;
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
  doc.__y += 7.2;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.2);
  doc.setTextColor(...VIOLET);
  doc.text(`${PROFILE.role}  |  ${PROFILE.company}`, margin, doc.__y);
  doc.__y += 5.2;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.8);
  doc.setTextColor(...MUTED);
  doc.text(`${PROFILE.location}  ·  ${PROFILE.phone}  ·  ${PROFILE.email}`, margin, doc.__y);
  doc.__y += 4.2;
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.65);
  doc.line(margin, doc.__y, pageW - margin, doc.__y);
  doc.__y += 5.5;

  sectionTitle(doc, "Professional summary", margin, pageW, pageH);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...MUTED);
  const summary = wrap(doc, PROFILE.summary, contentW);
  ensureSpace(doc, summary.length * 4.5 + 2, margin, pageH);
  doc.text(summary, margin, doc.__y);
  doc.__y += summary.length * 4.5 + 2.5;

  if (METRICS_PUBLIC) {
    for (const m of METRICS) {
      const line = wrap(doc, `•  ${m.value} — ${m.caption}`, contentW);
      ensureSpace(doc, line.length * 4.4 + 1, margin, pageH);
      doc.text(line, margin, doc.__y);
      doc.__y += line.length * 4.4 + 1;
    }
    doc.__y += 2;
  }

  sectionTitle(doc, "Core skills", margin, pageW, pageH);
  for (const group of SKILL_GROUPS) {
    drawSkillGroup(doc, group, margin, contentW, pageH);
  }

  sectionTitle(doc, "Experience", margin, pageW, pageH);
  for (const job of EXPERIENCE) {
    const roleLines = wrap(doc, job.role, contentW - 46);
    const body = wrap(doc, job.text, contentW);
    ensureSpace(doc, roleLines.length * 3.8 + 3.4 + body.length * 4 + 2.4, margin, pageH);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.8);
    doc.setTextColor(...INK);
    doc.text(roleLines, margin, doc.__y);
    doc.setFontSize(10.5);
    doc.setTextColor(...VIOLET);
    doc.text(job.time, pageW - margin, doc.__y, { align: "right" });
    doc.__y += roleLines.length * 3.8;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.4);
    doc.setTextColor(...MUTED);
    doc.text(job.company, margin, doc.__y);
    doc.__y += 3.4;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.6);
    doc.text(body, margin, doc.__y);
    doc.__y += body.length * 4 + 2.4;
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
    ensureSpace(doc, 4.2 + body.length * 4.2 + 3.2, margin, pageH);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.2);
    doc.setTextColor(...INK);
    doc.text(project.name, margin, doc.__y);
    doc.__y += 4.2;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.6);
    doc.setTextColor(...MUTED);
    doc.text(body, margin, doc.__y);
    doc.__y += body.length * 4.2 + 3.2;
  }

  // Fill page-1 leftover so the bottom is not empty
  {
    const bandTop = doc.__y + 6;
    const bandBottom = pageH - margin - 14;
    const bandH = bandBottom - bandTop;
    if (bandH >= 16) {
      doc.setFillColor(247, 244, 238);
      doc.roundedRect(margin, bandTop, contentW, bandH, 2.5, 2.5, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(...VIOLET);
      doc.text("Education, languages & interests continue on page 2.", margin + 5, bandTop + Math.min(10, bandH / 2 + 1));
    }
  }

  // Page 2 — Education | Languages (balanced columns), Interests, Contact, fill
  doc.addPage();
  doc.__y = margin + 6;

  {
    const colGap = 12;
    const colW = (contentW - colGap) / 2;
    const leftX = margin;
    const rightX = margin + colW + colGap;
    const topY = doc.__y;

    doc.setTextColor(...INK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12.5);
    doc.text("EDUCATION", leftX, topY);
    doc.setDrawColor(...VIOLET);
    doc.setLineWidth(0.55);
    doc.line(leftX, topY + 2.2, leftX + 16, topY + 2.2);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.25);
    doc.line(leftX + 18, topY + 2.2, leftX + colW, topY + 2.2);

    let yL = topY + 10;
    for (const ed of EDUCATION) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11.5);
      doc.setTextColor(...INK);
      const titleLines = wrap(doc, ed.title, colW);
      doc.text(titleLines, leftX, yL);
      yL += titleLines.length * 5 + 1.5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.8);
      doc.setTextColor(...MUTED);
      doc.text(ed.place, leftX, yL);
      yL += 5;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.6);
      doc.setTextColor(...VIOLET);
      doc.text(ed.note, leftX, yL);
      yL += 12;
    }

    doc.setTextColor(...INK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12.5);
    doc.text("LANGUAGES", rightX, topY);
    doc.setDrawColor(...VIOLET);
    doc.setLineWidth(0.55);
    doc.line(rightX, topY + 2.2, rightX + 16, topY + 2.2);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.25);
    doc.line(rightX + 18, topY + 2.2, rightX + colW, topY + 2.2);

    let yR = topY + 10;
    for (const lang of LANGUAGES) {
      // Tight inline — never justify-between across the column
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11.5);
      doc.setTextColor(...INK);
      doc.text(`${lang.name} · ${lang.level}`, rightX, yR);
      yR += 11;
    }

    doc.__y = Math.max(yL, yR) + 6;
  }

  sectionTitle(doc, "Interests", margin, pageW, pageH);
  for (const interest of INTERESTS) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...INK);
    doc.text(interest.title, margin, doc.__y);
    doc.__y += 7;
    const body = wrap(doc, interest.text, contentW);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11.5);
    doc.setTextColor(...MUTED);
    doc.text(body, margin, doc.__y);
    doc.__y += body.length * 5.4 + 12;
  }

  sectionTitle(doc, "Contact & notes", margin, pageW, pageH);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11.5);
  doc.setTextColor(...MUTED);
  const contactLines = [
    `${PROFILE.location}  ·  ${PROFILE.phone}  ·  ${PROFILE.email}`,
    "A4 résumé for applications — interactive portfolio at /cv (separate surface).",
    "References and verified metrics available on request after owner confirmation.",
  ];
  for (const line of contactLines) {
    const wrapped = wrap(doc, line, contentW);
    doc.text(wrapped, margin, doc.__y);
    doc.__y += wrapped.length * 5.6 + 5.5;
  }

  const bandTop = doc.__y + 8;
  const bandBottom = pageH - margin - 14;
  const bandH = Math.max(32, bandBottom - bandTop);
  doc.setFillColor(247, 244, 238);
  doc.roundedRect(margin, bandTop, contentW, bandH, 3, 3, "F");
  const midY = bandTop + Math.min(18, bandH / 2);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...VIOLET);
  doc.text("Open to HR operations, compliance tooling, and sales-adjacent roles.", margin + 6, midY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.8);
  doc.setTextColor(...MUTED);
  doc.text("Portfolio · PDF · facts only from confirmed CV content.", margin + 6, midY + 7.5);

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
