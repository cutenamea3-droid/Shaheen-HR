import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import {
  buildInactiveCells,
  buildSeed,
  formatDriverStatus,
  migrateData,
  parseDriverStatus,
  SECTIONS,
  uid,
  type AppData,
  type DriverClass,
  type RosterKind,
  type SectionData,
} from "./sections";
import { applyDriverClass, applyRosterKind } from "./driver-meta";
import { applyDateOfHire } from "./driver-hr/hire-date";
import { cloudLoad, cloudSave, cloudStamp, hasPortalSession, logPortalActivity, subscribePortalAuth } from "./cloud";
import { isPreviewIsolated } from "./preview-isolated";

const KEY = "shaheen-driver-tracker-v1";
/** Manual record lists stored as tracker_sections rows (same cloud table). */
export const RECORD_SECTION_IDS = ["rec_drivers", "rec_owners", "rec_mechanics"] as const;
/** Document columns + person Active/Inactive (last). */
export const RECORD_HEADERS = ["Name", "Document", "Status", "Expiry Date", "Notes", "Active Status"];
/** Index of Active/Inactive on record rows (Owner Operators etc.). */
export const RECORD_ACTIVE_COL = 5;
let state: AppData = buildSeed();
let loaded = false;
const listeners = new Set<() => void>();

export type SyncStatus = "local" | "syncing" | "synced" | "error";
let sync: SyncStatus = "local";
const syncListeners = new Set<() => void>();
function setSync(s: SyncStatus) {
  sync = s;
  syncListeners.forEach((l) => l());
}
export const useSyncStatus = () =>
  useSyncExternalStore(
    (l) => {
      syncListeners.add(l);
      return () => syncListeners.delete(l);
    },
    () => sync,
    () => "local" as SyncStatus,
  );

function emit() {
  listeners.forEach((l) => l());
}
function emptyRecordSection(): SectionData {
  return {
    headers: [...RECORD_HEADERS],
    widths: RECORD_HEADERS.map((_, i) => (i === RECORD_ACTIVE_COL ? 150 : 200)),
    hidden: RECORD_HEADERS.map(() => false),
    rows: [],
  };
}

/** Pad/migrate record tabs so Active Status column exists on every row. */
function normalizeRecordSection(sec: SectionData): SectionData {
  let headers = [...(sec.headers ?? [])];
  let widths = [...(sec.widths ?? [])];
  let hidden = [...(sec.hidden ?? [])];
  let rows = sec.rows.map((r) => ({ ...r, cells: [...r.cells] }));
  let touched = false;

  const hasActive = headers.some((h) => /^active\s*status$/i.test(h.trim()));
  if (!hasActive) {
    headers = [...headers, "Active Status"];
    widths = [...widths, 150];
    hidden = [...hidden, false];
    touched = true;
  }
  // Prefer canonical header order when lengths match expected shape.
  if (headers.length === RECORD_HEADERS.length) {
    for (let i = 0; i < RECORD_HEADERS.length; i++) {
      if (headers[i] !== RECORD_HEADERS[i]) {
        headers[i] = RECORD_HEADERS[i];
        touched = true;
      }
    }
  }
  const len = headers.length;
  while (widths.length < len) widths.push(200);
  while (hidden.length < len) hidden.push(false);
  rows = rows.map((r) => {
    const cells = [...r.cells];
    while (cells.length < len) {
      cells.push(cells.length === RECORD_ACTIVE_COL || cells.length === len - 1 ? "Active" : "");
      touched = true;
    }
    const activeIdx = headers.findIndex((h) => /^active\s*status$/i.test(h.trim()));
    if (activeIdx >= 0 && !cells[activeIdx]?.trim()) {
      cells[activeIdx] = "Active";
      touched = true;
    }
    return cells === r.cells ? r : { ...r, cells };
  });
  if (!touched && widths.length === (sec.widths?.length ?? 0) && hidden.length === (sec.hidden?.length ?? 0)) return sec;
  return { ...sec, headers, widths: widths.slice(0, len), hidden: hidden.slice(0, len), rows };
}

