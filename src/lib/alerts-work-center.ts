/**
 * Smart Alerts compliance work-center: driver-by-driver actionable alerts.
 * Composes analyzeRow + plan-dates + temp notes + new-driver roster — no invented writes.
 */
import {
  analyzeRow,
  daysUntil,
  fmtCell,
  fmtDate,
  isOldExpiry,
  normStatus,
  parseISO,
  rowAlertsMuted,
  rowOrdinaryComplianceMuted,
  statusExpiryCol,
  type Issue,
  type Tone,
} from "./alerts";
import {
  buildFuturePlanSuggestion,
  planRulesForSection,
  suggestionMatchesToday,
  type FuturePlanSuggestion,
} from "./plan-dates";
import { SECTIONS, sectionById, type AppData, type Row } from "./sections";
import {
  collectTempNotes,
  isNewDriver,
  type TempNoteSection,
} from "./driver-meta";

export type WorkCenterFilter =
  | "all"
  | "today"
  | "expired"
  | "expiring_soon"
  | "pending_applications"
  | "missing_documents"
  | "temporary_notes"
  | "future_plans"
  | "new_drivers";

export const WORK_CENTER_FILTERS: { id: WorkCenterFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "today", label: "Today" },
  { id: "expired", label: "Expired" },
  { id: "expiring_soon", label: "Expiring Soon" },
  { id: "pending_applications", label: "Pending Applications" },
  { id: "missing_documents", label: "Missing Documents" },
  { id: "temporary_notes", label: "Temporary Notes" },
  { id: "future_plans", label: "Future Plans" },
  { id: "new_drivers", label: "New Drivers" },
];

export type WorkCenterItemKind =
  | "expiry"
  | "status"
  | "missing_doc"
  | "applied"
  | "plan"
  | "tempnote"
  | "new_driver"
  | "note";

export type WorkCenterItem = {
  key: string;
  kind: WorkCenterItemKind;
  filters: WorkCenterFilter[];
  driverId: string;
  driver: string;
  sectionId: string;
  sectionTitle: string;
  rowId: string;
  docType: string;
  statusLabel: string;
  expiryRaw: string;
  expiryDisplay: string;
  daysLeft: number | null;
  daysLabel: string;
  details: string;
  neededAction: string;
  tone: Tone;
  /** Column targets for inline editors (authorized setCell). */
  statusCol: number | null;
  dateCol: number | null;
  planCol: number | null;
  tempnoteCol: number | null;
  existingPlan: string;
  existingTempNote: string;
  planSuggestion: FuturePlanSuggestion | null;
  dmvApplied: boolean;
  isNew: boolean;
  /** When inline edit is unsafe — labeled link only. */
  linkOnly: { label: string; to: "/drivers" | "/s/$sectionId"; reason: string } | null;
};

export type WorkCenterDriverGroup = {
  driverId: string;
  driver: string;
  isNew: boolean;
  items: WorkCenterItem[];
  worstTone: Tone;
};

export type WorkCenterCounts = Record<WorkCenterFilter, number> & { drivers: number };

const TONE_RANK: Tone[] = ["danger", "warn", "sign", "info", "note", "ok", "muted"];

function worseTone(a: Tone, b: Tone): Tone {
  return TONE_RANK.indexOf(a) <= TONE_RANK.indexOf(b) ? a : b;
}

function daysLabel(daysLeft: number | null, d: Date | null): string {
  if (daysLeft == null || !d) return "—";
  if (daysLeft < 0) return `${-daysLeft}d overdue · ${fmtDate(d)}`;
  if (daysLeft === 0) return `Today · ${fmtDate(d)}`;
  return `${daysLeft}d left · ${fmtDate(d)}`;
}

function issueFilters(issue: Issue, sectionId: string): WorkCenterFilter[] {
  const f: WorkCenterFilter[] = [];
  const lab = issue.label.toLowerCase();
  if (/expired/i.test(issue.label) && issue.tone === "danger") f.push("expired");
  if (issue.tone === "warn" || (/expires in/i.test(issue.label) && issue.tone !== "danger")) f.push("expiring_soon");
  if (/applied/i.test(issue.label)) f.push("pending_applications");
  if (sectionId === "docs" || /missing|invalid|empty|sign missing/i.test(lab)) {
    if (!/applied/i.test(lab) && !/expired \d/i.test(lab) && !/expires in/i.test(lab)) {
      f.push("missing_documents");
    }
  }
  if (/future plan/i.test(issue.label)) f.push("future_plans");
  return f.length ? f : ["all"];
}

