import { useEffect, useMemo, useState } from "react";
import { ChevronDown, FolderInput, Plus, Search, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  addRecord,
  deleteRecord,
  moveRecordPerson,
  RECORD_HEADERS,
  recordPersonIsActive,
  renameRecordPerson,
  setCell,
  setRecordPersonActive,
  useData,
} from "@/lib/store";
import { useViewMode } from "@/lib/viewmode";
import { ActiveToggle, DateCell, EditableText, StatusToggle } from "./cells";
import type { Row } from "@/lib/sections";

/** Manual record lists — kept separate from the driver sections (not counted in alerts or Driver Cards). */
export const RECORD_TABS = [
  { id: "rec_drivers", label: "Drivers — Extra Documents", short: "Driver Extra Docs", who: "Driver" },
  { id: "rec_owners", label: "Owner Operators", short: "Owner Operator", who: "Owner operator" },
  { id: "rec_mechanics", label: "Mechanics", short: "Mechanic", who: "Mechanic" },
];
const STATUS = ["Valid", "On File", "Expired", "Missing", "Not Confirmed"];
type ActiveFilter = "active" | "inactive" | "all";

function nameKey(name: string) {
  return name.trim().toLowerCase();
}

type PersonGroup = {
  key: string;
  name: string;
  rows: Row[];
  active: boolean;
};