/** Ensure record tabs exist locally so first cloud upload includes them. */
function ensureRecordSections(data: AppData): AppData {
  const sections = { ...data.sections };
  let touched = false;
  for (const id of RECORD_SECTION_IDS) {
    if (!sections[id]) {
      sections[id] = emptyRecordSection();
      touched = true;
    } else {
      const next = normalizeRecordSection(sections[id]);
      if (next !== sections[id]) {
        sections[id] = next;
        touched = true;
      }
    }
  }
  return touched ? { ...data, sections } : data;
}

function markAllSectionsDirty() {
  Object.keys(state.sections).forEach((id) => dirty.add(id));
}

/** localStorage is a short cache only — Supabase tracker_sections is source of truth once signed in. */
function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    if (!localWarned) {
      localWarned = true;
      toast.error("This computer's browser storage is full", {
        id: "local-full",
        description: "Your changes are still being sent to the cloud. Download a Backup to be safe.",
        duration: 10000,
      });
    }
  }
}
let localWarned = false;

function saveFailReason(e: unknown) {
  const m = (e instanceof Error ? e.message : String(e ?? "")).toLowerCase();
  if (typeof navigator !== "undefined" && !navigator.onLine) return "You are offline — check your internet connection.";
  if (/quota|storage|disk|full|space|limit|413|too large/.test(m)) return "Cloud storage is full or the change is too large.";
  if (/passcode|unauthor|401|403/.test(m)) return "The portal was locked — please lock and unlock again with your password.";
  if (/timeout|fetch|network|failed to/.test(m)) return "The cloud did not answer (connection problem).";
  return "The cloud could not save right now.";
}
export function retrySync() {
  void flush();
}

// ---------- cloud sync ----------
const dirty = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;
let lastStamp = "";
let cloudReady = false;
let failCount = 0;
let pulling = false;

function scheduleFlush() {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(flush, 500);
}
async function flush() {
  flushTimer = null;
  if (!cloudReady || flushing || !dirty.size) return;
  flushing = true;
  let ids: string[] = [];
  let authenticated = false;
  try {
    authenticated = await hasPortalSession();
    if (!authenticated) return;
    if (!dirty.size) return;
    ids = [...dirty];
    dirty.clear();
    setSync("syncing");
    const sections = Object.fromEntries(ids.map((id) => [id, JSON.stringify(state.sections[id])]));
    const r = await cloudSave({ data: { sections } });
    if (r.stamp > lastStamp) lastStamp = r.stamp;
    setSync("synced");
    try {
      const { logLocalActivity } = await import("./portal-local");
      const meta = {
        actorName: "Driver Compliance",
        action: ids.length === 1 ? `Saved compliance section` : `Saved ${ids.length} compliance sections`,
        sectionId: ids.length === 1 ? ids[0]! : "sections",
      };
      logLocalActivity(meta);
      // Cloud trigger also logs tracker upserts; this covers client-side audit when available.
      void logPortalActivity(meta).catch(() => undefined);
    } catch {
      /* activity logging must never block saves */
    }
    if (failCount) {
      failCount = 0;
      toast.dismiss("cloud-save-fail");
      toast.success("All changes are saved to the cloud again");
    }
  } catch (e) {
    ids.forEach((id) => dirty.add(id));
    setSync("error");
    failCount++;
    if (failCount === 1 || failCount % 10 === 0)
      toast.error("Your changes were NOT saved to the cloud", {
        id: "cloud-save-fail",
        description: saveFailReason(e) + " They are kept on this computer and will retry automatically.",
        duration: Infinity,
        action: { label: "Try again", onClick: () => retrySync() },
      });
  } finally {
    flushing = false;
    if (dirty.size && authenticated) {
      if (flushTimer) clearTimeout(flushTimer);
      flushTimer = setTimeout(flush, failCount ? Math.min(30000, 3000 * failCount) : 500);
    }
  }
}