function neededActionFor(issue: Issue, sectionId: string, suggestion: FuturePlanSuggestion | null): string {
  const lab = issue.label.toLowerCase();
  if (/applied/i.test(lab)) return "Check application status — do not mark Valid until renewed";
  if (/future plan/i.test(lab)) {
    if (suggestion?.available) return `Act by ${suggestion.reminderLabel ?? suggestion.text}`;
    if (suggestion?.suppressReapply) return suggestion.text;
    return "Set or update Future Plan";
  }
  if (sectionId === "docs" || /missing|invalid|empty/i.test(lab)) return "Obtain / correct document status";
  if (/expired/i.test(lab)) return "Renew expired document and update expiry date";
  if (/expires/i.test(lab)) return "Renew before expiry; update status and date when complete";
  if (/sign/i.test(lab)) return "Collect missing signature";
  return "Review and update this field";
}

function pushUnique(list: WorkCenterItem[], item: WorkCenterItem) {
  if (list.some((x) => x.key === item.key)) return;
  list.push(item);
}

/**
 * Collect every actionable work-center item. Leave/inactive muted for ordinary
 * compliance; New Drivers appear under new_drivers (and their own onboarding item).
 * Temp notes never "resolve" expiry — they are a separate attention filter.
 */
export function collectWorkCenterItems(data: AppData): WorkCenterItem[] {
  const out: WorkCenterItem[] = [];
  const seenNew = new Set<string>();

  for (const def of SECTIONS) {
    if (def.id === "inactive") continue;
    const sec = data.sections[def.id];
    if (!sec) continue;

    for (const row of sec.rows) {
      const driver = (row.cells[0] ?? "").trim() || "—";
      const driverId = row.driverId;
      const isNew = isNewDriver(data, driverId);
      const mutedOrdinary = rowOrdinaryComplianceMuted(def, row, data);
      const leaveMute = rowAlertsMuted(def, row, data);

      // New-driver onboarding attention (once per driver)
      if (isNew && !seenNew.has(driverId) && !leaveMute) {
        seenNew.add(driverId);
        out.push({
          key: `new-${driverId}`,
          kind: "new_driver",
          filters: ["new_drivers", "all"],
          driverId,
          driver,
          sectionId: "dmv",
          sectionTitle: "Onboarding",
          rowId: row.id,
          docType: "New Driver",
          statusLabel: "Onboarding",
          expiryRaw: "",
          expiryDisplay: "—",
          daysLeft: null,
          daysLabel: "—",
          details: "Driver is on the New Drivers list until moved to Active Drivers.",
          neededAction: "Complete onboarding docs, then Move to Active Drivers",
          tone: "info",
          statusCol: null,
          dateCol: null,
          planCol: null,
          tempnoteCol: null,
          existingPlan: "",
          existingTempNote: "",
          planSuggestion: null,
          dmvApplied: false,
          isNew: true,
          linkOnly: {
            label: "Open Full Driver Record",
            to: "/drivers",
            reason: "Onboarding class change uses Driver Cards management controls",
          },
        });
      }

      // Temporary notes (preserve no-due notes — never invent a due date)
      if (def.types.includes("tempnote") && !leaveMute) {
        const tidx = def.types.indexOf("tempnote");
        const text = (row.cells[tidx] ?? "").trim();
        if (text) {
          pushUnique(out, {
            key: `temp-${def.id}-${row.id}`,
            kind: "tempnote",
            filters: ["temporary_notes", "all"],
            driverId,
            driver,
            sectionId: def.id,
            sectionTitle: def.title,
            rowId: row.id,
            docType: "Temporary Note",
            statusLabel: "Note",
            expiryRaw: "",
            expiryDisplay: "No due date",
            daysLeft: null,
            daysLabel: "No due date",
            details: text,
            neededAction: "Review temporary note — clear only when genuinely resolved",
            tone: "note",
            statusCol: null,
            dateCol: null,
            planCol: null,
            tempnoteCol: tidx,
            existingPlan: "",
            existingTempNote: text,
            planSuggestion: null,
            dmvApplied: false,
            isNew,
            linkOnly: null,
          });
        }
      }

      // Future plan suggestions for every supported plan field (even if no analyzeRow issue yet)
      for (const rule of planRulesForSection(def.id)) {
        if (leaveMute) continue;
        // New/OO muted from ordinary lists but still show plans when filtering future_plans / new
        if (mutedOrdinary && !isNew) continue;
        const suggestion = buildFuturePlanSuggestion(rule, row);
        const existingPlan = (row.cells[rule.planCol] ?? "").trim();
        const statusRaw = rule.statusCol != null ? (row.cells[rule.statusCol] ?? "") : "";
        const expiryRaw = row.cells[rule.expiryCol] ?? "";
        const expiryD = parseISO(expiryRaw);
        const left = expiryD && !isOldExpiry(expiryRaw) ? daysUntil(expiryD) : null;
        const filters: WorkCenterFilter[] = ["future_plans", "all"];
        if (suggestionMatchesToday(suggestion)) filters.push("today");
        if (suggestion.overdue) filters.push("today");
        // Only surface as a card when there's something to do: suggestion available,
        // existing plan, overdue reminder, or Applied suppress message with near expiry
        const surface =
          suggestion.available ||
          !!existingPlan ||
          suggestion.suppressReapply ||
          (left != null && left <= (suggestion.leadDays ?? 30));
        if (!surface) continue;

        const dmvApplied = def.id === "dmv" && normStatus(statusRaw) === "Applied";
        pushUnique(out, {
          key: `plan-${def.id}-${row.id}-${rule.planCol}`,
          kind: "plan",
          filters: isNew ? [...filters, "new_drivers"] : filters,
          driverId,
          driver,
          sectionId: def.id,
          sectionTitle: def.title,
          rowId: row.id,
          docType: rule.docLabel,
          statusLabel: normStatus(statusRaw) || "—",
          expiryRaw,
          expiryDisplay: expiryD ? fmtDate(expiryD) : fmtCell(expiryRaw) || "—",
          daysLeft: left,
          daysLabel: daysLabel(left, expiryD),
          details: existingPlan
            ? `Saved plan: ${existingPlan}`
            : suggestion.available
              ? `Suggested: ${suggestion.text}`
              : suggestion.text,
          neededAction: suggestion.suppressReapply
            ? suggestion.text
            : suggestion.available
              ? `Reminder ${suggestion.reminderLabel ?? ""} · lead ${suggestion.leadDays}d before expiry`
              : "Verify document date before planning",
          tone: suggestion.overdue ? "danger" : suggestion.available && (left ?? 99) <= (suggestion.leadDays ?? 30) ? "warn" : "info",
          statusCol: rule.statusCol,
          dateCol: rule.expiryCol,
          planCol: rule.planCol,
          tempnoteCol: def.types.indexOf("tempnote") >= 0 ? def.types.indexOf("tempnote") : null,
          existingPlan,
          existingTempNote: "",
          planSuggestion: suggestion,
          dmvApplied,
          isNew,
          linkOnly: null,
        });
      }

      if (mutedOrdinary) continue;
      if (def.id === "info") continue;

      const { issues } = analyzeRow(def, sec.headers, row);
      for (const issue of issues) {
        // Skip pure note highlights (not tempnote — those never enter analyzeRow)
        if (issue.tone === "note" && !/future plan/i.test(issue.label) && !/report:/i.test(issue.label)) {
          continue;
        }
        // Plan issues are covered by plan cards above
        if (/future plan/i.test(issue.label)) continue;

        const colType = def.types[issue.col];
        const expiryPaired =
          colType === "status" ? statusExpiryCol(def.id, issue.col) : colType === "date" ? issue.col : null;
        const dateCol =
          expiryPaired ??
          (colType === "date" ? issue.col : null);
        const statusCol =
          colType === "status"
            ? issue.col
            : dateCol != null
              ? def.types.findIndex((t, i) => t === "status" && statusExpiryCol(def.id, i) === dateCol)
              : -1;
        const statusColN = statusCol >= 0 ? statusCol : null;
        const expiryRaw = dateCol != null ? (row.cells[dateCol] ?? "") : "";
        const expiryD = parseISO(expiryRaw);
        const left = expiryD && !isOldExpiry(expiryRaw) ? daysUntil(expiryD) : null;
        const statusLabel =
          statusColN != null
            ? normStatus(row.cells[statusColN] ?? "") || "—"
            : colType === "status"
              ? normStatus(row.cells[issue.col] ?? "") || "—"
              : "—";

        const filters = [...issueFilters(issue, def.id), "all"] as WorkCenterFilter[];
        if (left === 0) filters.push("today");
        if (def.id === "docs") {
          if (!filters.includes("missing_documents")) filters.push("missing_documents");
        }

        let kind: WorkCenterItemKind = "status";
        if (/applied/i.test(issue.label)) kind = "applied";
        else if (def.id === "docs" || /missing|invalid|empty/i.test(issue.label)) kind = "missing_doc";
        else if (colType === "date" || /expir/i.test(issue.label)) kind = "expiry";

        const planRule = planRulesForSection(def.id).find(
          (r) => r.expiryCol === dateCol || r.statusCol === statusColN,
        );
        const planSuggestion = planRule ? buildFuturePlanSuggestion(planRule, row) : null;
        const planCol = planRule?.planCol ?? null;
        const existingPlan = planCol != null ? (row.cells[planCol] ?? "").trim() : "";

        pushUnique(out, {
          key: `issue-${def.id}-${row.id}-${issue.col}-${issue.label}`,
          kind,
          filters: [...new Set(filters)],
          driverId,
          driver,
          sectionId: def.id,
          sectionTitle: def.title,
          rowId: row.id,
          docType: (sec.headers[issue.col] ?? def.short).trim() || def.short,
          statusLabel,
          expiryRaw,
          expiryDisplay: expiryD ? fmtDate(expiryD) : fmtCell(expiryRaw) || "—",
          daysLeft: left,
          daysLabel: daysLabel(left, expiryD),
          details: issue.label,
          neededAction: neededActionFor(issue, def.id, planSuggestion),
          tone: issue.tone,
          statusCol: statusColN,
          dateCol,
          planCol,
          tempnoteCol: def.types.indexOf("tempnote") >= 0 ? def.types.indexOf("tempnote") : null,
          existingPlan,
          existingTempNote: "",
          planSuggestion,
          dmvApplied: def.id === "dmv" && normStatus(statusLabel) === "Applied",
          isNew,
          linkOnly:
            colType === "secret"
              ? {
                  label: "Open section editor",
                  to: "/s/$sectionId",
                  reason: "Sensitive field — edit in the section table",
                }
              : null,
        });
      }
    }
  }

  return out.sort((a, b) => {
    const ta = TONE_RANK.indexOf(a.tone);
    const tb = TONE_RANK.indexOf(b.tone);
    if (ta !== tb) return ta - tb;
    const da = a.daysLeft ?? 9999;
    const db = b.daysLeft ?? 9999;
    if (da !== db) return da - db;
    return a.driver.localeCompare(b.driver, undefined, { sensitivity: "base" });
  });
}

