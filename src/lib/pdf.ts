import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { fmtDate, today } from "./alerts";

export function downloadReportPdf(
  title: unknown,
  subtitle: unknown,
  head: unknown,
  body: unknown,
) {
  const safeTitle = title == null ? "Report" : typeof title === "string" ? title : String(title);
  const safeSubtitle =
    subtitle == null ? "" : typeof subtitle === "string" ? subtitle : String(subtitle);
  const safeHead = Array.isArray(head)
    ? head.map((h) => (h == null ? "" : typeof h === "string" ? h : String(h)))
    : [];
  const safeBody = Array.isArray(body)
    ? body.map((row) =>
        Array.isArray(row)
          ? row.map((c) => (c == null ? "" : typeof c === "string" ? c : String(c)))
          : [],
      )
    : [];
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(217, 113, 31);
  doc.rect(0, 0, w, 64, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Shaheen Transport LLC — " + safeTitle, 32, 32);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`${safeSubtitle} · Generated ${fmtDate(today())}`, 32, 50);
  autoTable(doc, {
    startY: 80,
    head: [safeHead],
    body: safeBody.length
      ? safeBody
      : [safeHead.map((_, i) => (i === 0 ? "No records" : ""))],
    styles: { fontSize: 10.5, cellPadding: 6, overflow: "linebreak", valign: "top" },
    headStyles: { fillColor: [52, 40, 30], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [253, 246, 236] },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 170 } },
    margin: { left: 32, right: 32 },
  });
  doc.save(
    `${safeTitle.replace(/[^a-z0-9]+/gi, "-")}-${safeSubtitle.replace(/[^a-z0-9]+/gi, "-")}.pdf`,
  );
}