async function pullCloud(force = false) {
  if (pulling) return;
  pulling = true;
  try {
    if (!(await hasPortalSession())) return;
    if (!force) {
      const { stamp } = await cloudStamp();
      if (!stamp || stamp <= lastStamp) return;
    }
    if (cloudReady && (dirty.size || flushing)) return;
    const r = await cloudLoad();
    if (cloudReady && (dirty.size || flushing)) return;
    const ids = Object.keys(r.sections);
    if (!ids.length) {
      // Cloud empty → seed/local cache is first durable copy (incl. record tabs), then upload.
      state = ensureRecordSections(state);
      cloudReady = true;
      persist();
      emit();
      markAllSectionsDirty();
      await flush();
      return;
    }
    // Remote is source of truth: apply cloud rows, keep any local-only keys only until uploaded.
    const sections = { ...state.sections };
    for (const id of ids) sections[id] = JSON.parse(r.sections[id]);
    if (!cloudReady) dirty.clear();
    const m = migrateData(ensureRecordSections({ ...state, sections }));
    state = m.data;
    m.changed.forEach((id) => dirty.add(id));
    // Upload record shells (or other local-only sections) missing from remote.
    for (const id of RECORD_SECTION_IDS) {
      if (!r.sections[id]) dirty.add(id);
    }
    if (dirty.size) scheduleFlush();
    lastStamp = r.stamp;
    cloudReady = true;
    persist();
    emit();
    setSync("synced");
  } catch {
    setSync("error");
  } finally {
    pulling = false;
  }
}

let pollStarted = false;
export function startCloudSync() {
  if (typeof window === "undefined" || pollStarted) return;
  // Isolated visual preview: stay on seed/localStorage; never subscribe or pull/push.
  if (isPreviewIsolated()) {
    pollStarted = true;
    cloudReady = false;
    setSync("local");
    return;
  }
  pollStarted = true;
  subscribePortalAuth((signedIn) => {
    if (signedIn) window.setTimeout(() => void pullCloud(true), 0);
    else {
      cloudReady = false;
      setSync("local");
    }
  });
  void pullCloud(true);
  setInterval(() => {
    if (document.visibilityState === "visible") void pullCloud();
  }, 4000);
  window.addEventListener("focus", () => void pullCloud());
}

export function loadFromStorage() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppData;
      if (parsed?.sections) state = migrateData(parsed).data;
    }
  } catch {
    /* ignore corrupt storage */
  }
  const withRecords = ensureRecordSections(state);
  if (withRecords !== state) {
    state = withRecords;
    markAllSectionsDirty();
    persist();
  }
  emit();
  // Pull/push to Supabase — localStorage remains a cache only.
  startCloudSync();
}

/** Current app data snapshot (for tests and non-React callers). */
export function getData() {
  return state;
}

export function useData() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}
export const useLoaded = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => loaded,
    () => false,
  );

function update(fn: (d: AppData) => AppData) {
  const prev = state;
  state = fn(state);
  for (const id of Object.keys(state.sections)) if (state.sections[id] !== prev.sections[id]) dirty.add(id);
  persist();
  emit();
  scheduleFlush();
}

const ACTIVE_IDX: Record<string, number> = {};
SECTIONS.forEach((s) => {
  const i = s.types.indexOf("active");
  if (i >= 0) ACTIVE_IDX[s.id] = i;
});

export function setCell(sectionId: string, rowId: string, col: number, value: string) {
  update((d) => {
    const sec = d.sections[sectionId];
    const row = sec?.rows.find((r) => r.id === rowId);
    if (!row || !sec) return d;
    const isActive = SECTIONS.find((s) => s.id === sectionId)?.types[col] === "active";
    const sections = { ...d.sections };
    if (isActive) {
      const status = parseDriverStatus(value);
      const label = formatDriverStatus(status);
      // keep Active / Leave / Inactive in sync for this driver across every section
      for (const [sid, idx] of Object.entries(ACTIVE_IDX)) {
        const cur = sections[sid];
        if (!cur) continue;
        // Inactive roster Status column stays Active/Inactive only
        const cellLabel = sid === "inactive" ? (status === "inactive" ? "Inactive" : "Active") : label;
        sections[sid] = {
          ...cur,
          rows: cur.rows.map((r) =>
            r.driverId === row.driverId
              ? {
                  ...r,
                  status,
                  cells: r.cells.map((c, i) => (i === idx ? cellLabel : c)),
                }
              : r,
          ),
        };
      }
      // Inactive Drivers tab must list anyone marked Inactive (create row if missing)
      const ina = sections.inactive;
      const inaIdx = ACTIVE_IDX.inactive;
      if (ina && inaIdx != null) {
        const has = ina.rows.some((r) => r.driverId === row.driverId);
        if (status === "inactive" && !has) {
          const draft = { ...d, sections };
          sections.inactive = {
            ...ina,
            rows: [
              ...ina.rows,
              {
                id: "inactive_" + uid(),
                driverId: row.driverId,
                status: "inactive",
                cells: buildInactiveCells(draft, row.driverId, "Inactive"),
                addedAt: Date.now(),
              },
            ],
          };
        }
      }
      return { ...d, sections };
    }
    sections[sectionId] = {
      ...sec,
      rows: sec.rows.map((r) =>
        r.id === rowId ? { ...r, cells: r.cells.map((c, i) => (i === col ? value : c)) } : r,
      ),
    };
    return { ...d, sections };
  });
}

