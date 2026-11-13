import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type {
  DispatchAccessorial,
  DispatchLoad,
  ShiftHandover,
} from "./types";
import { statusLabel } from "./status";
import { accessorialKindLabel, paymentStatusLabel, type LoadHistoryEvent } from "./closeout";

export function loadsToCsv(loads: DispatchLoad[]): string {
  const headers = [
    "load_number",
    "status",
    "payment_status",
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
    "closeout_note",
    "closed_at",
    "reopen_reason",
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
      l.payment_status,
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
      l.closeout_note,
      l.closed_at,
      l.reopen_reason,
      l.updated_at,
    ]
      .map(escape)
      .join(","),
  );
  return [headers.join(","), ...rows].join("\n");
}

export function accessorialsToCsv(items: DispatchAccessorial[]): string {
  const headers = [
    "load_id",
    "kind",
    "status",
    "description",
    "amount_manual",
    "hours_manual",
    "free_time_note",
    "currency",
    "updated_at",
  ];
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const rows = items.map((a) =>
    [
      a.load_id,
      a.kind,
      a.status,
      a.description,
      a.amount_manual,
      a.hours_manual,
      a.free_time_note,
      a.currency,
      a.updated_at,
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

export function exportAccessorialsCsv(items: DispatchAccessorial[]) {
  downloadText(
    `dispatch-accessorials-${new Date().toISOString().slice(0, 10)}.csv`,
    accessorialsToCsv(items),
    "text/csv",
  );
}

export function exportLoadsPdf(loads: DispatchLoad[], title = "Dispatch Operations — Load Report") {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text(title, 14, 16);
  doc.setFontSize(9);
  doc.text(
    `Generated ${new Date().toLocaleString()} · Manual ops tracker · Delivered ≠ Closed ≠ Paid · not Live GPS`,
    14,
    22,
  );
  autoTable(doc, {
    startY: 28,
    head: [["Load", "Status", "Payment", "Customer", "Driver", "BOL", "POD", "Manual location", "Updated"]],
    body: loads.map((l) => [
      l.load_number,
      statusLabel(l.status),
      paymentStatusLabel(l.payment_status),
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

export function exportAccessorialsPdf(items: DispatchAccessorial[], loads: DispatchLoad[]) {
  const byId = new Map(loads.map((l) => [l.id, l.load_number]));
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text("Dispatch Operations — Detention & Accessorials", 14, 16);
  doc.setFontSize(9);
  doc.text(
    `Generated ${new Date().toLocaleString()} · Manual amounts only — no invented rates/free-time · no HR payroll bleed`,
    14,
    22,
  );
  autoTable(doc, {
    startY: 28,
    head: [["Load", "Kind", "Status", "Description", "Amount (manual)", "Hours (manual)", "Free-time note"]],
    body: items.map((a) => [
      byId.get(a.load_id) ?? a.load_id.slice(0, 8),
      accessorialKindLabel(a.kind),
      a.status,
      a.description,
      a.amount_manual == null ? "Needs Policy / blank" : `${a.currency} ${a.amount_manual}`,
      a.hours_manual == null ? "" : String(a.hours_manual),
      a.free_time_note ?? "",
    ]),
    styles: { fontSize: 8 },
  });
  doc.save(`dispatch-accessorials-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportLoadHistoryPdf(load: DispatchLoad, events: LoadHistoryEvent[]) {
  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text(`Complete Load History — ${load.load_number}`, 14, 16);
  doc.setFontSize(9);
  doc.text(
    `Status: ${statusLabel(load.status)} · Payment: ${paymentStatusLabel(load.payment_status)} · Delivered ≠ Closed ≠ Paid`,
    14,
    22,
  );
  doc.text(`Generated ${new Date().toLocaleString()} · Desk records only`, 14, 28);
  autoTable(doc, {
    startY: 34,
    head: [["When", "Source", "Event", "Detail"]],
    body: events.map((e) => [
      new Date(e.at).toLocaleString(),
      e.source,
      e.title,
      e.detail,
    ]),
    styles: { fontSize: 8 },
    columnStyles: { 3: { cellWidth: 70 } },
  });
  doc.save(`dispatch-history-${load.load_number}-${new Date().toISOString().slice(0, 10)}.pdf`);
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
    head: [["Open load", "Status", "Payment", "Driver", "Manual location"]],
    body: openLoads.map((l) => [
      l.load_number,
      statusLabel(l.status),
      paymentStatusLabel(l.payment_status),
      l.assigned_driver_name ?? "",
      l.last_manual_location ?? "",
    ]),
    styles: { fontSize: 8 },
  });
  doc.save(`dispatch-handover-${handover.shift_date}.pdf`);
}