function groupByPerson(rows: Row[]): PersonGroup[] {
  const map = new Map<string, PersonGroup>();
  for (const r of rows) {
    const name = (r.cells[0] ?? "").trim() || "Unnamed";
    const key = nameKey(name);
    const g = map.get(key);
    if (g) g.rows.push(r);
    else map.set(key, { key, name, rows: [r], active: true });
  }
  for (const g of map.values()) g.active = recordPersonIsActive(g.rows);
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

function personCount(rows: Row[] | undefined) {
  if (!rows?.length) return 0;
  return new Set(rows.map((r) => nameKey(r.cells[0] ?? ""))).size;
}

export function Records() {
  const data = useData();
  const view = useViewMode();
  const [tab, setTab] = useState(RECORD_TABS[0].id);
  const [q, setQ] = useState("");
  const [name, setName] = useState("");
  const [doc, setDoc] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("active");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const cur = RECORD_TABS.find((t) => t.id === tab)!;
  const ownersTab = tab === "rec_owners";

  useEffect(() => {
    setActiveFilter("active");
  }, [tab]);

  const people = useMemo(() => {
    const rows = data.sections[tab]?.rows ?? [];
    const needle = q.trim().toLowerCase();
    const filtered = !needle
      ? rows
      : rows.filter((r) => r.cells.some((c) => c.toLowerCase().includes(needle)));
    const grouped = groupByPerson(filtered);
    if (!ownersTab || activeFilter === "all") return grouped;
    return grouped.filter((p) => (activeFilter === "active" ? p.active : !p.active));
  }, [data.sections, tab, q, ownersTab, activeFilter]);

  const add = () => {
    if (!name.trim()) return;
    addRecord(tab, [name.trim(), doc.trim(), "Valid", "", "", "Active"]);
    setDoc("");
    setOpen((o) => ({ ...o, [`${tab}:${nameKey(name)}`]: true }));
  };

  const cardId = (key: string) => `${tab}:${key}`;
  const toggle = (key: string) => {
    const id = cardId(key);
    setOpen((o) => {
      const currently = id in o ? !!o[id] : !!q.trim();
      return { ...o, [id]: !currently };
    });
  };
  const isOpen = (key: string) => {
    const id = cardId(key);
    if (id in open) return !!open[id];
    return !!q.trim();
  };

  const shiftCategory = (personName: string, toId: string) => {
    if (toId === tab) return;
    moveRecordPerson(tab, toId, personName);
    setTab(toId);
    setOpen((o) => ({ ...o, [`${toId}:${nameKey(personName)}`]: true }));
  };

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden p-2">
      <div className="flex flex-wrap gap-2">
        {RECORD_TABS.map((t) => {
          const docs = data.sections[t.id]?.rows.length ?? 0;
          const peopleN = personCount(data.sections[t.id]?.rows);
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "ui-press rounded-xl border-2 px-4 py-2 text-base font-bold",
                tab === t.id ? "border-primary bg-brand text-primary-foreground" : "bg-card hover:border-primary",
              )}
            >
              {t.label}{" "}
              <span className="ml-1 opacity-80">
                ({peopleN}
                {docs !== peopleN ? ` · ${docs}` : ""})
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-sm text-muted-foreground">
        Grouped by person — expand a card to edit documents. Use Move to shift someone between Driver Extra Docs, Owner Operator, and Mechanic without losing files.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search…"
            className="h-10 w-full rounded-xl border bg-card pr-3 pl-9"
          />
        </div>
        {ownersTab && (
          <div className="inline-flex rounded-xl border-2 bg-card p-1 shadow-card">
            {(["active", "inactive", "all"] as ActiveFilter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setActiveFilter(f)}
                className={cn(
                  "ui-press rounded-lg px-3 py-1.5 text-sm font-bold capitalize",
                  activeFilter === f ? "bg-brand text-primary-foreground shadow-card" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {f}
              </button>
            ))}
          </div>
        )}
        {!view && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              add();
            }}
            className="flex flex-wrap items-center gap-2"
          >
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`${cur.who} name`}
              className="h-10 w-52 rounded-xl border bg-card px-3"
            />
            <input
              value={doc}
              onChange={(e) => setDoc(e.target.value)}
              placeholder="Document (e.g. TWIC card)"
              className="h-10 w-56 rounded-xl border bg-card px-3"
            />
            <button
              type="submit"
              disabled={!name.trim()}
              className="ui-press inline-flex h-10 items-center gap-2 rounded-xl bg-brand px-4 font-bold text-primary-foreground disabled:opacity-50"
            >
              <Plus className="size-4" /> Add record
            </button>
          </form>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-auto pr-1">
        {people.map((p, i) => {
          const cardKey = `${tab}:${p.key}`;
          const expanded = isOpen(p.key);
          return (
            <article
              key={cardKey}
              className={cn(
                "ui-lift overflow-hidden rounded-2xl border bg-card shadow-card",
                ownersTab && !p.active && "opacity-70",
              )}
              style={{ animationDelay: `${Math.min(i, 12) * 28}ms` }}
            >
              <div className="flex flex-wrap items-center gap-3 border-b border-border/60 bg-muted/30 px-4 py-3">
                <button
                  type="button"
                  onClick={() => toggle(p.key)}
                  className="ui-press flex min-w-0 flex-1 items-center gap-3 text-left"
                  aria-expanded={expanded}
                >
                  <span
                    className={cn(
                      "inline-flex size-8 shrink-0 items-center justify-center rounded-xl border bg-card transition-transform",
                      expanded && "rotate-180",
                    )}
                  >
                    <ChevronDown className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-lg font-extrabold tracking-tight">{p.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {p.rows.length} document{p.rows.length === 1 ? "" : "s"}
                      {ownersTab ? ` · ${p.active ? "Active" : "Inactive"}` : ""}
                    </span>
                  </span>
                </button>

                <span className="rounded-lg border border-primary/25 bg-brand/10 px-2.5 py-1 text-xs font-bold tracking-wide text-primary uppercase">
                  {cur.short}
                </span>

                {ownersTab && (
                  <ActiveToggle
                    value={p.active ? "Active" : "Inactive"}
                    onSave={(v) => setRecordPersonActive(tab, p.name, v)}
                  />
                )}

                {!view && (
                  <label className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
                    <FolderInput className="size-4 shrink-0" />
                    <span className="sr-only">Move category</span>
                    <select
                      aria-label={`Move ${p.name} to another category`}
                      className="ui-press h-9 max-w-[14rem] rounded-xl border bg-card px-2 font-semibold text-foreground"
                      value={tab}
                      onChange={(e) => shiftCategory(p.name, e.target.value)}
                    >
                      {RECORD_TABS.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.short}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>

              {expanded && (
                <div className="space-y-3 p-4">
                  {!view && (
                    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-dashed border-border/80 bg-muted/20 p-3">
                      <div className="min-w-[12rem] flex-1">
                        <div className="mb-1 text-xs font-bold tracking-wide text-muted-foreground uppercase">
                          {RECORD_HEADERS[0]}
                        </div>
                        <EditableText
                          value={p.name}
                          onSave={(v) => renameRecordPerson(tab, p.name, v)}
                          bold
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Renaming updates every document under this person.
                      </p>
                    </div>
                  )}

                  <div className="overflow-x-auto rounded-xl border">
                    <table className="w-full border-collapse">
                      <thead className="bg-brand text-primary-foreground">
                        <tr>
                          <th className="px-3 py-2 text-left text-sm font-extrabold tracking-wide uppercase">#</th>
                          <th className="px-3 py-2 text-left text-sm font-extrabold tracking-wide uppercase">
                            {RECORD_HEADERS[1]}
                          </th>
                          <th className="px-3 py-2 text-left text-sm font-extrabold tracking-wide uppercase">
                            {RECORD_HEADERS[2]}
                          </th>
                          <th className="px-3 py-2 text-left text-sm font-extrabold tracking-wide uppercase">
                            {RECORD_HEADERS[3]}
                          </th>
                          <th className="px-3 py-2 text-left text-sm font-extrabold tracking-wide uppercase">
                            {RECORD_HEADERS[4]}
                          </th>
                          <th className="px-3 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {p.rows.map((r, ri) => {
                          const save = (ci: number) => (v: string) => setCell(tab, r.id, ci, v);
                          return (
                            <tr key={r.id} className="ui-row-hover">
                              <td className="border-b border-r border-foreground/15 px-3 py-2 align-top font-bold">
                                {ri + 1}
                              </td>
                              <td className="border-b border-r border-foreground/15 px-3 py-2 align-top">
                                <EditableText value={r.cells[1] ?? ""} onSave={save(1)} />
                              </td>
                              <td className="border-b border-r border-foreground/15 px-3 py-2 align-top">
                                <StatusToggle value={r.cells[2] ?? ""} options={STATUS} onSave={save(2)} />
                              </td>
                              <td className="border-b border-r border-foreground/15 px-3 py-2 align-top">
                                <DateCell value={r.cells[3] ?? ""} onSave={save(3)} />
                              </td>
                              <td className="border-b border-r border-foreground/15 px-3 py-2 align-top">
                                <EditableText
                                  value={r.cells[4] ?? ""}
                                  onSave={save(4)}
                                  placeholder="Add note"
                                  boxed
                                />
                              </td>
                              <td className="border-b border-foreground/15 px-3 py-2 align-top">
                                {!view && (
                                  <button
                                    type="button"
                                    aria-label="Delete document"
                                    onClick={() =>
                                      confirm(`Delete “${r.cells[1] || "document"}” for ${p.name}?`) &&
                                      deleteRecord(tab, r.id)
                                    }
                                    className="ui-press rounded-lg p-2 text-muted-foreground hover:bg-danger-soft hover:text-danger"
                                  >
                                    <Trash2 className="size-5" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </article>
          );
        })}

        {!people.length && (
          <div className="ui-lift rounded-2xl border bg-card p-10 text-center text-lg text-muted-foreground shadow-card">
            No records yet — add the first one above.
          </div>
        )}
      </div>
    </div>
  );
}
