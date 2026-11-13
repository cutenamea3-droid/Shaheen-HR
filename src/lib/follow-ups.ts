/**
 * Compliance Follow-Up Tracker — durable via tracker_sections id `compliance_follow_ups`
 * (same cloud path as Records). Never localStorage as source of truth.
 *
 * A typed SQL table migration is review-only for future graduation; until applied,
 * the jsonb section blob is the production-ready durable path.
 */
import {
  daysUntil,
  fmtDate,
  normStatus,
  parseISO,
  rowIsActive,
  rowOrdinaryComplianceMuted,
  today,
  type Tone,
} from "./alerts";
import type { AppData, Row, SectionData } from "./sections";
import { SECTIONS } from "./sections";

export const FOLLOW_UP_SECTION_ID = "compliance_follow_ups";

export const FOLLOW_UP_HEADERS = [
  "Driver",
  "Subject",
  "Status",
  "Due Date",
  "Notes",
  "Source",
  "Section",
  "Doc Type",
] as const;

export type FollowUpStatus = "open" | "done" | "snoozed";
export type FollowUpSource = "manual" | "applied" | "plan" | "alert";

export type FollowUp = {
  id: string;
  driverId: string;
  driver: string;
  subject: string;
  status: FollowUpStatus;
  dueDate: string; // YYYY-MM-DD or ""
  notes: string;
  source: FollowUpSource;
  sectionId: string;
  docType: string;
  /** Linked compliance row when known. */
  linkedRowId: string;
};

export const FOLLOW_UP_STATUS_OPTIONS: FollowUpStatus[] = ["open", "done", "snoozed"];

function emptyFollowUpSection(): SectionData {
  return {
    headers: [...FOLLOW_UP_HEADERS],
    widths: FOLLOW_UP_HEADERS.map(() => 180),
    hidden: FOLLOW_UP_HEADERS.map(() => false),
    rows: [],
  };
}

export function ensureFollowUpSection(data: AppData): AppData {
  const existing = data.sections[FOLLOW_UP_SECTION_ID];
  if (existing) {
    const next = normalizeFollowUpSection(existing);
    if (next === existing) return data;
    return { ...data, sections: { ...data.sections, [FOLLOW_UP_SECTION_ID]: next } };
  }
  return {
    ...data,
    sections: { ...data.sections, [FOLLOW_UP_SECTION_ID]: emptyFollowUpSection() },
  };
}

function normalizeFollowUpSection(sec: SectionData): SectionData {
  let headers = [...(sec.headers ?? [])];
  let widths = [...(sec.widths ?? [])];
  let hidden = [...(sec.hidden ?? [])];
  let touched = false;
  if (headers.length < FOLLOW_UP_HEADERS.length) {
    headers = [...FOLLOW_UP_HEADERS];
    widths = FOLLOW_UP_HEADERS.map(() => 180);
    hidden = FOLLOW_UP_HEADERS.map(() => false);
    touched = true;
  }
  const rows = sec.rows.map((r) => {
    const cells = [...r.cells];
    while (cells.length < FOLLOW_UP_HEADERS.length) {
      cells.push("");
      touched = true;
    }
    return cells === r.cells ? r : { ...r, cells };
  });
  if (!touched) return sec;
  return { ...sec, headers, widths, hidden, rows };
}

function parseStatus(raw: string): FollowUpStatus {
  const k = raw.trim().toLowerCase();
  if (k === "done" || k === "complete" || k === "closed") return "done";
  if (k === "snoozed" || k === "snooze") return "snoozed";
  return "open";
}

function parseSource(raw: string): FollowUpSource {
  const k = raw.trim().toLowerCase();
  if (k === "applied") return "applied";
  if (k === "plan") return "plan";
  if (k === "alert") return "alert";
  return "manual";
}

export function rowToFollowUp(row: Row): FollowUp {
  const cells = row.cells;
  return {
    id: row.id,
    driverId: row.driverId,
    driver: (cells[0] ?? "").trim() || "Unknown",
    subject: (cells[1] ?? "").trim(),
    status: parseStatus(cells[2] ?? ""),
    dueDate: (cells[3] ?? "").trim(),
    notes: (cells[4] ?? "").trim(),
    source: parseSource(cells[5] ?? ""),
    sectionId: (cells[6] ?? "").trim(),
    docType: (cells[7] ?? "").trim(),
    linkedRowId: row.id.startsWith("fu_") ? "" : row.id,
  };
}

export function followUpToCells(fu: Omit<FollowUp, "id"> | FollowUp): string[] {
  return [
    fu.driver,
    fu.subject,
    fu.status,
    fu.dueDate,
    fu.notes,
    fu.source,
    fu.sectionId,
    fu.docType,
  ];
}

export function listFollowUps(data: AppData): FollowUp[] {
  const sec = data.sections[FOLLOW_UP_SECTION_ID];
  if (!sec) return [];
  return sec.rows.map(rowToFollowUp);
}

