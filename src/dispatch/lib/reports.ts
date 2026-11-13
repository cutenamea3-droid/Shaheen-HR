import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { DispatchLoad, ShiftHandover } from "./types";
import { statusLabel } from "./status";

export function loadsToCsv(loads: DispatchLoad[]): string {
  const headers = [
    "load_number",
    "status",
    "customer",
    "driver",
    "bol_status",
    "pod_status",
    "exception_open",
    "planned_pickup_at",
    "actual_pickup_at",
    "planned_delivery_at",
    "actual_delivery_at",
    "manual_location",
    "manual_location_at",
    "updated_at",
  ];
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const rows = loads.map((l) =>
    [
      l.load_number,
      l.status,
      l.customer_name,
      l.assigned_driver_name,
      l.bol_status,
      l.pod_status,
      l.exception_open,
      l.planned_pickup_at,
      l.actual_pickup_at,
      l.planned_delivery_at,
      l.actual_delivery_at,
      l.last_manual_location,
      l.last_manual_location_at,
      l.updated_at,
    ]
      .map(escape)
      .join(","),
  );
  return [headers.join(","), ...rows].join("\n");
}

export function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportLoadsCsv(loads: DispatchLoad[]) {
  downloadText(`dispatch-loads-${new Date().toISOString().slice(0, 10)}.csv`, loadsToCsv(loads), "text/csv");
}

export function exportLoadsPdf(loads: DispatchLoad[], title = "Dispatch Operations — Load Report") {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text(title, 14, 16);
  doc.setFontSize(9);
  doc.text(`Generated ${new Date().toLocaleString()} · Manual ops tracker (not Live GPS)`, 14, 22);
  autoTable(doc, {
    startY: 28,
    head: [["Load", "Status", "Customer", "Driver", "BOL", "POD", "Manual location", "Updated"]],
    body: loads.map((l) => [
      l.load_number,
      statusLabel(l.status),
      l.customer_name ?? "",
      l.assigned_driver_name ?? "",
      l.bol_status,
      l.pod_status,
      l.last_manual_location ?? "",
      new Date(l.updated_at).toLocaleString(),
    ]),
    styles: { fontSize: 8 },
  });
  doc.save(`dispatch-loads-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportHandoverPdf(handover: ShiftHandover, loads: DispatchLoad[]) {
  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text("Shift Handover — Dispatch Operations", 14, 16);
  doc.setFontSize(10);
  doc.text(`Shift date: ${handover.shift_date}`, 14, 26);
  doc.text(`From: ${handover.from_dispatcher}`, 14, 32);
  doc.text(`To: ${handover.to_dispatcher || "—"}`, 14, 38);
  doc.text("Summary", 14, 48);
  doc.setFontSize(9);
  const summaryLines = doc.splitTextToSize(handover.summary || "—", 180);
  doc.text(summaryLines, 14, 54);
  let y = 54 + summaryLines.length * 5 + 8;
  doc.setFontSize(10);
  doc.text("Watch items", 14, y);
  y += 6;
  doc.setFontSize(9);
  const watch = doc.splitTextToSize(handover.watch_items || "—", 180);
  doc.text(watch, 14, y);
  y += watch.length * 5 + 8;
  doc.setFontSize(10);
  doc.text("Next-day priorities", 14, y);
  y += 6;
  doc.setFontSize(9);
  const next = doc.splitTextToSize(handover.next_day_priorities || "—", 180);
  doc.text(next, 14, y);
  y += next.length * 5 + 10;
  const openLoads = loads.filter((l) => handover.open_load_ids.includes(l.id));
  autoTable(doc, {
    startY: y,
    head: [["Open load", "Status", "Driver", "Manual location"]],
    body: openLoads.map((l) => [
      l.load_number,
      statusLabel(l.status),
      l.assigned_driver_name ?? "",
      l.last_manual_location ?? "",
    ]),
    styles: { fontSize: 8 },
  });
  doc.save(`dispatch-handover-${handover.shift_date}.pdf`);
}
