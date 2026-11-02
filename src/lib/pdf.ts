import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { fmtDate, today } from "./alerts";

export function downloadReportPdf(title: string, subtitle: string, head: string[], body: string[][]) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(217, 113, 31);
  doc.rect(0, 0, w, 64, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Shaheen Transport LLC — " + title, 32, 32);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`${subtitle} · Generated ${fmtDate(today())}`, 32, 50);
  autoTable(doc, {
    startY: 80,
    head: [head],
    body: body.length ? body : [head.map((_, i) => (i === 0 ? "No records" : ""))],
    styles: { fontSize: 10.5, cellPadding: 6, overflow: "linebreak", valign: "top" },
    headStyles: { fillColor: [52, 40, 30], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [253, 246, 236] },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 170 } },
    margin: { left: 32, right: 32 },
  });
  doc.save(`${title.replace(/[^a-z0-9]+/gi, "-")}-${subtitle.replace(/[^a-z0-9]+/gi, "-")}.pdf`);
}
