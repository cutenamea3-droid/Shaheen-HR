import seed from "@/data/seed.json";

export type ColType =
  | "name"
  | "text"
  | "status"
  | "date"
  | "note"
  | "plan"
  | "tempnote"
  | "active"
  | "state"
  | "score"
  | "secret";

export interface SectionDef {
  id: string;
  title: string;
  short: string;
  types: ColType[];
  /** Explanation lines shown above the table. */
  rules: string[];
  /** Status options offered in this section's status toggles. */
  statusOptions: string[];
  /** Whether this section is part of the "Add driver" flow. */
  inWizard: boolean;
}

export const STATUS_ALL = ["Valid", "Applied", "Invalid", "Missing", "Sign Missing", "Expired"];
const NO_APPLY = ["Valid", "Invalid", "Missing", "Sign Missing", "Expired"];

export const SECTIONS: SectionDef[] = [
  {
    id: "dmv",
    title: "DMV Pull Notices",
    short: "DMV",
    types: ["name", "text", "status", "date", "text", "note", "active", "plan", "state", "tempnote"],
    rules: [
      "CA drivers: expiration turns amber 10 days before it expires.",
      "Other-state drivers: expiration turns amber 20 days before (their DMV takes 15–20 business days).",
      "Future Plans highlight together with the expiration — that means today is the day to apply.",
      "Red = already expired · Blue = Applied · Yellow = a note is written · Report other than “NONE” is highlighted.",
      "Temporary Note never highlights — use it for short reminders only.",
    ],
    statusOptions: STATUS_ALL,
    inWizard: true,
  },
  {
    id: "medical",
    title: "Medical Certificate",
    short: "Medical",
    types: ["name", "status", "date", "note", "note", "active", "plan", "tempnote"],
    rules: [
      "Expiration turns amber 15 days before it expires — time to call the driver.",
      "Future Plans highlight 17 days before expiration and stay highlighted until the date is renewed.",
      "Red = expired, Invalid or Missing · Yellow = a note is written.",
      "Temporary Note never highlights — use it for short reminders only.",
    ],
    statusOptions: NO_APPLY,
    inWizard: true,
  },
  {
    id: "queries",
    title: "Queries",
    short: "Queries",
    types: ["name", "status", "date", "status", "date", "note", "plan", "plan", "active", "tempnote"],
    rules: [
      "New drivers get a Pre-Employment Query first; the Annual Query starts one year later.",
      "Annual & Pre-Employment expirations turn amber 2 weeks (14 days) before they expire — each column is judged on its own.",
      "Type Old in an expiration to skip amber/red for that column only.",
      "Annual and Pre-Employment Future Plans highlight with their own expiration (14 days before).",
      "Red = expired or Missing · Blue = Applied · Yellow = a note is written.",
      "Temporary Note never highlights — use it for short reminders only.",
    ],
    statusOptions: STATUS_ALL,
    inWizard: true,
  },
  {
    id: "ssccdl",
    title: "SSC & CDL",
    short: "SSC & CDL",
    types: ["name", "text", "status", "date", "status", "secret", "note", "plan", "active", "tempnote"],
    rules: [
      "CDL expiration turns amber 30 days before it expires — tell the driver to renew.",
      "Social Security Card has no expiration; it is flagged only when Missing or Invalid.",
      "Future Plans (CDL renewal only) highlight together with the CDL expiration (30 days before).",
      "Yellow = a note is written.",
      "Temporary Note never highlights — use it for short reminders only.",
    ],
    statusOptions: NO_APPLY,
    inWizard: true,
  },
  {
    id: "docs",
    title: "Drivers Other Documents",
    short: "Other Docs",
    types: [
      "name", "score",
      "status", "status", "status", "status", "status", "status",
      "status", "status", "status", "status", "status", "status",
      "note", "active", "tempnote",
    ],
    rules: [
      "These documents never expire — they must be signed and filled in correctly.",
      "Compliance Score = valid documents ÷ 12. A written note lowers the score by 5%.",
      "Red = Missing / Invalid / Sign Missing · Yellow = a note is written.",
      "Temporary Note never highlights — use it for short reminders only.",
    ],
    statusOptions: NO_APPLY,
    inWizard: true,
  },
  {
    id: "info",
    title: "Drivers Information",
    short: "Info",
    types: ["name", "text", "text", "state"],
    rules: ["Contact details. Phone or email marked “In-Valid” or empty is highlighted."],
    statusOptions: [],
    inWizard: true,
  },
  {
    id: "inactive",
    title: "Inactive Drivers",
    short: "Inactive",
    types: ["name", "text", "text", "active", "state"],
    rules: ["List of drivers who are no longer active."],
    statusOptions: [],
    inWizard: false,
  },
];

