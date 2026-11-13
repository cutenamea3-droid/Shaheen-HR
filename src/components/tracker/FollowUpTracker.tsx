import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  filterFollowUps,
  followUpCounts,
  followUpDueLabel,
  followUpTone,
  listFollowUps,
  suggestAppliedFollowUps,
  type FollowUpStatus,
} from "@/lib/follow-ups";
import { addFollowUp, deleteFollowUp, updateFollowUp, useData } from "@/lib/store";
import { Chip } from "./cells";

const FILTERS: { id: "all" | "open" | "today" | "overdue" | "snoozed" | "done"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "today", label: "Due Today" },
  { id: "overdue", label: "Overdue" },
  { id: "snoozed", label: "Snoozed" },
  { id: "done", label: "Done" },
];

export function FollowUpTracker() {
  const data = useData();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("open");
  const [search, setSearch] = useState("");
  const [draftDriver, setDraftDriver] = useState("");
  const [draftSubject, setDraftSubject] = useState("");
  const [draftDue, setDraftDue] = useState("");

  const items = useMemo(() => listFollowUps(data), [data]);
  const filtered = useMemo(() => filterFollowUps(items, filter, search), [items, filter, search]);
  const counts = useMemo(() => followUpCounts(items), [items]);
  const appliedSuggestions = useMemo(() => suggestAppliedFollowUps(data), [data]);

  function createManual() {
    if (!draftSubject.trim()) {
      toast.error("Subject is required");
      return;
    }
    try {
      addFollowUp({
        driverId: "",
        driver: draftDriver.trim() || "Unassigned",
        subject: draftSubject.trim(),
        dueDate: draftDue.trim(),
        source: "manual",
      });
      setDraftSubject("");
      setDraftDue("");
      toast.success("Follow-up saved to cloud section");
    } catch (e) {
      toast.error("Could not save follow-up", {
        description: e instanceof Error ? e.message : "Retry",
      });
    }
  }

  function trackApplied(s: (typeof appliedSuggestions)[number]) {
    try {
      addFollowUp({
        driverId: s.driverId,
        driver: s.driver,
        subject: s.subject,
        notes: `Status: ${s.statusLabel}. Expiry: ${s.expiryDisplay}`,
        source: "applied",
        sectionId: s.sectionId,
        docType: s.docType,
      });
      toast.success("Applied follow-up tracked");
    } catch (e) {
      toast.error("Could not create follow-up", {
        description: e instanceof Error ? e.message : "Retry",
      });
    }
  }

  return (
    <div className="space-y-4 text-[15px]">
      <div className="rounded-xl border-2 border-border bg-card p-4">
        <h2 className="font-display text-lg font-extrabold">Follow-Up Tracker</h2>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          Durable via cloud <code className="text-xs">tracker_sections</code> (
          <code className="text-xs">compliance_follow_ups</code>) — not localStorage as source of truth.
          Applied items stay Applied until you update status in the editor.
        </p>

        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          <input
            value={draftDriver}
            onChange={(e) => setDraftDriver(e.target.value)}
            placeholder="Driver name"
            className="rounded-lg border-2 border-border bg-background px-3 py-2 text-sm font-semibold"
          />
          <input
            value={draftSubject}
            onChange={(e) => setDraftSubject(e.target.value)}
            placeholder="Subject *"
            className="rounded-lg border-2 border-border bg-background px-3 py-2 text-sm font-semibold sm:col-span-2"
          />
          <input
            type="date"
            value={draftDue}
            onChange={(e) => setDraftDue(e.target.value)}
            className="rounded-lg border-2 border-border bg-background px-3 py-2 text-sm font-semibold"
            aria-label="Due date"
          />
        </div>
        <button
          type="button"
          onClick={createManual}
          className="ui-press mt-2 inline-flex items-center gap-2 rounded-lg border-2 border-primary bg-primary px-3 py-2 text-sm font-bold text-primary-foreground"
        >
          <Plus className="size-4" />
          Add follow-up
        </button>
      </div>

      {appliedSuggestions.length > 0 && (
        <div className="rounded-xl border-2 border-info/40 bg-info/5 p-4">
          <h3 className="text-sm font-extrabold tracking-wide text-info uppercase">
            Applied — suggested follow-ups
          </h3>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            Does not change Application status. Track a reminder; mark Valid only when renewed.
          </p>
          <ul className="mt-3 space-y-2">
            {appliedSuggestions.slice(0, 12).map((s) => (
              <li
                key={s.key}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="font-bold">{s.driver}</div>
                  <div className="text-sm text-muted-foreground">
                    {s.docType} · {s.statusLabel} · expiry {s.expiryDisplay}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    to="/s/$sectionId"
                    params={{ sectionId: s.sectionId }}
                    search={{ row: s.rowId }}
                    className="text-sm font-bold text-primary underline"
                  >
                    Open editor
                  </Link>
                  <button
                    type="button"
                    onClick={() => trackApplied(s)}
                    className="rounded-lg border-2 border-border px-2 py-1 text-sm font-bold hover:border-primary"
                  >
                    Track follow-up
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2" role="group" aria-label="Follow-up filters">
        {FILTERS.map((f) => {
          const n = f.id === "all" ? counts.all : counts[f.id];
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                "ui-press rounded-lg border-2 px-3 py-1.5 text-sm font-bold tabular-nums",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:border-primary/60",
              )}
            >
              {f.label}
              <span className="ml-2 opacity-90">{n}</span>
            </button>
          );
        })}
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search follow-ups…"
          className="w-full rounded-lg border-2 border-border bg-card py-2 pr-3 pl-10 text-[15px] font-semibold outline-none focus:border-primary"
        />
      </div>

      {!filtered.length ? (
        <p className="rounded-xl border bg-muted/40 px-4 py-8 text-center text-sm font-semibold text-muted-foreground">
          No follow-ups in this filter.
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((fu) => (
            <li key={fu.id} className="rounded-xl border-2 border-border bg-card p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip tone={followUpTone(fu)}>{fu.status}</Chip>
                    <span className="font-display text-base font-extrabold">{fu.driver}</span>
                    {fu.docType && (
                      <span className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
                        {fu.docType}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 font-semibold">{fu.subject}</p>
                  <p className="text-sm text-muted-foreground">{followUpDueLabel(fu)}</p>
                  {fu.notes && <p className="mt-1 text-sm">{fu.notes}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {fu.sectionId && (
                    <Link
                      to="/s/$sectionId"
                      params={{ sectionId: fu.sectionId }}
                      search={{ row: fu.linkedRowId || undefined }}
                      className="text-sm font-bold text-primary underline"
                    >
                      Open section
                    </Link>
                  )}
                  <select
                    value={fu.status}
                    onChange={(e) => {
                      updateFollowUp(fu.id, { status: e.target.value as FollowUpStatus });
                      toast.success("Follow-up updated");
                    }}
                    className="rounded-lg border-2 border-border bg-background px-2 py-1 text-sm font-bold"
                    aria-label="Follow-up status"
                  >
                    <option value="open">Open</option>
                    <option value="snoozed">Snoozed</option>
                    <option value="done">Done</option>
                  </select>
                  <input
                    type="date"
                    value={fu.dueDate}
                    onChange={(e) => {
                      updateFollowUp(fu.id, { dueDate: e.target.value });
                      toast.success("Due date saved");
                    }}
                    className="rounded-lg border-2 border-border bg-background px-2 py-1 text-sm font-semibold"
                    aria-label="Due date"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      deleteFollowUp(fu.id);
                      toast.success("Follow-up removed");
                    }}
                    className="rounded-lg border-2 border-danger/40 px-2 py-1 text-sm font-bold text-danger"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