export function followUpTone(fu: FollowUp): Tone {
  if (fu.status === "done") return "ok";
  const d = parseISO(fu.dueDate);
  if (!d) return fu.status === "snoozed" ? "note" : "info";
  const n = daysUntil(d);
  if (n < 0) return "danger";
  if (n === 0) return "warn";
  if (n <= 7) return "info";
  return "muted";
}

export function followUpDueLabel(fu: FollowUp): string {
  if (!fu.dueDate.trim()) return "No due date";
  const d = parseISO(fu.dueDate);
  if (!d) return fu.dueDate;
  const n = daysUntil(d);
  const base = fmtDate(d);
  if (n < 0) return `${base} · ${-n}d overdue`;
  if (n === 0) return `${base} · today`;
  return `${base} · in ${n}d`;
}

/** Applied-status items that still need a human follow-up (never auto-Valid). */
export type AppliedFollowSuggestion = {
  key: string;
  driverId: string;
  driver: string;
  sectionId: string;
  rowId: string;
  docType: string;
  statusLabel: string;
  expiryDisplay: string;
  subject: string;
};

/**
 * Suggest follow-ups for Applied application statuses that are not already tracked open.
 * Does not invent due dates — caller may leave due blank or set manually.
 */
export function suggestAppliedFollowUps(data: AppData): AppliedFollowSuggestion[] {
  const existing = listFollowUps(data).filter((f) => f.status !== "done");
  const out: AppliedFollowSuggestion[] = [];

  for (const def of SECTIONS) {
    if (!["dmv", "medical", "queries", "ssccdl"].includes(def.id)) continue;
    const sec = data.sections[def.id];
    if (!sec) continue;
    for (const row of sec.rows) {
      if (rowOrdinaryComplianceMuted(def, row, data)) continue;
      if (!rowIsActive(def, row, data)) continue;
      def.types.forEach((t, col) => {
        if (t !== "status") return;
        if (normStatus(row.cells[col] ?? "") !== "Applied") return;

        const docType =
          def.id === "dmv"
            ? "DMV Pull Notice"
            : def.id === "medical"
              ? "Medical Certificate"
              : def.id === "ssccdl"
                ? "CDL"
                : col <= 2
                  ? "Annual Query"
                  : "Pre-Employment Query";

        const already = existing.some(
          (f) =>
            f.driverId === row.driverId &&
            f.sectionId === def.id &&
            f.source === "applied" &&
            (f.docType === docType || f.subject.toLowerCase().includes("applied")),
        );
        if (already) return;

        const dateCol = def.types.findIndex((tt, i) => tt === "date" && Math.abs(i - col) <= 2);
        const expiry = dateCol >= 0 ? row.cells[dateCol] ?? "" : "";
        out.push({
          key: `${def.id}:${row.id}:${col}`,
          driverId: row.driverId,
          driver: row.cells[0] ?? "",
          sectionId: def.id,
          rowId: row.id,
          docType,
          statusLabel: "Applied",
          expiryDisplay: expiry.trim() || "—",
          subject: `Follow up: ${docType} still Applied`,
        });
      });
    }
  }
  return out;
}

export function filterFollowUps(
  items: FollowUp[],
  filter: "all" | "open" | "today" | "overdue" | "done" | "snoozed",
  search: string,
): FollowUp[] {
  const q = search.trim().toLowerCase();
  const t = today();
  return items.filter((fu) => {
    if (filter === "open" && fu.status !== "open") return false;
    if (filter === "done" && fu.status !== "done") return false;
    if (filter === "snoozed" && fu.status !== "snoozed") return false;
    if (filter === "today") {
      const d = parseISO(fu.dueDate);
      if (!d || daysUntil(d) !== 0 || fu.status === "done") return false;
    }
    if (filter === "overdue") {
      const d = parseISO(fu.dueDate);
      if (!d || daysUntil(d) >= 0 || fu.status === "done") return false;
    }
    if (!q) return true;
    return (
      fu.driver.toLowerCase().includes(q) ||
      fu.subject.toLowerCase().includes(q) ||
      fu.docType.toLowerCase().includes(q) ||
      fu.notes.toLowerCase().includes(q)
    );
  }).sort((a, b) => {
    const da = parseISO(a.dueDate)?.getTime() ?? Number.POSITIVE_INFINITY;
    const db = parseISO(b.dueDate)?.getTime() ?? Number.POSITIVE_INFINITY;
    if (da !== db) return da - db;
    return a.driver.localeCompare(b.driver);
  });
}

export function followUpCounts(items: FollowUp[]) {
  const t = today();
  void t;
  let open = 0;
  let todayN = 0;
  let overdue = 0;
  let done = 0;
  let snoozed = 0;
  for (const fu of items) {
    if (fu.status === "done") {
      done++;
      continue;
    }
    if (fu.status === "snoozed") snoozed++;
    if (fu.status === "open") open++;
    const d = parseISO(fu.dueDate);
    if (d) {
      const n = daysUntil(d);
      if (n < 0) overdue++;
      if (n === 0) todayN++;
    }
  }
  return { all: items.length, open, today: todayN, overdue, done, snoozed };
}