export const sectionById = (id: string) => SECTIONS.find((s) => s.id === id);

export interface Row {
  id: string;
  driverId: string;
  cells: string[];
  height?: number;
  /** ms timestamp when added via Add Driver; drivers from the sheet have none */
  addedAt?: number;
}
export interface SectionData {
  headers: string[];
  widths: number[];
  hidden: boolean[];
  rows: Row[];
  /** driver IDs whose "missing in this section" notice was dismissed */
  dismissed?: string[];
}
export interface AppData {
  version: number;
  sections: Record<string, SectionData>;
}

export const normName = (n: string) =>
  n
    .toLowerCase()
    .replace(/\bs\d+\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

export function defaultWidth(t: ColType) {
  switch (t) {
    case "name": return 230;
    case "note": case "plan": case "tempnote": return 340;
    case "status": return 190;
    case "date": return 190;
    case "score": return 170;
    case "active": return 150;
    case "state": return 110;
    default: return 200;
  }
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export function buildSeed(): AppData {
  // Prefer full AppData seed (tracker backup shape: { version, sections }).
  const raw = seed as AppData | Record<string, { headers: string[]; rows: string[][] }>;
  if (raw && typeof raw === "object" && "sections" in raw && (raw as AppData).sections) {
    return migrateData(raw as AppData).data;
  }
  // Legacy spreadsheet seed: { [sectionId]: { headers, rows: string[][] } }
  const s = raw as Record<string, { headers: string[]; rows: string[][] }>;
  const ids = new Map<string, string>();
  const idFor = (name: string) => {
    const k = normName(name);
    if (!ids.has(k)) ids.set(k, "d_" + (ids.size + 1));
    return ids.get(k)!;
  };
  const sections: Record<string, SectionData> = {};
  for (const def of SECTIONS) {
    const src = s[def.id];
    sections[def.id] = {
      headers: [...src.headers],
      widths: def.types.map(defaultWidth),
      hidden: def.types.map(() => false),
      rows: src.rows.map((cells, i) => ({
        id: `${def.id}_${i}`,
        driverId: idFor(cells[0]),
        cells: src.headers.map((_, ci) => cells[ci] ?? ""),
      })),
    };
  }
  return migrateData({ version: 1, sections }).data;
}

/** Splits the old merged "Notes & Future Plans" column into Notes + Future Plans (Queries, SSC & CDL). */
const SPLITS: { id: string; oldLen: number; at: number; moveNote: boolean }[] = [
  { id: "queries", oldLen: 7, at: 6, moveNote: true },
  { id: "ssccdl", oldLen: 8, at: 7, moveNote: false },
];
/** Matching key for one person: ignores ID numbers (S16, 498250, ,s232), punctuation, spacing and l/I scan mix-ups. */
export const driverKey = (n: string) =>
  (n ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !/^s?\d+$/.test(t))
    .join(" ")
    .replace(/l/g, "i");

/** Links rows of the same person (in every section) to one driver, so Driver Cards shows one card. Cell values are untouched. */
/** Sections whose column 1 holds the CDL number. */
const CDL_COL: Record<string, number> = { dmv: 1, ssccdl: 1, inactive: 1 };
export const cdlDigits = (v: string) => {
  const d = (v ?? "").replace(/\D/g, "");
  return d.length >= 6 ? d : "";
};
function editDist(a: string, b: string) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[m][n];
}
/** Small typos in a name (Sara/Sarah, Ismail/Ismael): same word count, each word off by at most 1 letter, 2 in total. */
export function similarNames(a: string, b: string) {
  const x = a.split(" "), y = b.split(" ");
  if (!a || !b || x.length !== y.length) return false;
  let total = 0;
  for (let i = 0; i < x.length; i++) {
    const d = editDist(x[i], y[i]);
    if (d > 1 || (d === 1 && Math.min(x[i].length, y[i].length) < 4)) return false;
    total += d;
  }
  return total <= 2;
}

export function linkDrivers(data: AppData): { data: AppData; changed: string[] } {
  const ids = SECTIONS.map((s) => s.id).filter((id) => data.sections[id]);
  // pass 1: same cleaned name
  const owner = new Map<string, string>();
  for (const id of ids) for (const r of data.sections[id].rows) {
    const k = driverKey(r.cells[0]);
    if (k && !owner.has(k)) owner.set(k, r.driverId);
  }
  const target = new Map<string, string>();
  for (const id of ids) for (const r of data.sections[id].rows) {
    const want = owner.get(driverKey(r.cells[0]));
    if (want && want !== r.driverId) target.set(r.driverId, want);
  }
  const resolve = (d: string) => { let x = d; const seen = new Set<string>(); while (target.has(x) && !seen.has(x)) { seen.add(x); x = target.get(x)!; } return x; };
  // pass 2: same CDL number, or a small name typo when CDLs don't disagree
  type G = { id: string; keys: Set<string>; cdls: Set<string>; rows: number };
  const groups = new Map<string, G>();
  for (const id of ids) for (const r of data.sections[id].rows) {
    const gid = resolve(r.driverId);
    const g = groups.get(gid) ?? { id: gid, keys: new Set(), cdls: new Set(), rows: 0 };
    g.rows++;
    const k = driverKey(r.cells[0]);
    if (k) g.keys.add(k);
    if (id in CDL_COL) { const c = cdlDigits(r.cells[CDL_COL[id]]); if (c) g.cdls.add(c); }
    groups.set(gid, g);
  }
  const list = [...groups.values()].sort((a, b) => b.rows - a.rows);
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j];
    if (resolve(a.id) === resolve(b.id)) continue;
    const sameCdl = [...a.cdls].some((c) => b.cdls.has(c));
    const conflict = a.cdls.size > 0 && b.cdls.size > 0 && !sameCdl;
    const typo = !conflict && [...a.keys].some((x) => [...b.keys].some((y) => similarNames(x, y)));
    if ((sameCdl && [...a.keys].some((x) => [...b.keys].some((y) => x.split(" ").some((t) => y.split(" ").includes(t))))) || typo)
      target.set(resolve(b.id), resolve(a.id));
  }
  const changed: string[] = [];
  const sections = { ...data.sections };
  for (const id of ids) {
    const sec = sections[id];
    let touched = false;
    const rows = sec.rows.map((r) => {
      const want = resolve(r.driverId);
      if (want !== r.driverId) { touched = true; return { ...r, driverId: want }; }
      return r;
    });
    if (touched) { sections[id] = { ...sec, rows }; changed.push(id); }
  }
  return { data: changed.length ? { ...data, sections } : data, changed };
}