export function patchSection(sectionId: string, patch: Partial<AppData["sections"][string]>) {
  update((d) => ({ ...d, sections: { ...d.sections, [sectionId]: { ...d.sections[sectionId], ...patch } } }));
}

export function setRowHeight(sectionId: string, rowId: string, h: number) {
  update((d) => {
    const sec = d.sections[sectionId];
    return {
      ...d,
      sections: {
        ...d.sections,
        [sectionId]: { ...sec, rows: sec.rows.map((r) => (r.id === rowId ? { ...r, height: h } : r)) },
      },
    };
  });
}

export function deleteDriver(driverId: string) {
  update((d) => {
    const sections = { ...d.sections };
    for (const k of Object.keys(sections))
      sections[k] = { ...sections[k], rows: sections[k].rows.filter((r) => r.driverId !== driverId) };
    return { ...d, sections };
  });
}

/** values: sectionId -> cells array (same length as the section's columns) */
export function addDriver(values: Record<string, string[]>) {
  const driverId = "d_" + uid();
  const addedAt = Date.now();
  update((d) => {
    const sections = { ...d.sections };
    for (const [sid, cells] of Object.entries(values)) {
      sections[sid] = {
        ...sections[sid],
        rows: [
          ...sections[sid].rows,
          {
            id: sid + "_" + uid(),
            driverId,
            cells,
            addedAt,
            // New via wizard → exclusive onboarding list until "Move to Active Drivers".
            rosterKind: "new" as RosterKind,
            driverClass: "company" as DriverClass,
          },
        ],
      };
    }
    return { ...d, sections };
  });
  return driverId;
}

/**
 * Set Company ↔ Owner Operator classification (mirrored by driverId).
 * Keeps all section rows and history — never delete/recreate. Confirm in UI before calling.
 */
export function setDriverClass(driverId: string, next: DriverClass) {
  update((d) => applyDriverClass(d, driverId, next));
}

/**
 * Set onboarding roster kind. "roster" = Move to Active Drivers; "new" reverses back to New list.
 * Confirm in UI before calling. Does not change employment Active/Leave/Inactive.
 */
export function setDriverRosterKind(driverId: string, next: RosterKind) {
  update((d) => applyRosterKind(d, driverId, next));
}

/**
 * Set optional Date of Hire (ISO YYYY-MM-DD or ""). Mirrored by driverId.
 * Independent save — does not invent values or touch rates / drug tests / compliance docs.
 */
export function setDriverDateOfHire(driverId: string, next: string) {
  update((d) => applyDateOfHire(d, driverId, next));
}

export function resetToSpreadsheet() {
  update(() => buildSeed());
}
export function exportBackup() {
  return JSON.stringify(state, null, 2);
}
export function importBackup(json: string) {
  const parsed = JSON.parse(json) as AppData;
  if (!parsed?.sections) throw new Error("Not a valid backup file");
  update(() => migrateData(parsed).data);
}

/** Adds an empty row for an existing driver in a section where they are missing (keeps rows line-by-line). */
export function addRowForDriver(sectionId: string, driverId: string, name: string) {
  update((d) => {
    const sec = d.sections[sectionId];
    if (!sec || sec.rows.some((r) => r.driverId === driverId)) return d;
    const cells = sec.headers.map((_, i) => (i === 0 ? name : ""));
    return { ...d, sections: { ...d.sections, [sectionId]: { ...sec, rows: [...sec.rows, { id: sectionId + "_" + uid(), driverId, cells, addedAt: Date.now() }] } } };
  });
}

