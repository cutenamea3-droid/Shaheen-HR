import { useEffect, useMemo, useState } from "react";
import { History, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useData } from "@/lib/store";
import { listPortalActivity } from "@/lib/cloud";
import { listLocalActivity } from "@/lib/portal-local";
import { listSensitiveAudit } from "@/lib/driver-hr/sensitive-audit";
import {
  buildComplianceHistory,
  complianceHistoryEmptyMessage,
  historySourceLabel,
  type ComplianceHistoryEvent,
} from "@/lib/compliance-history";
import { SECTIONS } from "@/lib/sections";

export function ComplianceHistoryPanel() {
  const data = useData();
  const [q, setQ] = useState("");
  const [driverId, setDriverId] = useState<string>("");
  const [portal, setPortal] = useState<
    { id: string | number; actor_name: string; action: string; section_id: string; occurred_at: string }[]
  >([]);
  const [portalNote, setPortalNote] = useState("");

  useEffect(() => {
    let active = true;
    void listPortalActivity()
      .then((items) => {
        if (!active) return;
        setPortal(items);
        setPortalNote("");
      })
      .catch(() => {
        if (!active) return;
        setPortal(listLocalActivity(500));
        setPortalNote("Cloud activity unavailable — showing local activity cache only.");
      });
    return () => {
      active = false;
    };
  }, []);

  const drivers = useMemo(() => {
    const map = new Map<string, string>();
    for (const def of SECTIONS) {
      for (const r of data.sections[def.id]?.rows ?? []) {
        const n = (r.cells[0] ?? "").trim();
        if (n && !map.has(r.driverId)) map.set(r.driverId, n);
      }
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }, [data]);

  const events = useMemo(() => {
    const sensitive = listSensitiveAudit(200);
    return buildComplianceHistory(data, {
      portalActivity: portal,
      sensitiveAudit: sensitive,
      ...(driverId ? { driverId } : {}),
      limit: 300,
    });
  }, [data, portal, driverId]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return events;
    return events.filter(
      (e) =>
        e.title.toLowerCase().includes(qq) ||
        e.detail.toLowerCase().includes(qq) ||
        (e.actor ?? "").toLowerCase().includes(qq) ||
        historySourceLabel(e.source).toLowerCase().includes(qq),
    );
  }, [events, q]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border-2 border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <div className="grid size-10 place-items-center rounded-lg bg-secondary text-secondary-foreground">
            <History className="size-5" />
          </div>
          <div>
            <h2 className="font-display text-xl font-extrabold">Compliance History</h2>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">
              Timeline from existing audit sources only (Add Driver timestamps, class/roster history,
              portal activity, sensitive rate/drug audit). No invented history.
            </p>
            {portalNote && <p className="mt-2 text-sm font-semibold text-warn">{portalNote}</p>}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <label className="text-sm font-bold">
          Driver
          <select
            value={driverId}
            onChange={(e) => setDriverId(e.target.value)}
            className="ml-2 rounded-lg border-2 border-border bg-card px-3 py-2 font-semibold outline-none focus:border-primary"
          >
            <option value="">All drivers</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <div className="relative min-w-[220px] flex-1 max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search timeline…"
            className="w-full rounded-lg border-2 border-border bg-card py-2 pr-3 pl-10 text-[15px] font-semibold outline-none focus:border-primary"
            aria-label="Search compliance history"
          />
        </div>
      </div>

      {!filtered.length ? (
        <p className="rounded-xl border-2 border-border bg-muted/40 px-5 py-8 text-center text-sm font-semibold text-muted-foreground">
          {complianceHistoryEmptyMessage(!!driverId)}
        </p>
      ) : (
        <ol className="space-y-0 border-l-2 border-border ml-3">
          {filtered.map((e) => (
            <HistoryRow key={e.id} event={e} />
          ))}
        </ol>
      )}
    </div>
  );
}

function HistoryRow({ event }: { event: ComplianceHistoryEvent }) {
  return (
    <li className="relative mb-4 pl-6">
      <span className="absolute top-2 -left-[7px] size-3 rounded-full border-2 border-primary bg-card" />
      <div className="rounded-xl border-2 border-border bg-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-extrabold">
            {historySourceLabel(event.source)}
          </span>
          <time className="text-xs font-semibold text-muted-foreground" dateTime={new Date(event.at).toISOString()}>
            {event.atLabel}
          </time>
        </div>
        <p className="mt-1 font-extrabold">{event.title}</p>
        <p className="text-sm text-muted-foreground">{event.detail}</p>
        {(event.actor || event.sectionId) && (
          <p className={cn("mt-1 text-xs font-semibold text-muted-foreground")}>
            {event.actor ? `Actor: ${event.actor}` : ""}
            {event.actor && event.sectionId ? " · " : ""}
            {event.sectionId ? `Section: ${event.sectionId}` : ""}
          </p>
        )}
      </div>
    </li>
  );
}