/**
 * Appends missing columns (Temporary Note, Queries plan split) without shifting
 * existing cell values. Never truncates or overwrites filled cells.
 */
export function normalizeSections(input: AppData): { data: AppData; changed: string[] } {
  const changed: string[] = [];
  const sections = { ...input.sections };

  for (const def of SECTIONS) {
    const sec = sections[def.id];
    if (!sec) continue;

    let headers = [...sec.headers];
    let widths = [...(sec.widths ?? [])];
    let hidden = [...(sec.hidden ?? [])];
    let rows = sec.rows.map((r) => ({ ...r, cells: [...r.cells] }));
    let touched = false;

    const padRow = (cells: string[], len: number) => {
      if (cells.length >= len) return cells;
      return [...cells, ...Array(len - cells.length).fill("")];
    };
    const insertCol = (at: number, header: string, type: ColType, fill = "") => {
      headers = [...headers.slice(0, at), header, ...headers.slice(at)];
      widths = [...widths.slice(0, at), defaultWidth(type), ...widths.slice(at)];
      hidden = [...hidden.slice(0, at), false, ...hidden.slice(at)];
      rows = rows.map((r) => {
        const cells = padRow(r.cells, at);
        return { ...r, cells: [...cells.slice(0, at), fill, ...cells.slice(at)] };
      });
      touched = true;
    };
    const appendCol = (header: string, type: ColType) => {
      if (headers.some((h) => h.trim().toLowerCase() === header.trim().toLowerCase())) return;
      headers = [...headers, header];
      widths = [...widths, defaultWidth(type)];
      hidden = [...hidden, false];
      rows = rows.map((r) => ({ ...r, cells: [...padRow(r.cells, headers.length - 1), ""] }));
      touched = true;
    };

    // Queries: rename single Future Plans → Annual; insert empty Pre-Employment plan after it.
    if (def.id === "queries") {
      const hasAnnual = headers.some((h) => /annual.*future\s*plan/i.test(h.trim()));
      const hasPre = headers.some((h) => /pre[- ]?employment.*future\s*plan/i.test(h.trim()));
      const fpIdx = headers.findIndex((h) => /^future\s*plans?$/i.test(h.trim()));
      if (!hasAnnual && fpIdx >= 0) {
        headers[fpIdx] = "Annual Query Future Plan";
        touched = true;
        if (!hasPre) insertCol(fpIdx + 1, "Pre-Employment Future Plan", "plan", "");
      } else if (hasAnnual && !hasPre) {
        const annualIdx = headers.findIndex((h) => /annual.*future\s*plan/i.test(h.trim()));
        insertCol(annualIdx + 1, "Pre-Employment Future Plan", "plan", "");
      }
    }

    // Temporary Note: append only (never insert mid-row) for driver sections that declare tempnote.
    if (def.types.includes("tempnote")) appendCol("Temporary Note", "tempnote");

    // Pad short rows / meta arrays to header length — never shrink or reorder filled values.
    const len = headers.length;
    while (widths.length < len) widths.push(defaultWidth(def.types[widths.length] ?? "text"));
    while (hidden.length < len) hidden.push(false);
    rows = rows.map((r) => {
      const next = padRow(r.cells, len);
      if (next !== r.cells) {
        touched = true;
        return { ...r, cells: next };
      }
      return r;
    });
    if (widths.length !== (sec.widths?.length ?? 0) || hidden.length !== (sec.hidden?.length ?? 0)) touched = true;

    if (touched) {
      sections[def.id] = { ...sec, headers, widths: widths.slice(0, len), hidden: hidden.slice(0, len), rows };
      changed.push(def.id);
    }
  }

  return { data: changed.length ? { ...input, sections } : input, changed };
}