export function groupWorkCenterByDriver(items: WorkCenterItem[]): WorkCenterDriverGroup[] {
  const map = new Map<string, WorkCenterDriverGroup>();
  for (const item of items) {
    let g = map.get(item.driverId);
    if (!g) {
      g = {
        driverId: item.driverId,
        driver: item.driver,
        isNew: item.isNew,
        items: [],
        worstTone: item.tone,
      };
      map.set(item.driverId, g);
    }
    g.items.push(item);
    g.worstTone = worseTone(g.worstTone, item.tone);
    if (item.isNew) g.isNew = true;
    if (!g.driver.trim() || g.driver === "—") g.driver = item.driver;
  }
  return [...map.values()].sort((a, b) => {
    const ta = TONE_RANK.indexOf(a.worstTone);
    const tb = TONE_RANK.indexOf(b.worstTone);
    if (ta !== tb) return ta - tb;
    return a.driver.localeCompare(b.driver, undefined, { sensitivity: "base" });
  });
}

export function filterWorkCenterItems(
  items: WorkCenterItem[],
  filter: WorkCenterFilter,
  search: string,
): WorkCenterItem[] {
  const q = search.trim().toLowerCase();
  return items.filter((item) => {
    if (filter !== "all" && !item.filters.includes(filter)) return false;
    if (!q) return true;
    const hay = `${item.driver} ${item.docType} ${item.sectionTitle} ${item.details} ${item.statusLabel}`.toLowerCase();
    return hay.includes(q);
  });
}