/** Manual record lists (extra driver documents, owner operators, mechanics) — kept apart from the driver sections. */
export function addRecord(sectionId: string, cells: string[]) {
  update((d) => {
    const sec = d.sections[sectionId] ?? emptyRecordSection();
    const padded = [...cells];
    while (padded.length < RECORD_HEADERS.length) {
      padded.push(padded.length === RECORD_ACTIVE_COL ? "Active" : "");
    }
    return {
      ...d,
      sections: {
        ...d.sections,
        [sectionId]: {
          ...sec,
          rows: [...sec.rows, { id: sectionId + "_" + uid(), driverId: "r_" + uid(), cells: padded, addedAt: Date.now() }],
        },
      },
    };
  });
}

/** Set Active/Inactive for every document row belonging to one person in a record section. */
export function setRecordPersonActive(sectionId: string, personName: string, value: string) {
  const key = recordPersonKey(personName);
  if (!key) return;
  const label = value.trim().toLowerCase() === "inactive" ? "Inactive" : "Active";
  update((d) => {
    const sec = d.sections[sectionId];
    if (!sec) return d;
    let touched = false;
    const rows = sec.rows.map((r) => {
      if (recordPersonKey(r.cells[0] ?? "") !== key) return r;
      const cells = [...r.cells];
      while (cells.length <= RECORD_ACTIVE_COL) cells.push("");
      const wasInactive = cells[RECORD_ACTIVE_COL].trim().toLowerCase() === "inactive";
      if (label === "Inactive" && wasInactive) return r;
      if (label === "Active" && cells[RECORD_ACTIVE_COL] === "Active") return r;
      touched = true;
      cells[RECORD_ACTIVE_COL] = label;
      return { ...r, cells };
    });
    if (!touched) return d;
    return { ...d, sections: { ...d.sections, [sectionId]: { ...sec, rows } } };
  });
}

export function recordPersonIsActive(rows: { cells: string[] }[]) {
  for (const r of rows) {
    const v = (r.cells[RECORD_ACTIVE_COL] ?? "").trim();
    if (v) return v.toLowerCase() !== "inactive";
  }
  return true;
}

// Pad record Active Status on boot so UI/tests see the column without waiting for loadFromStorage.
state = ensureRecordSections(state);
export function deleteRecord(sectionId: string, rowId: string) {
  update((d) => {
    const sec = d.sections[sectionId];
    if (!sec) return d;
    return { ...d, sections: { ...d.sections, [sectionId]: { ...sec, rows: sec.rows.filter((r) => r.id !== rowId) } } };
  });
}

function recordPersonKey(name: string) {
  return name.trim().toLowerCase();
}

/** Move every document row for a person from one record section into another (preserves cells/driverId/addedAt; new row ids). */
export function moveRecordPerson(fromId: string, toId: string, personName: string) {
  if (fromId === toId) return;
  const key = recordPersonKey(personName);
  if (!key) return;
  update((d) => {
    const from = d.sections[fromId] ?? emptyRecordSection();
    const to = d.sections[toId] ?? emptyRecordSection();
    const moving = from.rows.filter((r) => recordPersonKey(r.cells[0] ?? "") === key);
    if (!moving.length) return d;
    const stay = from.rows.filter((r) => recordPersonKey(r.cells[0] ?? "") !== key);
    const added = moving.map((r) => ({
      ...r,
      id: toId + "_" + uid(),
      cells: [...r.cells],
    }));
    return {
      ...d,
      sections: {
        ...d.sections,
        [fromId]: { ...from, rows: stay },
        [toId]: { ...to, rows: [...to.rows, ...added] },
      },
    };
  });
}

/** Rename every document row for a person within a record section so person-card grouping stays intact. */
export function renameRecordPerson(sectionId: string, oldName: string, newName: string) {
  const next = newName.trim();
  if (!next) return;
  const key = recordPersonKey(oldName);
  if (!key || recordPersonKey(next) === key) return;
  update((d) => {
    const sec = d.sections[sectionId];
    if (!sec) return d;
    let touched = false;
    const rows = sec.rows.map((r) => {
      if (recordPersonKey(r.cells[0] ?? "") !== key) return r;
      touched = true;
      return { ...r, cells: r.cells.map((c, i) => (i === 0 ? next : c)) };
    });
    if (!touched) return d;
    return { ...d, sections: { ...d.sections, [sectionId]: { ...sec, rows } } };
  });
}