/** Canonical Active/Inactive label for a driver from any section that stores status. */
export function driverEmploymentStatus(data: AppData, driverId: string): "Active" | "Inactive" {
  for (const s of SECTIONS) {
    if (s.id === "inactive") continue;
    const i = s.types.indexOf("active");
    if (i < 0) continue;
    const r = data.sections[s.id]?.rows.find((x) => x.driverId === driverId);
    if (!r) continue;
    return r.cells[i]?.trim().toLowerCase() === "inactive" ? "Inactive" : "Active";
  }
  const inaDef = SECTIONS.find((s) => s.id === "inactive");
  const i = inaDef?.types.indexOf("active") ?? -1;
  const r = i >= 0 ? data.sections.inactive?.rows.find((x) => x.driverId === driverId) : undefined;
  if (r && i >= 0) return r.cells[i]?.trim().toLowerCase() === "inactive" ? "Inactive" : "Active";
  return "Active";
}

/** Build Inactive Drivers cells: Name, License, Phone, Status, State. */
export function buildInactiveCells(data: AppData, driverId: string, status: string): string[] {
  let name = "";
  let license = "";
  let phone = "";
  let state = "";
  for (const id of ["dmv", "ssccdl", "docs", "medical", "queries", "info", "inactive"] as const) {
    const r = data.sections[id]?.rows.find((x) => x.driverId === driverId);
    if (!r) continue;
    if (!name.trim()) name = (r.cells[0] ?? "").trim();
    if ((id === "dmv" || id === "ssccdl" || id === "inactive") && !license.trim()) license = (r.cells[1] ?? "").trim();
    if (id === "info" && !phone.trim()) phone = (r.cells[1] ?? "").trim();
    if (id === "inactive" && !phone.trim()) phone = (r.cells[2] ?? "").trim();
    const def = SECTIONS.find((s) => s.id === id);
    const si = def?.types.indexOf("state") ?? -1;
    if (si >= 0 && !state.trim()) state = (r.cells[si] ?? "").trim();
    if (id === "info" && !state.trim()) state = (r.cells[3] ?? "").trim();
  }
  const label = status.trim().toLowerCase() === "inactive" ? "Inactive" : "Active";
  return [name, license, phone, label, state];
}