/** Summary counters — unique drivers per filter (except all = total items). */
export function workCenterCounts(items: WorkCenterItem[]): WorkCenterCounts {
  const counts = { drivers: 0 } as WorkCenterCounts;
  for (const f of WORK_CENTER_FILTERS) counts[f.id] = 0;

  const driversAll = new Set<string>();
  const byFilter = new Map<WorkCenterFilter, Set<string>>();
  for (const f of WORK_CENTER_FILTERS) byFilter.set(f.id, new Set());

  for (const item of items) {
    driversAll.add(item.driverId);
    byFilter.get("all")!.add(item.driverId);
    for (const f of item.filters) {
      if (f === "all") continue;
      byFilter.get(f)?.add(item.driverId);
    }
  }

  counts.drivers = driversAll.size;
  for (const f of WORK_CENTER_FILTERS) {
    counts[f.id] = f.id === "all" ? items.length : byFilter.get(f.id)!.size;
  }
  return counts;
}

/** Resolve a live row after saves (for recalculating alerts). */
export function findWorkCenterRow(
  data: AppData,
  sectionId: string,
  rowId: string,
): { row: Row; headers: string[] } | null {
  const sec = data.sections[sectionId];
  if (!sec) return null;
  const row = sec.rows.find((r) => r.id === rowId);
  if (!row) return null;
  return { row, headers: sec.headers };
}

export function sectionStatusOptions(sectionId: string): string[] {
  return sectionById(sectionId)?.statusOptions ?? [];
}

/** Temp notes for a driver (display helper). */
export function driverTempNotes(data: AppData, driverId: string): TempNoteSection[] {
  return collectTempNotes(data, driverId);
}
