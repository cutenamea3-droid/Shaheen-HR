import { useEffect, useMemo, useState } from "react";
import {
  ClipboardList,
  FileWarning,
  History,
  LayoutDashboard,
  LogOut,
  MapPin,
  PhoneCall,
  RefreshCw,
  Truck,
  Users,
  UserCog,
  Handshake,
} from "lucide-react";
import { LoginGate } from "@/dispatch/components/LoginGate";
import { EmptyHint, SectionHelp, StaleBadge } from "@/dispatch/components/EmptyHint";
import {
  getDispatchAccount,
  inviteDispatchUser,
  isDispatchPreviewMode,
  listDispatchAccounts,
  setDispatchAccess,
  signOutDispatch,
} from "@/dispatch/lib/auth";
import {
  addCheckCall,
  driverLoadHistory,
  listCheckCalls,
  listExceptions,
  listHandovers,
  listIssues,
  listLoads,
  listRosterDrivers,
  saveException,
  saveHandover,
  saveIssue,
  saveLoad,
  upsertRosterDriver,
} from "@/dispatch/lib/cloud";
import { exportHandoverPdf, exportLoadsCsv, exportLoadsPdf } from "@/dispatch/lib/reports";
import {
  activeLoadsBoardColumns,
  filterLoads,
  homeActionBuckets,
  isStaleUpdate,
  statusLabel,
} from "@/dispatch/lib/status";
import type {
  DispatchAccount,
  DispatchLoad,
  DispatchView,
  DocStatus,
  LoadStatus,
  LoadStop,
  RosterDriver,
  ShiftHandover,
} from "@/dispatch/lib/types";
import { ACTIVE_LOAD_STATUSES, LOAD_STATUS_LABELS } from "@/dispatch/lib/types";

const NAV: { id: DispatchView; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "home", label: "My Dispatch Today", icon: LayoutDashboard },
  { id: "loads", label: "Active Loads", icon: Truck },
  { id: "updates", label: "Driver Updates", icon: PhoneCall },
  { id: "handover", label: "Shift Handover", icon: Handshake },
  { id: "issues", label: "Issues", icon: FileWarning },
  { id: "roster", label: "Roster", icon: Users },
  { id: "history", label: "Driver history", icon: History },
  { id: "reports", label: "Reports", icon: ClipboardList },
  { id: "team", label: "Team", icon: UserCog },
];

function blankStops(): LoadStop[] {
  return [
    {
      sequence: 1,
      stop_type: "pickup",
      name: "",
      address: "",
      city: "",
      state: "",
      postal_code: "",
      planned_at: null,
      actual_at: null,
      notes: "",
    },
    {
      sequence: 2,
      stop_type: "delivery",
      name: "",
      address: "",
      city: "",
      state: "",
      postal_code: "",
      planned_at: null,
      actual_at: null,
      notes: "",
    },
  ];
}