/**
 * Keep Inactive Drivers roster in sync with employment status across sections.
 * Drivers marked Inactive gain a row here immediately; existing rows get matching Status.
 */
export function syncInactiveRoster(input: AppData): { data: AppData; changed: string[] } {
  const inaDef = SECTIONS.find((s) => s.id === "inactive");
  const inaSec = input.sections.inactive;
  if (!inaDef || !inaSec) return { data: input, changed: [] };
  const statusIdx = inaDef.types.indexOf("active");
  if (statusIdx < 0) return { data: input, changed: [] };

  const inactiveIds = new Set<string>();
  for (const s of SECTIONS) {
    if (s.id === "inactive") continue;
    const i = s.types.indexOf("active");
    if (i < 0) continue;
    for (const r of input.sections[s.id]?.rows ?? []) {
      if (r.cells[i]?.trim().toLowerCase() === "inactive") inactiveIds.add(r.driverId);
    }
  }

  let touched = false;
  const byId = new Map(inaSec.rows.map((r) => [r.driverId, r]));
  const rows = inaSec.rows.map((r) => {
    const want = inactiveIds.has(r.driverId) ? "Inactive" : driverEmploymentStatus(input, r.driverId);
    if ((r.cells[statusIdx] ?? "").trim() === want) return r;
    touched = true;
    return { ...r, cells: r.cells.map((c, i) => (i === statusIdx ? want : c)) };
  });

  for (const driverId of inactiveIds) {
    if (byId.has(driverId)) continue;
    touched = true;
    rows.push({
      id: `inactive_${uid()}`,
      driverId,
      cells: buildInactiveCells(input, driverId, "Inactive"),
      addedAt: Date.now(),
    });
  }

  if (!touched) return { data: input, changed: [] };
  return {
    data: { ...input, sections: { ...input.sections, inactive: { ...inaSec, rows } } },
    changed: ["inactive"],
  };
}

export function migrateData(input: AppData): { data: AppData; changed: string[] } {
  const linked = linkDrivers(input);
  const data = linked.data;
  const changed: string[] = [...linked.changed];
  const sections = { ...data.sections };
  for (const sp of SPLITS) {
    const sec = sections[sp.id];
    if (!sec || sec.headers.length !== sp.oldLen) continue;
    const ins = <T,>(a: T[], v: T) => [...a.slice(0, sp.at), v, ...a.slice(sp.at)];
    const headers = ins(sec.headers, "Future Plans");
    headers[sp.at - 1] = "Notes";
    sections[sp.id] = {
      ...sec,
      headers,
      widths: ins(sec.widths ?? [], defaultWidth("plan")),
      hidden: ins(sec.hidden ?? [], false),
      rows: sec.rows.map((r) => {
        const cells = ins(r.cells, "");
        if (sp.moveNote) {
          cells[sp.at] = cells[sp.at - 1];
          cells[sp.at - 1] = "";
        }
        return { ...r, cells };
      }),
    };
    changed.push(sp.id);
  }
  const afterSplits = changed.length ? { ...data, sections } : data;
  const normalized = normalizeSections(afterSplits);
  const afterNorm = normalized.changed.length ? normalized.data : afterSplits;
  const roster = syncInactiveRoster(afterNorm);
  const allChanged = [...new Set([...changed, ...normalized.changed, ...roster.changed])];
  return { data: allChanged.length ? roster.data : afterSplits, changed: allChanged };
}