export function DispatchApp() {
  const [account, setAccount] = useState<DispatchAccount | null>(null);
  const [booting, setBooting] = useState(true);
  const [view, setView] = useState<DispatchView>("home");
  const [loads, setLoads] = useState<DispatchLoad[]>([]);
  const [drivers, setDrivers] = useState<RosterDriver[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const [nextLoads, nextDrivers] = await Promise.all([listLoads(), listRosterDrivers()]);
    setLoads(nextLoads);
    setDrivers(nextDrivers);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const acc = await getDispatchAccount();
        if (cancelled) return;
        setAccount(acc);
        if (acc) await refresh();
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load Dispatch.");
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = useMemo(
    () => loads.find((l) => l.id === selectedId) ?? null,
    [loads, selectedId],
  );

  if (booting) {
    return (
      <div className="dispatch-theme flex min-h-[calc(100vh-44px)] items-center justify-center text-sm text-[color:var(--dispatch-muted)]">
        Loading Dispatch…
      </div>
    );
  }

  if (!account) {
    return (
      <div className="dispatch-theme">
        <LoginGate
          onSignedIn={async (acc) => {
            setAccount(acc);
            await refresh();
          }}
        />
      </div>
    );
  }

  return (
    <div className="dispatch-theme min-h-[calc(100vh-44px)]">
      <div className="dispatch-shell mx-auto flex max-w-[1400px] gap-0 md:gap-4 md:px-4 md:py-4">
        <aside className="dispatch-side hidden w-56 shrink-0 flex-col rounded-2xl border border-[color:var(--dispatch-border)] bg-[color:var(--dispatch-navy)] p-3 text-white md:flex">
          <div className="px-2 pb-3 pt-1">
            <p className="font-display text-lg font-bold leading-tight">Shaheen</p>
            <p className="text-xs text-white/70">Dispatch Operations</p>
          </div>
          <nav className="flex flex-1 flex-col gap-1" aria-label="Dispatch">
            {NAV.map((item) => {
              if (item.id === "team" && account.role !== "admin") return null;
              const Icon = item.icon;
              const on =
                view === item.id ||
                (item.id === "loads" && view === "load") ||
                (item.id === "updates" && view === "load");
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`dispatch-nav ${on ? "dispatch-nav-on" : ""}`}
                  onClick={() => {
                    setView(item.id);
                    if (item.id !== "load") setSelectedId(null);
                  }}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>
          <div className="mt-3 border-t border-white/15 px-2 pt-3 text-xs text-white/70">
            <p className="font-medium text-white">{account.display_name}</p>
            <p>{account.role === "admin" ? "Dispatch admin" : "Dispatcher"}</p>
            {isDispatchPreviewMode() && <p className="mt-1 text-amber-200">Fixture mode</p>}
            <button
              type="button"
              className="mt-3 inline-flex items-center gap-1 text-white/80 hover:text-white"
              onClick={async () => {
                await signOutDispatch();
                setAccount(null);
              }}
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-3 py-3 md:px-0 md:py-0">
          <header className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[color:var(--dispatch-border)] bg-[color:var(--dispatch-card)] px-3 py-2.5">
            <div>
              <h1 className="font-display text-xl font-bold text-[color:var(--dispatch-navy)]">
                Dispatch Operations
              </h1>
              <p className="text-sm text-[color:var(--dispatch-muted)]">
                My Dispatch Today · Active Loads · Manual location &amp; check-calls only (never Live GPS)
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="dispatch-btn-ghost"
                onClick={async () => {
                  setBusy(true);
                  try {
                    await refresh();
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <RefreshCw className="h-4 w-4" /> Refresh
              </button>
              <button
                type="button"
                className="dispatch-btn-primary"
                onClick={() => {
                  setSelectedId(null);
                  setView("load");
                }}
              >
                Add Load
              </button>
            </div>
          </header>

          <div className="mb-3 flex gap-1 overflow-x-auto rounded-lg border border-[color:var(--dispatch-border)] bg-[color:var(--dispatch-card)] p-1 md:hidden">
            {NAV.filter((n) => n.id !== "team" || account.role === "admin").map((item) => (
              <button
                key={item.id}
                type="button"
                className={`whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-semibold ${
                  view === item.id ||
                  (item.id === "loads" && view === "load") ||
                  (item.id === "updates" && view === "load")
                    ? "bg-[color:var(--dispatch-orange)] text-white"
                    : "text-[color:var(--dispatch-muted)]"
                }`}
                onClick={() => setView(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          {error && (
            <p role="alert" className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          {view === "home" && (
            <HomeBoard
              loads={loads}
              onOpen={(id) => {
                setSelectedId(id);
                setView("load");
              }}
            />
          )}
          {view === "loads" && (
            <LoadsBoard
              loads={loads}
              drivers={drivers}
              onAddLoad={() => {
                setSelectedId(null);
                setView("load");
              }}
              onOpen={(id) => {
                setSelectedId(id);
                setView("load");
              }}
            />
          )}
          {view === "updates" && (
            <DriverUpdatesBoard
              loads={loads}
              onOpen={(id) => {
                setSelectedId(id);
                setView("load");
              }}
              onRefresh={refresh}
            />
          )}
          {view === "load" && (
            <LoadEditor
              key={selected?.id ?? "new"}
              load={selected}
              drivers={drivers}
              busy={busy}
              onCancel={() => setView("loads")}
              onSaved={async (saved) => {
                setBusy(true);
                setError(null);
                try {
                  const next = await saveLoad(saved);
                  await refresh();
                  setSelectedId(next.id);
                  setView("load");
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Could not save load.");
                } finally {
                  setBusy(false);
                }
              }}
            />
          )}
          {view === "roster" && (
            <RosterBoard
              drivers={drivers}
              onSave={async (row) => {
                await upsertRosterDriver(row);
                await refresh();
              }}
            />
          )}
          {view === "handover" && (
            <HandoverBoard
              loads={loads}
              account={account}
              onSaved={async () => refresh()}
            />
          )}
          {view === "issues" && <IssuesBoard loads={loads} />}
          {view === "history" && (
            <HistoryBoard
              loads={loads}
              drivers={drivers}
              onOpen={(id) => {
                setSelectedId(id);
                setView("load");
              }}
            />
          )}
          {view === "reports" && <ReportsBoard loads={loads} />}
          {view === "team" && account.role === "admin" && <TeamBoard account={account} />}
        </main>
      </div>
    </div>
  );
}

function HomeBoard({ loads, onOpen }: { loads: DispatchLoad[]; onOpen: (id: string) => void }) {
  const buckets = homeActionBuckets(loads);
  const sections = [
    { title: "Needs update / check-call", items: buckets.needsUpdate, help: "Stale or missing manual location." },
    { title: "Open exceptions", items: buckets.openExceptions, help: "Exceptions are separate from load status." },
    { title: "Awaiting BOL / POD", items: buckets.awaitingDocs, help: "BOL and POD statuses are independent." },
    { title: "In motion", items: buckets.inMotion, help: "Assigned through at-delivery." },
  ];
  return (
    <div className="grid gap-3">
      <SectionHelp>
        My Dispatch Today prioritizes action lists over counters. Delivered is not Closed — close only after file work
        is done. No invented ETAs or GPS.
      </SectionHelp>
      {sections.map((section) => (
        <section key={section.title} className="dispatch-panel">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold text-[color:var(--dispatch-navy)]">{section.title}</h2>
            <span className="text-xs text-[color:var(--dispatch-muted)]">{section.items.length}</span>
          </div>
          <p className="mb-2 text-xs text-[color:var(--dispatch-muted)]">{section.help}</p>
          {!section.items.length ? (
            <EmptyHint>Nothing in this list.</EmptyHint>
          ) : (
            <ul className="divide-y divide-[color:var(--dispatch-border)]">
              {section.items.map((load) => (
                <li key={load.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div>
                    <p className="text-sm font-semibold">
                      {load.load_number}{" "}
                      <span className="font-normal text-[color:var(--dispatch-muted)]">
                        · {statusLabel(load.status)}
                      </span>
                    </p>
                    <p className="text-xs text-[color:var(--dispatch-muted)]">
                      {load.assigned_driver_name || "Unassigned"} · {load.last_manual_location || "No manual location"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isStaleUpdate(load) && <StaleBadge />}
                    <button type="button" className="dispatch-btn-primary" onClick={() => onOpen(load.id)}>
                      Update Load
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

function LoadsBoard({
  loads,
  drivers,
  onOpen,
  onAddLoad,
}: {
  loads: DispatchLoad[];
  drivers: RosterDriver[];
  onOpen: (id: string) => void;
  onAddLoad: () => void;
}) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<LoadStatus | "all" | "active">("active");
  const [driverId, setDriverId] = useState<string | "all">("all");
  const [exceptionOnly, setExceptionOnly] = useState(false);
  const [layout, setLayout] = useState<"table" | "board">("table");
  const filtered = filterLoads(loads, { q, status, driverId, exceptionOnly });
  const boardColumns = activeLoadsBoardColumns(
    filterLoads(loads, { q, status: "active", driverId, exceptionOnly }),
  );

  return (
    <section className="dispatch-panel">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <SectionHelp>
          Active Loads — table or desk board. Cloud-backed when SQL is applied; never invents milestones, locations, or
          ETAs.
        </SectionHelp>
        <div className="flex flex-wrap gap-2">
          <div className="inline-flex rounded-md border border-[color:var(--dispatch-border)] p-0.5">
            <button
              type="button"
              className={`rounded px-2.5 py-1 text-xs font-semibold ${
                layout === "table" ? "bg-[color:var(--dispatch-orange)] text-white" : "text-[color:var(--dispatch-muted)]"
              }`}
              onClick={() => setLayout("table")}
            >
              Table
            </button>
            <button
              type="button"
              className={`rounded px-2.5 py-1 text-xs font-semibold ${
                layout === "board" ? "bg-[color:var(--dispatch-orange)] text-white" : "text-[color:var(--dispatch-muted)]"
              }`}
              onClick={() => setLayout("board")}
            >
              Board
            </button>
          </div>
          <button type="button" className="dispatch-btn-primary" onClick={onAddLoad}>
            Add Load
          </button>
        </div>
      </div>
      <div className="mb-3 grid gap-2 sm:grid-cols-4">
        <input
          className="dispatch-field sm:col-span-2"
          placeholder="Search load, customer, driver, location…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="dispatch-field" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="active">Active</option>
          <option value="all">All statuses</option>
          {Object.entries(LOAD_STATUS_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
        <select
          className="dispatch-field"
          value={driverId}
          onChange={(e) => setDriverId(e.target.value as typeof driverId)}
        >
          <option value="all">All drivers</option>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.display_name}
            </option>
          ))}
        </select>
      </div>
      <label className="mb-3 inline-flex items-center gap-2 text-sm">
        <input type="checkbox" checked={exceptionOnly} onChange={(e) => setExceptionOnly(e.target.checked)} />
        Exceptions only
      </label>
      {layout === "board" ? (
        <div className="dispatch-load-board flex gap-3 overflow-x-auto pb-2">
          {boardColumns.map((col) => (
            <div
              key={col.status}
              className="w-56 shrink-0 rounded-lg border border-[color:var(--dispatch-border)] bg-[color:var(--dispatch-soft)] p-2"
            >
              <div className="mb-2 flex items-baseline justify-between gap-2 px-1">
                <h3 className="text-xs font-bold uppercase tracking-wide text-[color:var(--dispatch-navy)]">
                  {col.label}
                </h3>
                <span className="text-[10px] text-[color:var(--dispatch-muted)]">{col.items.length}</span>
              </div>
              <ul className="grid gap-2">
                {col.items.map((load) => (
                  <li
                    key={load.id}
                    className="rounded-md border border-[color:var(--dispatch-border)] bg-[color:var(--dispatch-card)] p-2"
                  >
                    <p className="text-sm font-semibold">{load.load_number}</p>
                    <p className="text-xs text-[color:var(--dispatch-muted)]">
                      {load.assigned_driver_name || "Unassigned"}
                    </p>
                    <p className="mt-1 flex items-start gap-1 text-[11px] text-[color:var(--dispatch-muted)]">
                      <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                      {load.last_manual_location || "No manual location"}
                    </p>
                    {isStaleUpdate(load) && (
                      <div className="mt-1">
                        <StaleBadge />
                      </div>
                    )}
                    <button
                      type="button"
                      className="dispatch-btn-primary mt-2 w-full"
                      onClick={() => onOpen(load.id)}
                    >
                      Update Load
                    </button>
                  </li>
                ))}
                {!col.items.length && <EmptyHint>Empty</EmptyHint>}
              </ul>
            </div>
          ))}
        </div>
      ) : !filtered.length ? (
        <EmptyHint>No loads match.</EmptyHint>
      ) : (
        <div className="overflow-x-auto">
          <table className="dispatch-table">
            <thead>
              <tr>
                <th>Load</th>
                <th>Status</th>
                <th>Driver</th>
                <th>BOL / POD</th>
                <th>Manual location</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((load) => (
                <tr key={load.id}>
                  <td>
                    <div className="font-semibold">{load.load_number}</div>
                    <div className="text-xs text-[color:var(--dispatch-muted)]">{load.customer_name}</div>
                  </td>
                  <td>
                    {statusLabel(load.status)}
                    {load.exception_open && (
                      <div className="text-xs font-semibold text-amber-800">Exception open</div>
                    )}
                    {isStaleUpdate(load) && (
                      <div className="mt-1">
                        <StaleBadge />
                      </div>
                    )}
                  </td>
                  <td>{load.assigned_driver_name || "—"}</td>
                  <td className="text-xs">
                    BOL {load.bol_status}
                    <br />
                    POD {load.pod_status}
                  </td>
                  <td className="text-xs">{load.last_manual_location || "—"}</td>
                  <td>
                    <button type="button" className="dispatch-btn-primary" onClick={() => onOpen(load.id)}>
                      Update Load
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function DriverUpdatesBoard({
  loads,
  onOpen,
  onRefresh,
}: {
  loads: DispatchLoad[];
  onOpen: (id: string) => void;
  onRefresh: () => Promise<void>;
}) {
  const active = loads.filter((l) => ACTIVE_LOAD_STATUSES.includes(l.status) || l.status === "delivered");
  const [drafts, setDrafts] = useState<Record<string, { location: string; notes: string }>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function draftFor(id: string) {
    return drafts[id] ?? { location: "", notes: "" };
  }

  return (
    <section className="dispatch-panel grid gap-3">
      <SectionHelp>
        Driver Updates are manual-first: enter location and check-call notes from the desk phone. Never labeled Live
        GPS. No invented milestones or ETAs.
      </SectionHelp>
      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {!active.length ? (
        <EmptyHint>No active loads for updates.</EmptyHint>
      ) : (
        <ul className="grid gap-3">
          {active.map((load) => {
            const draft = draftFor(load.id);
            return (
              <li
                key={load.id}
                className="grid gap-2 rounded-lg border border-[color:var(--dispatch-border)] p-3 sm:grid-cols-[1fr_auto]"
              >
                <div>
                  <p className="text-sm font-semibold">
                    {load.load_number}{" "}
                    <span className="font-normal text-[color:var(--dispatch-muted)]">
                      · {statusLabel(load.status)} · {load.assigned_driver_name || "Unassigned"}
                    </span>
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-[color:var(--dispatch-muted)]">
                    <MapPin className="h-3.5 w-3.5" />
                    Last manual: {load.last_manual_location || "—"}
                    {load.last_manual_location_at
                      ? ` · ${new Date(load.last_manual_location_at).toLocaleString()}`
                      : ""}
                  </p>
                  {isStaleUpdate(load) && (
                    <div className="mt-1">
                      <StaleBadge />
                    </div>
                  )}
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <label className="grid gap-1 text-xs">
                      Manual location
                      <input
                        className="dispatch-field"
                        value={draft.location}
                        onChange={(e) =>
                          setDrafts((d) => ({
                            ...d,
                            [load.id]: { ...draftFor(load.id), location: e.target.value },
                          }))
                        }
                        placeholder="City, mile marker, yard…"
                      />
                    </label>
                    <label className="grid gap-1 text-xs">
                      Check-call notes
                      <input
                        className="dispatch-field"
                        value={draft.notes}
                        onChange={(e) =>
                          setDrafts((d) => ({
                            ...d,
                            [load.id]: { ...draftFor(load.id), notes: e.target.value },
                          }))
                        }
                        placeholder="What the driver reported"
                      />
                    </label>
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:items-end">
                  <button
                    type="button"
                    className="dispatch-btn-primary"
                    disabled={busyId === load.id || (!draft.location.trim() && !draft.notes.trim())}
                    onClick={async () => {
                      setBusyId(load.id);
                      setError(null);
                      try {
                        const location = draft.location.trim();
                        const notes = draft.notes.trim() || "Manual check-call";
                        await addCheckCall({
                          load_id: load.id,
                          notes,
                          manual_location: location || null,
                        });
                        if (location) {
                          await saveLoad({
                            id: load.id,
                            load_number: load.load_number,
                            status: load.status,
                            last_manual_location: location,
                            last_manual_location_at: new Date().toISOString(),
                            assigned_driver_id: load.assigned_driver_id,
                            assigned_driver_name: load.assigned_driver_name,
                          });
                        }
                        setDrafts((d) => {
                          const next = { ...d };
                          delete next[load.id];
                          return next;
                        });
                        await onRefresh();
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "Could not save driver update.");
                      } finally {
                        setBusyId(null);
                      }
                    }}
                  >
                    <PhoneCall className="h-4 w-4" /> Save check-call
                  </button>
                  <button type="button" className="dispatch-btn-ghost" onClick={() => onOpen(load.id)}>
                    Open load
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function LoadEditor({
  load,
  drivers,
  busy,
  onSaved,
  onCancel,
}: {
  load: DispatchLoad | null;
  drivers: RosterDriver[];
  busy: boolean;
  onSaved: (input: Parameters<typeof saveLoad>[0]) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(() => ({
    id: load?.id,
    load_number: load?.load_number ?? "",
    customer_name: load?.customer_name ?? "",
    commodity: load?.commodity ?? "",
    equipment: load?.equipment ?? "",
    notes: load?.notes ?? "",
    status: (load?.status ?? "planned") as LoadStatus,
    exception_open: load?.exception_open ?? false,
    bol_status: (load?.bol_status ?? "missing") as DocStatus,
    pod_status: (load?.pod_status ?? "missing") as DocStatus,
    assigned_driver_id: load?.assigned_driver_id ?? "",
    external_ref_label: load?.external_ref_label ?? "",
    external_ref_url: load?.external_ref_url ?? "",
    planned_pickup_at: load?.planned_pickup_at?.slice(0, 16) ?? "",
    actual_pickup_at: load?.actual_pickup_at?.slice(0, 16) ?? "",
    planned_delivery_at: load?.planned_delivery_at?.slice(0, 16) ?? "",
    actual_delivery_at: load?.actual_delivery_at?.slice(0, 16) ?? "",
    last_manual_location: load?.last_manual_location ?? "",
    stale_after_minutes: load?.stale_after_minutes ?? 180,
    stops: load?.stops?.length ? structuredClone(load.stops) : blankStops(),
  }));
  const [checkNotes, setCheckNotes] = useState("");
  const [checkLocation, setCheckLocation] = useState("");
  const [calls, setCalls] = useState<Awaited<ReturnType<typeof listCheckCalls>>>([]);
  const [excKind, setExcKind] = useState("Delay");
  const [excNotes, setExcNotes] = useState("");

  useEffect(() => {
    if (!load?.id) return;
    void listCheckCalls(load.id).then(setCalls);
  }, [load?.id]);

  function setStop(i: number, patch: Partial<LoadStop>) {
    setForm((f) => {
      const stops = [...f.stops];
      stops[i] = { ...stops[i], ...patch };
      return { ...f, stops };
    });
  }

  return (
    <section className="dispatch-panel grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-[color:var(--dispatch-navy)]">
          {load ? `Update Load ${load.load_number}` : "Add Load"}
        </h2>
        <button type="button" className="dispatch-btn-ghost" onClick={onCancel}>
          Back to loads
        </button>
      </div>
      <SectionHelp>
        Keep planned vs actual timestamps. Manual location is dispatcher-entered — never labeled Live GPS. External load
        apps are reference links only.
      </SectionHelp>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          Load number
          <input
            className="dispatch-field"
            value={form.load_number}
            onChange={(e) => setForm({ ...form, load_number: e.target.value })}
            required
          />
        </label>
        <label className="grid gap-1 text-sm">
          Status
          <select
            className="dispatch-field"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as LoadStatus })}
          >
            {Object.entries(LOAD_STATUS_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Customer
          <input
            className="dispatch-field"
            value={form.customer_name}
            onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Assign roster driver
          <select
            className="dispatch-field"
            value={form.assigned_driver_id}
            onChange={(e) => setForm({ ...form, assigned_driver_id: e.target.value })}
          >
            <option value="">Unassigned</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.display_name}
                {d.unit_number ? ` · #${d.unit_number}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Commodity
          <input
            className="dispatch-field"
            value={form.commodity}
            onChange={(e) => setForm({ ...form, commodity: e.target.value })}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Equipment
          <input
            className="dispatch-field"
            value={form.equipment}
            onChange={(e) => setForm({ ...form, equipment: e.target.value })}
          />
        </label>
        <label className="grid gap-1 text-sm">
          BOL status
          <select
            className="dispatch-field"
            value={form.bol_status}
            onChange={(e) => setForm({ ...form, bol_status: e.target.value as DocStatus })}
          >
            {["missing", "pending", "received", "verified", "exception"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          POD status
          <select
            className="dispatch-field"
            value={form.pod_status}
            onChange={(e) => setForm({ ...form, pod_status: e.target.value as DocStatus })}
          >
            {["missing", "pending", "received", "verified", "exception"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Planned pickup
          <input
            className="dispatch-field"
            type="datetime-local"
            value={form.planned_pickup_at}
            onChange={(e) => setForm({ ...form, planned_pickup_at: e.target.value })}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Actual pickup
          <input
            className="dispatch-field"
            type="datetime-local"
            value={form.actual_pickup_at}
            onChange={(e) => setForm({ ...form, actual_pickup_at: e.target.value })}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Planned delivery
          <input
            className="dispatch-field"
            type="datetime-local"
            value={form.planned_delivery_at}
            onChange={(e) => setForm({ ...form, planned_delivery_at: e.target.value })}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Actual delivery
          <input
            className="dispatch-field"
            type="datetime-local"
            value={form.actual_delivery_at}
            onChange={(e) => setForm({ ...form, actual_delivery_at: e.target.value })}
          />
        </label>
        <label className="grid gap-1 text-sm sm:col-span-2">
          Manual location (never Live GPS)
          <input
            className="dispatch-field"
            value={form.last_manual_location}
            onChange={(e) => setForm({ ...form, last_manual_location: e.target.value })}
            placeholder="City, highway mile marker, yard…"
          />
        </label>
        <label className="grid gap-1 text-sm sm:col-span-2">
          Notes
          <textarea
            className="dispatch-field min-h-20"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </label>
        <label className="grid gap-1 text-sm">
          External ref label
          <input
            className="dispatch-field"
            value={form.external_ref_label}
            onChange={(e) => setForm({ ...form, external_ref_label: e.target.value })}
            placeholder="TMS / load-app reference"
          />
        </label>
        <label className="grid gap-1 text-sm">
          External ref URL
          <input
            className="dispatch-field"
            value={form.external_ref_url}
            onChange={(e) => setForm({ ...form, external_ref_url: e.target.value })}
            placeholder="https://…"
          />
        </label>
        <label className="inline-flex items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            checked={form.exception_open}
            onChange={(e) => setForm({ ...form, exception_open: e.target.checked })}
          />
          Exception open (separate from status — Delivered ≠ Closed)
        </label>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Multi-stop</h3>
          <button
            type="button"
            className="dispatch-btn-ghost"
            onClick={() =>
              setForm((f) => ({
                ...f,
                stops: [
                  ...f.stops,
                  {
                    sequence: f.stops.length + 1,
                    stop_type: "other",
                    name: "",
                    address: "",
                    city: "",
                    state: "",
                    postal_code: "",
                    planned_at: null,
                    actual_at: null,
                    notes: "",
                  },
                ],
              }))
            }
          >
            Add stop
          </button>
        </div>
        <div className="grid gap-3">
          {form.stops.map((stop, i) => (
            <div key={i} className="grid gap-2 rounded-lg border border-[color:var(--dispatch-border)] p-3 sm:grid-cols-3">
              <label className="grid gap-1 text-xs">
                Type
                <select
                  className="dispatch-field"
                  value={stop.stop_type}
                  onChange={(e) => setStop(i, { stop_type: e.target.value as LoadStop["stop_type"] })}
                >
                  <option value="pickup">Pickup</option>
                  <option value="delivery">Delivery</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs sm:col-span-2">
                Name
                <input className="dispatch-field" value={stop.name} onChange={(e) => setStop(i, { name: e.target.value })} />
              </label>
              <label className="grid gap-1 text-xs sm:col-span-2">
                Address
                <input
                  className="dispatch-field"
                  value={stop.address}
                  onChange={(e) => setStop(i, { address: e.target.value })}
                />
              </label>
              <label className="grid gap-1 text-xs">
                City / ST / ZIP
                <div className="flex gap-1">
                  <input
                    className="dispatch-field"
                    value={stop.city}
                    onChange={(e) => setStop(i, { city: e.target.value })}
                    placeholder="City"
                  />
                  <input
                    className="dispatch-field w-14"
                    value={stop.state}
                    onChange={(e) => setStop(i, { state: e.target.value })}
                    placeholder="ST"
                  />
                  <input
                    className="dispatch-field w-20"
                    value={stop.postal_code}
                    onChange={(e) => setStop(i, { postal_code: e.target.value })}
                    placeholder="ZIP"
                  />
                </div>
              </label>
              <label className="grid gap-1 text-xs">
                Planned
                <input
                  className="dispatch-field"
                  type="datetime-local"
                  value={stop.planned_at?.slice(0, 16) ?? ""}
                  onChange={(e) => setStop(i, { planned_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                />
              </label>
              <label className="grid gap-1 text-xs">
                Actual
                <input
                  className="dispatch-field"
                  type="datetime-local"
                  value={stop.actual_at?.slice(0, 16) ?? ""}
                  onChange={(e) => setStop(i, { actual_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                />
              </label>
            </div>
          ))}
        </div>
      </div>

      {load?.id && (
        <>
          <div className="rounded-lg border border-[color:var(--dispatch-border)] p-3">
            <h3 className="mb-2 text-sm font-semibold">Check-call</h3>
            <p className="mb-2 text-xs text-[color:var(--dispatch-muted)]">
              Manual check-call log. Location fields are never Live GPS.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                className="dispatch-field"
                placeholder="Manual location"
                value={checkLocation}
                onChange={(e) => setCheckLocation(e.target.value)}
              />
              <input
                className="dispatch-field"
                placeholder="Notes"
                value={checkNotes}
                onChange={(e) => setCheckNotes(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="dispatch-btn-primary mt-2"
              onClick={async () => {
                if (!checkNotes.trim()) return;
                await addCheckCall({
                  load_id: load.id,
                  notes: checkNotes.trim(),
                  manual_location: checkLocation.trim() || null,
                });
                setCheckNotes("");
                setCheckLocation("");
                setCalls(await listCheckCalls(load.id));
                if (checkLocation.trim()) {
                  setForm((f) => ({ ...f, last_manual_location: checkLocation.trim() }));
                }
              }}
            >
              Log check-call
            </button>
            <ul className="mt-3 space-y-2 text-sm">
              {calls.map((c) => (
                <li key={c.id} className="rounded-md bg-[color:var(--dispatch-soft)] px-2 py-1.5">
                  <span className="font-medium">{new Date(c.called_at).toLocaleString()}</span>
                  {c.manual_location ? ` · ${c.manual_location}` : ""} — {c.notes}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-[color:var(--dispatch-border)] p-3">
            <h3 className="mb-2 text-sm font-semibold">Open exception</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              <input className="dispatch-field" value={excKind} onChange={(e) => setExcKind(e.target.value)} />
              <input className="dispatch-field" value={excNotes} onChange={(e) => setExcNotes(e.target.value)} placeholder="Notes" />
            </div>
            <button
              type="button"
              className="dispatch-btn-ghost mt-2"
              onClick={async () => {
                await saveException({ load_id: load.id, kind: excKind, notes: excNotes, severity: "medium" });
                setForm((f) => ({ ...f, exception_open: true }));
              }}
            >
              Record exception
            </button>
          </div>
        </>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="dispatch-btn-primary"
          disabled={busy || !form.load_number.trim()}
          onClick={async () => {
            const driver = drivers.find((d) => d.id === form.assigned_driver_id);
            const toIso = (v: string) => (v ? new Date(v).toISOString() : null);
            await onSaved({
              ...(form.id ? { id: form.id } : {}),
              load_number: form.load_number.trim(),
              customer_name: form.customer_name || null,
              commodity: form.commodity || null,
              equipment: form.equipment || null,
              notes: form.notes || null,
              status: form.status,
              exception_open: form.exception_open,
              bol_status: form.bol_status,
              pod_status: form.pod_status,
              assigned_driver_id: form.assigned_driver_id || null,
              assigned_driver_name: driver?.display_name ?? null,
              external_ref_label: form.external_ref_label || null,
              external_ref_url: form.external_ref_url || null,
              planned_pickup_at: toIso(form.planned_pickup_at),
              actual_pickup_at: toIso(form.actual_pickup_at),
              planned_delivery_at: toIso(form.planned_delivery_at),
              actual_delivery_at: toIso(form.actual_delivery_at),
              last_manual_location: form.last_manual_location || null,
              last_manual_location_at: form.last_manual_location
                ? load?.last_manual_location_at ?? new Date().toISOString()
                : null,
              stale_after_minutes: form.stale_after_minutes,
              stops: form.stops.map((s, i) => ({ ...s, sequence: i + 1 })),
            });
          }}
        >
          {busy ? "Saving…" : "Save load"}
        </button>
      </div>
    </section>
  );
}

function RosterBoard({
  drivers,
  onSave,
}: {
  drivers: RosterDriver[];
  onSave: (row: Partial<RosterDriver> & { display_name: string }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  return (
    <section className="dispatch-panel">
      <SectionHelp>
        Dispatch-owned roster only. This does <strong>not</strong> read Driver Compliance profiles, drug tests, rate
        cards, or banking. Cross-module driver picker requires a separate approved integration.
      </SectionHelp>
      <div className="mb-3 flex flex-wrap gap-2">
        <input className="dispatch-field" placeholder="Driver name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="dispatch-field w-28" placeholder="Unit #" value={unit} onChange={(e) => setUnit(e.target.value)} />
        <button
          type="button"
          className="dispatch-btn-primary"
          onClick={async () => {
            if (!name.trim()) return;
            await onSave({ display_name: name.trim(), unit_number: unit.trim() || null });
            setName("");
            setUnit("");
          }}
        >
          Add roster driver
        </button>
      </div>
      {!drivers.length ? (
        <EmptyHint>No roster drivers yet.</EmptyHint>
      ) : (
        <ul className="divide-y divide-[color:var(--dispatch-border)]">
          {drivers.map((d) => (
            <li key={d.id} className="flex justify-between py-2 text-sm">
              <span className="font-medium">
                {d.display_name}
                {d.unit_number ? ` · #${d.unit_number}` : ""}
              </span>
              <span className="text-[color:var(--dispatch-muted)]">{d.notes || "Active"}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function HandoverBoard({
  loads,
  account,
  onSaved,
}: {
  loads: DispatchLoad[];
  account: DispatchAccount;
  onSaved: () => Promise<void>;
}) {
  const openLoads = loads.filter((l) => ACTIVE_LOAD_STATUSES.includes(l.status) || l.status === "delivered");
  const [rows, setRows] = useState<ShiftHandover[]>([]);
  const [summary, setSummary] = useState("");
  const [watch, setWatch] = useState("");
  const [priorities, setPriorities] = useState("");
  const [toDispatcher, setToDispatcher] = useState("");

  useEffect(() => {
    void listHandovers().then(setRows);
  }, []);

  return (
    <section className="dispatch-panel grid gap-3">
      <SectionHelp>
        Morning continuity: capture open loads, watch items, and next-day priorities before the desk turns over.
      </SectionHelp>
      <label className="grid gap-1 text-sm">
        Summary
        <textarea className="dispatch-field min-h-24" value={summary} onChange={(e) => setSummary(e.target.value)} />
      </label>
      <label className="grid gap-1 text-sm">
        Watch items
        <textarea className="dispatch-field min-h-20" value={watch} onChange={(e) => setWatch(e.target.value)} />
      </label>
      <label className="grid gap-1 text-sm">
        Next-day priorities
        <textarea
          className="dispatch-field min-h-20"
          value={priorities}
          onChange={(e) => setPriorities(e.target.value)}
        />
      </label>
      <label className="grid gap-1 text-sm">
        To dispatcher
        <input className="dispatch-field" value={toDispatcher} onChange={(e) => setToDispatcher(e.target.value)} />
      </label>
      <p className="text-xs text-[color:var(--dispatch-muted)]">
        Open loads included: {openLoads.map((l) => l.load_number).join(", ") || "none"}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="dispatch-btn-primary"
          onClick={async () => {
            const saved = await saveHandover({
              shift_date: new Date().toISOString().slice(0, 10),
              from_dispatcher: account.display_name,
              to_dispatcher: toDispatcher || null,
              summary,
              watch_items: watch,
              next_day_priorities: priorities,
              open_load_ids: openLoads.map((l) => l.id),
            });
            setRows(await listHandovers());
            await onSaved();
            exportHandoverPdf(saved, loads);
          }}
        >
          Save handover + PDF
        </button>
      </div>
      <ul className="space-y-2">
        {rows.map((h) => (
          <li key={h.id} className="rounded-lg bg-[color:var(--dispatch-soft)] px-3 py-2 text-sm">
            <p className="font-semibold">
              {h.shift_date} · {h.from_dispatcher} → {h.to_dispatcher || "—"}
            </p>
            <p className="text-[color:var(--dispatch-muted)]">{h.summary}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function IssuesBoard({ loads }: { loads: DispatchLoad[] }) {
  const [issues, setIssues] = useState<Awaited<ReturnType<typeof listIssues>>>([]);
  const [exceptions, setExceptions] = useState<Awaited<ReturnType<typeof listExceptions>>>([]);
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [loadId, setLoadId] = useState("");

  async function reload() {
    setIssues(await listIssues());
    setExceptions(await listExceptions());
  }

  useEffect(() => {
    void reload();
  }, []);

  return (
    <div className="grid gap-3">
      <section className="dispatch-panel">
        <h2 className="mb-2 text-base font-semibold">Issues & escalations</h2>
        <SectionHelp>Escalate desk problems without changing load status by itself.</SectionHelp>
        <div className="mb-3 grid gap-2 sm:grid-cols-2">
          <input className="dispatch-field" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <select className="dispatch-field" value={loadId} onChange={(e) => setLoadId(e.target.value)}>
            <option value="">No load link</option>
            {loads.map((l) => (
              <option key={l.id} value={l.id}>
                {l.load_number}
              </option>
            ))}
          </select>
          <input
            className="dispatch-field sm:col-span-2"
            placeholder="Detail"
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="dispatch-btn-primary"
          onClick={async () => {
            if (!title.trim()) return;
            await saveIssue({ title: title.trim(), detail, load_id: loadId || null, escalation_level: "ops" });
            setTitle("");
            setDetail("");
            await reload();
          }}
        >
          Open issue
        </button>
        <ul className="mt-3 divide-y divide-[color:var(--dispatch-border)]">
          {issues.map((issue) => (
            <li key={issue.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <div>
                <p className="font-semibold">{issue.title}</p>
                <p className="text-xs text-[color:var(--dispatch-muted)]">
                  {issue.status} · {issue.escalation_level}
                </p>
              </div>
              {issue.status !== "resolved" && (
                <button
                  type="button"
                  className="dispatch-btn-ghost"
                  onClick={async () => {
                    await saveIssue({ ...issue, status: "escalated" });
                    await reload();
                  }}
                >
                  Escalate
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
      <section className="dispatch-panel">
        <h2 className="mb-2 text-base font-semibold">Exceptions</h2>
        <ul className="divide-y divide-[color:var(--dispatch-border)] text-sm">
          {exceptions.map((ex) => (
            <li key={ex.id} className="flex justify-between py-2">
              <span>
                {ex.kind} · {ex.severity} · {ex.status}
              </span>
              {ex.status !== "resolved" && (
                <button
                  type="button"
                  className="dispatch-btn-ghost"
                  onClick={async () => {
                    await saveException({ ...ex, status: "resolved" });
                    await reload();
                  }}
                >
                  Resolve
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function HistoryBoard({
  loads,
  drivers,
  onOpen,
}: {
  loads: DispatchLoad[];
  drivers: RosterDriver[];
  onOpen: (id: string) => void;
}) {
  const [driverId, setDriverId] = useState(drivers[0]?.id ?? "");
  const history = driverId ? driverLoadHistory(loads, driverId) : [];
  return (
    <section className="dispatch-panel">
      <SectionHelp>Load history for a dispatch roster driver (not Compliance dossier).</SectionHelp>
      <select className="dispatch-field mb-3 max-w-sm" value={driverId} onChange={(e) => setDriverId(e.target.value)}>
        {drivers.map((d) => (
          <option key={d.id} value={d.id}>
            {d.display_name}
          </option>
        ))}
      </select>
      {!history.length ? (
        <EmptyHint>No loads for this driver.</EmptyHint>
      ) : (
        <ul className="divide-y divide-[color:var(--dispatch-border)]">
          {history.map((load) => (
            <li key={load.id} className="flex items-center justify-between py-2 text-sm">
              <span>
                {load.load_number} · {statusLabel(load.status)}
              </span>
              <button type="button" className="dispatch-btn-primary" onClick={() => onOpen(load.id)}>
                Update Load
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ReportsBoard({ loads }: { loads: DispatchLoad[] }) {
  return (
    <section className="dispatch-panel">
      <SectionHelp>Export PDF/CSV for desk reporting. No rate cards or payroll fields included.</SectionHelp>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="dispatch-btn-primary" onClick={() => exportLoadsCsv(loads)}>
          Download CSV
        </button>
        <button type="button" className="dispatch-btn-ghost" onClick={() => exportLoadsPdf(loads)}>
          Download PDF
        </button>
      </div>
      <p className="mt-3 text-sm text-[color:var(--dispatch-muted)]">{loads.length} loads in current cloud/fixture set.</p>
    </section>
  );
}

function TeamBoard({ account }: { account: DispatchAccount }) {
  const [rows, setRows] = useState<DispatchAccount[]>([]);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function reload() {
    setRows(await listDispatchAccounts());
  }

  useEffect(() => {
    void reload().catch((err) => setMsg(err instanceof Error ? err.message : "Could not load team."));
  }, []);

  return (
    <section className="dispatch-panel grid gap-3">
      <SectionHelp>
        Invite or revoke Dispatch users. Backend edge function + RLS enforce admin. Dedicated dispatcher emails only —
        never reuse Driver Compliance seats.
      </SectionHelp>
      {isDispatchPreviewMode() && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Invite/revoke needs cloud SQL + create-dispatch-user function (approval gate).
        </p>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <input className="dispatch-field" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input
          className="dispatch-field"
          placeholder="Display name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
        <input
          className="dispatch-field"
          type="password"
          placeholder="Temp password (8+)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button
          type="button"
          className="dispatch-btn-primary"
          onClick={async () => {
            setMsg(null);
            try {
              await inviteDispatchUser({
                email,
                displayName,
                password,
                role: "dispatcher",
              });
              setEmail("");
              setDisplayName("");
              setPassword("");
              setMsg("Invite created.");
              await reload();
            } catch (err) {
              setMsg(err instanceof Error ? err.message : "Invite failed.");
            }
          }}
        >
          Invite dispatcher
        </button>
      </div>
      {msg && <p className="text-sm">{msg}</p>}
      <ul className="divide-y divide-[color:var(--dispatch-border)] text-sm">
        {rows.map((row) => (
          <li key={row.user_id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <div>
              <p className="font-semibold">
                {row.display_name} · {row.email}
              </p>
              <p className="text-xs text-[color:var(--dispatch-muted)]">
                {row.role} · {row.active ? "active" : "revoked"}
              </p>
            </div>
            {row.user_id !== account.user_id && (
              <button
                type="button"
                className="dispatch-btn-ghost"
                onClick={async () => {
                  await setDispatchAccess(row.user_id, row.role, !row.active);
                  await reload();
                }}
              >
                {row.active ? "Revoke" : "Restore"}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
