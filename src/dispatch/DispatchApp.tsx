import { useEffect, useMemo, useRef, useState } from "react";
import {
  ClipboardList,
  FileText,
  FileWarning,
  History,
  LayoutDashboard,
  LogOut,
  MapPin,
  PhoneCall,
  RefreshCw,
  Bell,
  Truck,
  Users,
  UserCog,
  Handshake,
  Wrench,
  Receipt,
} from "lucide-react";
import { LoginGate } from "@/dispatch/components/LoginGate";
import { EmptyHint, SectionHelp, StaleBadge } from "@/dispatch/components/EmptyHint";
import { DocsBoard, EquipmentBoard, FollowUpsBoard } from "@/dispatch/components/OpsControlsBoards";
import { AccessorialsBoard } from "@/dispatch/components/CloseoutBoards";
import {
  getDispatchAccount,
  healDispatchAccount,
  inviteDispatchUser,
  isDispatchPreviewMode,
  listDispatchAccounts,
  setDispatchAccess,
  signOutDispatch,
} from "@/dispatch/lib/auth";
import {
  addCheckCall,
  cancelLoad,
  closeLoad,
  driverLoadHistory,
  healRosterDriver,
  listAccessorials,
  listCheckCalls,
  listCommunications,
  listExceptions,
  listFollowUps,
  listHandovers,
  listIssues,
  listLoads,
  listRosterDrivers,
  reopenLoad,
  rescheduleLoad,
  saveCommunication,
  saveException,
  saveHandover,
  saveIssue,
  saveLoad,
  setLoadPaymentStatus,
  upsertRosterDriver,
} from "@/dispatch/lib/cloud";
import {
  buildCompleteLoadHistory,
  paymentStatusLabel,
  validateCloseout,
  validateCommunication,
  validateReopen,
} from "@/dispatch/lib/closeout";
import {
  buildHandoverWatchHints,
  dueFollowUps,
  moveStop,
  openEscalations,
  removeStop,
  validateCancel,
  validateReschedule,
} from "@/dispatch/lib/ops-controls";
import {
  exportAccessorialsCsv,
  exportAccessorialsPdf,
  exportHandoverPdf,
  exportLoadHistoryPdf,
  exportLoadsCsv,
  exportLoadsPdf,
} from "@/dispatch/lib/reports";
import {
  activeLoadsBoardColumns,
  filterLoads,
  homeActionBuckets,
  isStaleUpdate,
  statusLabel,
} from "@/dispatch/lib/status";
import type {
  CommunicationKind,
  DispatchAccount,
  DispatchFollowUp,
  DispatchIssue,
  DispatchLoad,
  DispatchView,
  DocStatus,
  LoadStatus,
  LoadStop,
  PaymentStatus,
  RosterDriver,
  ShiftHandover,
} from "@/dispatch/lib/types";
import {
  ACTIVE_LOAD_STATUSES,
  LOAD_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
} from "@/dispatch/lib/types";

const NAV: { id: DispatchView; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "home", label: "My Dispatch Today", icon: LayoutDashboard },
  { id: "loads", label: "Active Loads", icon: Truck },
  { id: "updates", label: "Driver Updates", icon: PhoneCall },
  { id: "docs", label: "BOL / POD", icon: FileText },
  { id: "followups", label: "Follow-Ups", icon: Bell },
  { id: "equipment", label: "Driver / Equipment", icon: Wrench },
  { id: "accessorials", label: "Detention / Accessorials", icon: Receipt },
  { id: "handover", label: "Shift Handover", icon: Handshake },
  { id: "issues", label: "Issues", icon: FileWarning },
  { id: "roster", label: "Roster", icon: Users },
  { id: "history", label: "Load history", icon: History },
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

/** Truthy `.length` on a string is unsafe — only real stop arrays hydrate the editor. */
function stopsOf(stops: unknown): LoadStop[] {
  return Array.isArray(stops) && stops.length ? (stops as LoadStop[]) : blankStops();
}

/** datetime-local value from cloud/local timestamps — coerce before `.slice`. */
function asDtLocal(v: unknown): string {
  const s = v == null ? "" : typeof v === "string" ? v : String(v);
  return s.slice(0, 16);
}

/** LoadEditor form scalars — corrupt cloud load text must never reach `.trim()`. */
function asFormText(v: unknown): string {
  return v == null ? "" : typeof v === "string" ? v : String(v);
}

/** Parse editor datetime to ISO — never call `Invalid Date#toISOString`. */
function toIsoOrNull(v: unknown): string | null {
  const s = v == null ? "" : typeof v === "string" ? v : String(v);
  if (!s) return null;
  const ms = Date.parse(s);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
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
    setLoads(Array.isArray(nextLoads) ? nextLoads : []);
    setDrivers(
      (Array.isArray(nextDrivers) ? nextDrivers : []).map((d) => healRosterDriver(d as RosterDriver)),
    );
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const acc = await getDispatchAccount();
        if (cancelled) return;
        setAccount(acc ? healDispatchAccount(acc) : null);
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

  const safeLoads = Array.isArray(loads) ? loads : [];
  const safeDrivers = Array.isArray(drivers) ? drivers : [];
  const selected = useMemo(
    () => safeLoads.find((l) => l.id === selectedId) ?? null,
    [safeLoads, selectedId],
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
            <p className="font-medium text-white">{asFormText(account.display_name)}</p>
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
                My Dispatch Today · Active Loads · Manual location &amp; check-calls only (never
                Live GPS)
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
              loads={safeLoads}
              onOpen={(id) => {
                setSelectedId(id);
                setView("load");
              }}
              onOpenFollowUps={() => setView("followups")}
              onOpenIssues={() => setView("issues")}
              onOpenDocs={() => setView("docs")}
            />
          )}
          {view === "loads" && (
            <LoadsBoard
              loads={safeLoads}
              drivers={safeDrivers}
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
              loads={safeLoads}
              onOpen={(id) => {
                setSelectedId(id);
                setView("load");
              }}
              onRefresh={refresh}
            />
          )}
          {view === "docs" && (
            <DocsBoard
              loads={safeLoads}
              onRefresh={refresh}
              onOpen={(id) => {
                setSelectedId(id);
                setView("load");
              }}
            />
          )}
          {view === "followups" && (
            <FollowUpsBoard
              loads={safeLoads}
              onOpenLoad={(id) => {
                setSelectedId(id);
                setView("load");
              }}
            />
          )}
          {view === "equipment" && (
            <EquipmentBoard
              drivers={safeDrivers}
              loads={safeLoads}
              onOpen={(id) => {
                setSelectedId(id);
                setView("load");
              }}
            />
          )}
          {view === "accessorials" && (
            <AccessorialsBoard
              loads={safeLoads}
              onOpen={(id) => {
                setSelectedId(id);
                setView("load");
              }}
            />
          )}
          {view === "load" && (
            <LoadEditor
              key={selected?.id ?? "new"}
              load={selected}
              drivers={safeDrivers}
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
              onLoadChanged={async (next) => {
                await refresh();
                setSelectedId(next.id);
              }}
            />
          )}
          {view === "roster" && (
            <RosterBoard
              drivers={safeDrivers}
              onSave={async (row) => {
                await upsertRosterDriver(row);
                await refresh();
              }}
            />
          )}
          {view === "handover" && (
            <HandoverBoard loads={safeLoads} account={account} onSaved={async () => refresh()} />
          )}
          {view === "issues" && <IssuesBoard loads={safeLoads} />}
          {view === "history" && (
            <HistoryBoard
              loads={safeLoads}
              drivers={safeDrivers}
              onOpen={(id) => {
                setSelectedId(id);
                setView("load");
              }}
            />
          )}
          {view === "reports" && <ReportsBoard loads={safeLoads} drivers={safeDrivers} />}
          {view === "team" && account.role === "admin" && <TeamBoard account={account} />}
        </main>
      </div>
    </div>
  );
}

function HomeBoard({
  loads,
  onOpen,
  onOpenFollowUps,
  onOpenIssues,
  onOpenDocs,
}: {
  loads: DispatchLoad[];
  onOpen: (id: string) => void;
  onOpenFollowUps: () => void;
  onOpenIssues: () => void;
  onOpenDocs: () => void;
}) {
  const safeHomeLoads = Array.isArray(loads) ? loads : [];
  const buckets = homeActionBuckets(safeHomeLoads);
  const [followUps, setFollowUps] = useState<DispatchFollowUp[]>([]);
  const [issues, setIssues] = useState<DispatchIssue[]>([]);

  useEffect(() => {
    void Promise.all([listFollowUps(), listIssues()]).then(([fu, iss]) => {
      setFollowUps(Array.isArray(fu) ? fu : []);
      setIssues(Array.isArray(iss) ? iss : []);
    });
  }, [loads]);

  const due = dueFollowUps(followUps);
  const openIss = openEscalations(issues);
  const sections = [
    {
      title: "Needs update / check-call",
      items: buckets.needsUpdate,
      help: "Stale or missing manual location.",
    },
    {
      title: "Open exceptions",
      items: buckets.openExceptions,
      help: "Exceptions are separate from load status.",
    },
    {
      title: "Awaiting BOL / POD",
      items: buckets.awaitingDocs,
      help: "BOL and POD statuses are independent.",
    },
    { title: "In motion", items: buckets.inMotion, help: "Assigned through at-delivery." },
  ];
  return (
    <div className="grid gap-3">
      <SectionHelp>
        My Dispatch Today prioritizes action lists over counters. Delivered ≠ Closed ≠ Paid — close
        only after file work; payment is separate. No invented ETAs, GPS, HOS, rates, or
        notifications.
      </SectionHelp>
      <section className="dispatch-panel">
        <h2 className="mb-2 text-base font-semibold text-[color:var(--dispatch-navy)]">
          Awaiting closeout ({buckets.awaitingCloseout.length})
        </h2>
        <p className="mb-2 text-xs text-[color:var(--dispatch-muted)]">
          Delivered loads still open for file close. Closing does not mark Paid.
        </p>
        {!buckets.awaitingCloseout.length ? (
          <EmptyHint>No delivered loads awaiting closeout.</EmptyHint>
        ) : (
          <ul className="divide-y divide-[color:var(--dispatch-border)]">
            {buckets.awaitingCloseout.slice(0, 8).map((load) => (
              <li
                key={load.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
              >
                <div>
                  <p className="font-semibold">
                    {asFormText(load.load_number)} · {statusLabel(load.status)}
                  </p>
                  <p className="text-xs text-[color:var(--dispatch-muted)]">
                    Payment: {paymentStatusLabel(load.payment_status)} · POD {load.pod_status}
                  </p>
                </div>
                <button
                  type="button"
                  className="dispatch-btn-primary"
                  onClick={() => onOpen(load.id)}
                >
                  Update Load
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="dispatch-panel">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-[color:var(--dispatch-navy)]">
            Follow-ups due
          </h2>
          <button type="button" className="dispatch-btn-ghost" onClick={onOpenFollowUps}>
            Open Follow-Ups
          </button>
        </div>
        <p className="mb-2 text-xs text-[color:var(--dispatch-muted)]">
          Desk reminders only — not push/email. {due.length} due.
        </p>
        {!due.length ? (
          <EmptyHint>No follow-ups due.</EmptyHint>
        ) : (
          <ul className="divide-y divide-[color:var(--dispatch-border)]">
            {due.slice(0, 8).map((f) => (
              <li
                key={f.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
              >
                <div>
                  <p className="font-semibold">{asFormText(f.title)}</p>
                  <p className="text-xs text-[color:var(--dispatch-muted)]">
                    Due {new Date(f.due_at).toLocaleString()}
                  </p>
                </div>
                {f.load_id && (
                  <button
                    type="button"
                    className="dispatch-btn-primary"
                    onClick={() => onOpen(f.load_id!)}
                  >
                    Update Load
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="dispatch-panel">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-[color:var(--dispatch-navy)]">
            Open issues & escalations
          </h2>
          <div className="flex gap-2">
            <button type="button" className="dispatch-btn-ghost" onClick={onOpenDocs}>
              BOL / POD
            </button>
            <button type="button" className="dispatch-btn-ghost" onClick={onOpenIssues}>
              Issues
            </button>
          </div>
        </div>
        <p className="mb-2 text-xs text-[color:var(--dispatch-muted)]">
          Senior Informed is a manual record only. {openIss.length} open.
        </p>
        {!openIss.length ? (
          <EmptyHint>No open issues.</EmptyHint>
        ) : (
          <ul className="divide-y divide-[color:var(--dispatch-border)]">
            {openIss.slice(0, 8).map((issue) => (
              <li key={issue.id} className="py-2 text-sm">
                <p className="font-semibold">{asFormText(issue.title)}</p>
                <p className="text-xs text-[color:var(--dispatch-muted)]">
                  {asFormText(issue.status)} · {asFormText(issue.escalation_level)}
                  {issue.senior_informed
                    ? " · Senior Informed (manual)"
                    : " · Senior Informed: not recorded"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
      {sections.map((section) => (
        <section key={asFormText(section.title)} className="dispatch-panel">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold text-[color:var(--dispatch-navy)]">
              {asFormText(section.title)}
            </h2>
            <span className="text-xs text-[color:var(--dispatch-muted)]">
              {section.items.length}
            </span>
          </div>
          <p className="mb-2 text-xs text-[color:var(--dispatch-muted)]">{asFormText(section.help)}</p>
          {!section.items.length ? (
            <EmptyHint>Nothing in this list.</EmptyHint>
          ) : (
            <ul className="divide-y divide-[color:var(--dispatch-border)]">
              {section.items.map((load) => (
                <li
                  key={load.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
                >
                  <div>
                    <p className="text-sm font-semibold">
                      {asFormText(load.load_number)}{" "}
                      <span className="font-normal text-[color:var(--dispatch-muted)]">
                        · {statusLabel(load.status)}
                      </span>
                    </p>
                    <p className="text-xs text-[color:var(--dispatch-muted)]">
                      {asFormText(load.assigned_driver_name) || "Unassigned"} ·{" "}
                      {load.last_manual_location || "No manual location"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isStaleUpdate(load) && <StaleBadge />}
                    <button
                      type="button"
                      className="dispatch-btn-primary"
                      onClick={() => onOpen(load.id)}
                    >
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
  const safeLoads = Array.isArray(loads) ? loads : [];
  const safeDrivers = Array.isArray(drivers) ? drivers : [];
  const filtered = filterLoads(safeLoads, { q, status, driverId, exceptionOnly });
  const boardColumns = activeLoadsBoardColumns(
    filterLoads(safeLoads, { q, status: "active", driverId, exceptionOnly }),
  );

  return (
    <section className="dispatch-panel">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <SectionHelp>
          Active Loads — table or desk board. Cloud-backed when SQL is applied; never invents
          milestones, locations, or ETAs.
        </SectionHelp>
        <div className="flex flex-wrap gap-2">
          <div className="inline-flex rounded-md border border-[color:var(--dispatch-border)] p-0.5">
            <button
              type="button"
              className={`rounded px-2.5 py-1 text-xs font-semibold ${
                layout === "table"
                  ? "bg-[color:var(--dispatch-orange)] text-white"
                  : "text-[color:var(--dispatch-muted)]"
              }`}
              onClick={() => setLayout("table")}
            >
              Table
            </button>
            <button
              type="button"
              className={`rounded px-2.5 py-1 text-xs font-semibold ${
                layout === "board"
                  ? "bg-[color:var(--dispatch-orange)] text-white"
                  : "text-[color:var(--dispatch-muted)]"
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
        <select
          className="dispatch-field"
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
        >
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
          {safeDrivers.map((d) => (
            <option key={d.id} value={d.id}>
              {asFormText(d.display_name)}
            </option>
          ))}
        </select>
      </div>
      <label className="mb-3 inline-flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={exceptionOnly}
          onChange={(e) => setExceptionOnly(e.target.checked)}
        />
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
                <span className="text-[10px] text-[color:var(--dispatch-muted)]">
                  {col.items.length}
                </span>
              </div>
              <ul className="grid gap-2">
                {col.items.map((load) => (
                  <li
                    key={load.id}
                    className="rounded-md border border-[color:var(--dispatch-border)] bg-[color:var(--dispatch-card)] p-2"
                  >
                    <p className="text-sm font-semibold">{asFormText(load.load_number)}</p>
                    <p className="text-xs text-[color:var(--dispatch-muted)]">
                      {asFormText(load.assigned_driver_name) || "Unassigned"}
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
                    <div className="font-semibold">{asFormText(load.load_number)}</div>
                    <div className="text-xs text-[color:var(--dispatch-muted)]">
                      {asFormText(load.customer_name)}
                    </div>
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
                    <button
                      type="button"
                      className="dispatch-btn-primary"
                      onClick={() => onOpen(load.id)}
                    >
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
  const safeLoads = Array.isArray(loads) ? loads : [];
  const active = safeLoads.filter(
    (l) => ACTIVE_LOAD_STATUSES.includes(l.status) || l.status === "delivered",
  );
  const [drafts, setDrafts] = useState<Record<string, { location: string; notes: string }>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function draftFor(id: string) {
    return drafts[id] ?? { location: "", notes: "" };
  }

  return (
    <section className="dispatch-panel grid gap-3">
      <SectionHelp>
        Driver Updates are manual-first: enter location and check-call notes from the desk phone.
        Never labeled Live GPS. No invented milestones or ETAs.
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
                    {asFormText(load.load_number)}{" "}
                    <span className="font-normal text-[color:var(--dispatch-muted)]">
                      · {statusLabel(load.status)} · {asFormText(load.assigned_driver_name) || "Unassigned"}
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
                        data-testid={`dispatch-check-location-${load.id}`}
                        value={asFormText(draft.location)}
                        onChange={(e) =>
                          setDrafts((d) => ({
                            ...d,
                            [load.id]: { ...draftFor(load.id), location: e.target.value },
                          }))
                        }
                        onInput={(e) =>
                          setDrafts((d) => ({
                            ...d,
                            [load.id]: {
                              ...draftFor(load.id),
                              location: (e.target as HTMLInputElement).value,
                            },
                          }))
                        }
                        placeholder="City, mile marker, yard…"
                      />
                    </label>
                    <label className="grid gap-1 text-xs">
                      Check-call notes
                      <input
                        className="dispatch-field"
                        data-testid={`dispatch-check-notes-${load.id}`}
                        value={asFormText(draft.notes)}
                        onChange={(e) =>
                          setDrafts((d) => ({
                            ...d,
                            [load.id]: { ...draftFor(load.id), notes: e.target.value },
                          }))
                        }
                        onInput={(e) =>
                          setDrafts((d) => ({
                            ...d,
                            [load.id]: {
                              ...draftFor(load.id),
                              notes: (e.target as HTMLInputElement).value,
                            },
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
                        const locDom =
                          document.querySelector<HTMLInputElement>(
                            `[data-testid="dispatch-check-location-${load.id}"]`,
                          )?.value ?? "";
                        const notesDom =
                          document.querySelector<HTMLInputElement>(
                            `[data-testid="dispatch-check-notes-${load.id}"]`,
                          )?.value ?? "";
                        const location = draft.location.trim() || locDom.trim();
                        const notes = (draft.notes.trim() || notesDom.trim()) || "Manual check-call";
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
                        setError(
                          err instanceof Error ? err.message : "Could not save driver update.",
                        );
                      } finally {
                        setBusyId(null);
                      }
                    }}
                  >
                    <PhoneCall className="h-4 w-4" /> Save check-call
                  </button>
                  <button
                    type="button"
                    className="dispatch-btn-ghost"
                    onClick={() => onOpen(load.id)}
                  >
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
  onLoadChanged,
}: {
  load: DispatchLoad | null;
  drivers: RosterDriver[];
  busy: boolean;
  onSaved: (input: Parameters<typeof saveLoad>[0]) => Promise<void>;
  onCancel: () => void;
  onLoadChanged: (load: DispatchLoad) => Promise<void>;
}) {
  const [form, setForm] = useState(() => ({
    id: load?.id,
    load_number: asFormText(load?.load_number),
    customer_name: asFormText(load?.customer_name),
    commodity: asFormText(load?.commodity),
    equipment: asFormText(load?.equipment),
    notes: asFormText(load?.notes),
    status: (load?.status ?? "planned") as LoadStatus,
    exception_open: load?.exception_open ?? false,
    bol_status: (load?.bol_status ?? "missing") as DocStatus,
    pod_status: (load?.pod_status ?? "missing") as DocStatus,
    assigned_driver_id: asFormText(load?.assigned_driver_id),
    external_ref_label: asFormText(load?.external_ref_label),
    external_ref_url: asFormText(load?.external_ref_url),
    planned_pickup_at: asDtLocal(load?.planned_pickup_at),
    actual_pickup_at: asDtLocal(load?.actual_pickup_at),
    planned_delivery_at: asDtLocal(load?.planned_delivery_at),
    actual_delivery_at: asDtLocal(load?.actual_delivery_at),
    last_manual_location: asFormText(load?.last_manual_location),
    cancel_reason: asFormText(load?.cancel_reason),
    reschedule_note: asFormText(load?.reschedule_note),
    closeout_note: asFormText(load?.closeout_note),
    reopen_reason: asFormText(load?.reopen_reason),
    payment_status: (load?.payment_status ?? "unpaid") as PaymentStatus,
    stale_after_minutes: load?.stale_after_minutes ?? 180,
    stops: Array.isArray(load?.stops) ? structuredClone(stopsOf(load.stops)) : blankStops(),
  }));
  const editorStops = stopsOf(form.stops);
  const safeDrivers = Array.isArray(drivers) ? drivers : [];
  const [checkNotes, setCheckNotes] = useState("");
  const [checkLocation, setCheckLocation] = useState("");
  const checkNotesRef = useRef<HTMLInputElement>(null);
  const checkLocationRef = useRef<HTMLInputElement>(null);
  const [calls, setCalls] = useState<Awaited<ReturnType<typeof listCheckCalls>>>([]);
  const [excKind, setExcKind] = useState("Delay");
  const [excNotes, setExcNotes] = useState("");
  const excKindRef = useRef<HTMLInputElement>(null);
  const excNotesRef = useRef<HTMLInputElement>(null);
  const [opsError, setOpsError] = useState<string | null>(null);
  const [opsBusy, setOpsBusy] = useState(false);
  const [commKind, setCommKind] = useState<CommunicationKind>("note");
  const [commSummary, setCommSummary] = useState("");
  const commSummaryRef = useRef<HTMLInputElement>(null);
  const commDetailRef = useRef<HTMLInputElement>(null);
  const commDecisionRef = useRef<HTMLInputElement>(null);
  const [commDetail, setCommDetail] = useState("");
  const [commDecision, setCommDecision] = useState("");
  const [comms, setComms] = useState<Awaited<ReturnType<typeof listCommunications>>>([]);
  const [accessorials, setAccessorials] = useState<Awaited<ReturnType<typeof listAccessorials>>>(
    [],
  );
  const loadNumberRef = useRef<HTMLInputElement>(null);
  const customerRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const cancelReasonRef = useRef<HTMLInputElement>(null);
  const rescheduleNoteRef = useRef<HTMLInputElement>(null);
  const closeoutNoteRef = useRef<HTMLInputElement>(null);
  const reopenReasonRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!load?.id) return;
    void Promise.all([
      listCheckCalls(load.id),
      listCommunications(load.id),
      listAccessorials(load.id),
    ]).then(([c, com, acc]) => {
      setCalls(Array.isArray(c) ? c : []);
      setComms(Array.isArray(com) ? com : []);
      setAccessorials(Array.isArray(acc) ? acc : []);
    });
  }, [load?.id]);

  function setStop(i: number, patch: Partial<LoadStop>) {
    setForm((f) => {
      const stops = [...stopsOf(f.stops)];
      stops[i] = { ...stops[i], ...patch };
      return { ...f, stops };
    });
  }

  return (
    <section className="dispatch-panel grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-[color:var(--dispatch-navy)]">
          {load ? `Update Load ${asFormText(load.load_number)}` : "Add Load"}
        </h2>
        <button type="button" className="dispatch-btn-ghost" onClick={onCancel}>
          Back to loads
        </button>
      </div>
      <SectionHelp>
        Keep planned vs actual timestamps. Manual location is dispatcher-entered — never labeled
        Live GPS. External load apps are reference links only.
      </SectionHelp>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          Load number
          <input
            ref={loadNumberRef}
            className="dispatch-field"
            data-testid="dispatch-load-number"
            value={asFormText(form.load_number)}
            onChange={(e) => setForm({ ...form, load_number: e.target.value })}
            onInput={(e) =>
              setForm((f) => ({ ...f, load_number: (e.target as HTMLInputElement).value }))
            }
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
            ref={customerRef}
            className="dispatch-field"
            data-testid="dispatch-customer"
            value={asFormText(form.customer_name)}
            onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
            onInput={(e) =>
              setForm((f) => ({ ...f, customer_name: (e.target as HTMLInputElement).value }))
            }
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
            {safeDrivers.map((d) => (
              <option key={d.id} value={d.id}>
                {asFormText(d.display_name)}
                {d.unit_number ? ` · #${asFormText(d.unit_number)}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Commodity
          <input
            className="dispatch-field"
            value={asFormText(form.commodity)}
            onChange={(e) => setForm({ ...form, commodity: e.target.value })}
            onInput={(e) => setForm((f) => ({ ...f, commodity: (e.target as HTMLInputElement).value }))}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Equipment
          <input
            className="dispatch-field"
            value={asFormText(form.equipment)}
            onChange={(e) => setForm({ ...form, equipment: e.target.value })}
            onInput={(e) => setForm((f) => ({ ...f, equipment: (e.target as HTMLInputElement).value }))}
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
            onInput={(e) => setForm((f) => ({ ...f, planned_pickup_at: (e.target as HTMLInputElement).value }))}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Actual pickup
          <input
            className="dispatch-field"
            type="datetime-local"
            value={form.actual_pickup_at}
            onChange={(e) => setForm({ ...form, actual_pickup_at: e.target.value })}
            onInput={(e) => setForm((f) => ({ ...f, actual_pickup_at: (e.target as HTMLInputElement).value }))}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Planned delivery
          <input
            className="dispatch-field"
            type="datetime-local"
            value={form.planned_delivery_at}
            onChange={(e) => setForm({ ...form, planned_delivery_at: e.target.value })}
            onInput={(e) => setForm((f) => ({ ...f, planned_delivery_at: (e.target as HTMLInputElement).value }))}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Actual delivery
          <input
            className="dispatch-field"
            type="datetime-local"
            value={form.actual_delivery_at}
            onChange={(e) => setForm({ ...form, actual_delivery_at: e.target.value })}
            onInput={(e) => setForm((f) => ({ ...f, actual_delivery_at: (e.target as HTMLInputElement).value }))}
          />
        </label>
        <label className="grid gap-1 text-sm sm:col-span-2">
          Manual location (never Live GPS)
          <input
            className="dispatch-field"
            value={asFormText(form.last_manual_location)}
            onChange={(e) => setForm({ ...form, last_manual_location: e.target.value })}
            onInput={(e) => setForm((f) => ({ ...f, last_manual_location: (e.target as HTMLInputElement).value }))}
            placeholder="City, highway mile marker, yard…"
          />
        </label>
        <label className="grid gap-1 text-sm sm:col-span-2">
          Notes
          <textarea
            ref={notesRef}
            className="dispatch-field min-h-20"
            data-testid="dispatch-load-notes"
            value={asFormText(form.notes)}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            onInput={(e) =>
              setForm((f) => ({ ...f, notes: (e.target as HTMLTextAreaElement).value }))
            }
          />
        </label>
        <label className="grid gap-1 text-sm">
          External ref label
          <input
            className="dispatch-field"
            value={asFormText(form.external_ref_label)}
            onChange={(e) => setForm({ ...form, external_ref_label: e.target.value })}
            onInput={(e) => setForm((f) => ({ ...f, external_ref_label: (e.target as HTMLInputElement).value }))}
            placeholder="TMS / load-app reference"
          />
        </label>
        <label className="grid gap-1 text-sm">
          External ref URL
          <input
            className="dispatch-field"
            value={asFormText(form.external_ref_url)}
            onChange={(e) => setForm({ ...form, external_ref_url: e.target.value })}
            onInput={(e) => setForm((f) => ({ ...f, external_ref_url: (e.target as HTMLInputElement).value }))}
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
              setForm((f) => {
                const cur = stopsOf(f.stops);
                return {
                  ...f,
                  stops: [
                    ...cur,
                    {
                      sequence: cur.length + 1,
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
                };
              })
            }
          >
            Add stop
          </button>
        </div>
        <p className="mb-2 text-xs text-[color:var(--dispatch-muted)]">
          Reorder or remove stops as needed. Planned times are desk-entered — no invented ETAs.
        </p>
        <div className="grid gap-3">
          {editorStops.map((stop, i) => (
            <div
              key={i}
              className="grid gap-2 rounded-lg border border-[color:var(--dispatch-border)] p-3 sm:grid-cols-3"
            >
              <div className="flex flex-wrap items-center gap-2 sm:col-span-3">
                <span className="text-xs font-semibold text-[color:var(--dispatch-navy)]">
                  Stop {stop.sequence}
                </span>
                <button
                  type="button"
                  className="dispatch-btn-ghost"
                  disabled={i === 0}
                  onClick={() => setForm((f) => ({ ...f, stops: moveStop(stopsOf(f.stops), i, -1) }))}
                >
                  Up
                </button>
                <button
                  type="button"
                  className="dispatch-btn-ghost"
                  disabled={i >= editorStops.length - 1}
                  onClick={() => setForm((f) => ({ ...f, stops: moveStop(stopsOf(f.stops), i, 1) }))}
                >
                  Down
                </button>
                <button
                  type="button"
                  className="dispatch-btn-ghost"
                  disabled={editorStops.length <= 1}
                  onClick={() => setForm((f) => ({ ...f, stops: removeStop(stopsOf(f.stops), i) }))}
                >
                  Remove
                </button>
              </div>
              <label className="grid gap-1 text-xs">
                Type
                <select
                  className="dispatch-field"
                  value={stop.stop_type}
                  onChange={(e) =>
                    setStop(i, { stop_type: e.target.value as LoadStop["stop_type"] })
                  }
                >
                  <option value="pickup">Pickup</option>
                  <option value="delivery">Delivery</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs sm:col-span-2">
                Name
                <input
                  className="dispatch-field"
                  value={asFormText(stop.name)}
                  onChange={(e) => setStop(i, { name: e.target.value })}
                  onInput={(e) => setStop(i, { name: (e.target as HTMLInputElement).value })}
                />
              </label>
              <label className="grid gap-1 text-xs sm:col-span-2">
                Address
                <input
                  className="dispatch-field"
                  value={asFormText(stop.address)}
                  onChange={(e) => setStop(i, { address: e.target.value })}
                  onInput={(e) => setStop(i, { address: (e.target as HTMLInputElement).value })}
                />
              </label>
              <label className="grid gap-1 text-xs">
                City / ST / ZIP
                <div className="flex gap-1">
                  <input
                    className="dispatch-field"
                    value={asFormText(stop.city)}
                    onChange={(e) => setStop(i, { city: e.target.value })}
                  onInput={(e) => setStop(i, { city: (e.target as HTMLInputElement).value })}
                    placeholder="City"
                  />
                  <input
                    className="dispatch-field w-14"
                    value={asFormText(stop.state)}
                    onChange={(e) => setStop(i, { state: e.target.value })}
                  onInput={(e) => setStop(i, { state: (e.target as HTMLInputElement).value })}
                    placeholder="ST"
                  />
                  <input
                    className="dispatch-field w-20"
                    value={asFormText(stop.postal_code)}
                    onChange={(e) => setStop(i, { postal_code: e.target.value })}
                  onInput={(e) => setStop(i, { postal_code: (e.target as HTMLInputElement).value })}
                    placeholder="ZIP"
                  />
                </div>
              </label>
              <label className="grid gap-1 text-xs">
                Planned
                <input
                  className="dispatch-field"
                  type="datetime-local"
                  value={asDtLocal(stop.planned_at)}
                  onChange={(e) => setStop(i, { planned_at: toIsoOrNull(e.target.value) })}
                  onInput={(e) =>
                    setStop(i, { planned_at: toIsoOrNull((e.target as HTMLInputElement).value) })
                  }
                />
              </label>
              <label className="grid gap-1 text-xs">
                Actual
                <input
                  className="dispatch-field"
                  type="datetime-local"
                  value={asDtLocal(stop.actual_at)}
                  onChange={(e) => setStop(i, { actual_at: toIsoOrNull(e.target.value) })}
                  onInput={(e) =>
                    setStop(i, { actual_at: toIsoOrNull((e.target as HTMLInputElement).value) })
                  }
                />
              </label>
            </div>
          ))}
        </div>
      </div>

      {load?.id && (
        <div className="rounded-lg border border-[color:var(--dispatch-border)] p-3">
          <h3 className="mb-2 text-sm font-semibold">Cancel / Reschedule</h3>
          <p className="mb-2 text-xs text-[color:var(--dispatch-muted)]">
            Cancel requires a manual reason. Reschedule updates planned times with a desk note —
            never invents ETAs.
          </p>
          {opsError && (
            <p role="alert" className="mb-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {opsError}
            </p>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="grid gap-1 text-xs sm:col-span-2">
              Cancel reason
              <input
                ref={cancelReasonRef}
                data-testid="dispatch-cancel-reason"
                className="dispatch-field"
                value={asFormText(form.cancel_reason)}
                onChange={(e) => setForm({ ...form, cancel_reason: e.target.value })}
                onInput={(e) => setForm((f) => ({ ...f, cancel_reason: (e.target as HTMLInputElement).value }))}
                placeholder="Required to cancel"
              />
            </label>
            <label className="grid gap-1 text-xs sm:col-span-2">
              Reschedule note
              <input
                ref={rescheduleNoteRef}
                data-testid="dispatch-reschedule-note"
                className="dispatch-field"
                value={asFormText(form.reschedule_note)}
                onChange={(e) => setForm({ ...form, reschedule_note: e.target.value })}
                onInput={(e) => setForm((f) => ({ ...f, reschedule_note: (e.target as HTMLInputElement).value }))}
                placeholder="Why planned times changed"
              />
            </label>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className="dispatch-btn-ghost"
              disabled={opsBusy || load.status === "cancelled" || load.status === "closed"}
              onClick={async () => {
                const nextCancel = (
                  form.cancel_reason.trim() ||
                  cancelReasonRef.current?.value ||
                  ""
                ).trim();
                const err = validateCancel(nextCancel);
                if (err) {
                  setOpsError(err);
                  return;
                }
                setOpsBusy(true);
                setOpsError(null);
                try {
                  const next = await cancelLoad(load, nextCancel);
                  setForm((f) => ({
                    ...f,
                    status: "cancelled",
                    cancel_reason: next.cancel_reason ?? f.cancel_reason,
                  }));
                  await onLoadChanged(next);
                } catch (e) {
                  setOpsError(e instanceof Error ? e.message : "Cancel failed.");
                } finally {
                  setOpsBusy(false);
                }
              }}
            >
              Cancel load
            </button>
            <button
              type="button"
              className="dispatch-btn-primary"
              disabled={opsBusy}
              onClick={async () => {
                const pickup = toIsoOrNull(form.planned_pickup_at);
                const delivery = toIsoOrNull(form.planned_delivery_at);
                const nextReschedule = (
                  form.reschedule_note.trim() ||
                  rescheduleNoteRef.current?.value ||
                  ""
                ).trim();
                const err = validateReschedule(nextReschedule, pickup, delivery);
                if (err) {
                  setOpsError(err);
                  return;
                }
                setOpsBusy(true);
                setOpsError(null);
                try {
                  const next = await rescheduleLoad(load, {
                    note: nextReschedule,
                    planned_pickup_at: pickup,
                    planned_delivery_at: delivery,
                    stops: editorStops.map((s, idx) => ({ ...s, sequence: idx + 1 })),
                  });
                  setForm((f) => ({
                    ...f,
                    reschedule_note: next.reschedule_note ?? f.reschedule_note,
                    status: next.status,
                  }));
                  await onLoadChanged(next);
                } catch (e) {
                  setOpsError(e instanceof Error ? e.message : "Reschedule failed.");
                } finally {
                  setOpsBusy(false);
                }
              }}
            >
              Save reschedule
            </button>
          </div>
        </div>
      )}

      {load?.id && (
        <div className="rounded-lg border border-[color:var(--dispatch-border)] p-3">
          <h3 className="mb-2 text-sm font-semibold">Closeout / Reopen / Payment</h3>
          <p className="mb-2 text-xs text-[color:var(--dispatch-muted)]">
            Delivered ≠ Closed ≠ Paid. Closing never marks paid; paying never closes. Reopen returns
            closed → delivered.
          </p>
          {opsError && (
            <p role="alert" className="mb-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {opsError}
            </p>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="grid gap-1 text-xs sm:col-span-2">
              Closeout note
              <input
                ref={closeoutNoteRef}
                data-testid="dispatch-closeout-note"
                className="dispatch-field"
                value={asFormText(form.closeout_note)}
                onChange={(e) => setForm({ ...form, closeout_note: e.target.value })}
                onInput={(e) => setForm((f) => ({ ...f, closeout_note: (e.target as HTMLInputElement).value }))}
                placeholder="Required to close"
              />
            </label>
            <label className="grid gap-1 text-xs sm:col-span-2">
              Reopen reason
              <input
                ref={reopenReasonRef}
                data-testid="dispatch-reopen-reason"
                className="dispatch-field"
                value={asFormText(form.reopen_reason)}
                onChange={(e) => setForm({ ...form, reopen_reason: e.target.value })}
                onInput={(e) => setForm((f) => ({ ...f, reopen_reason: (e.target as HTMLInputElement).value }))}
                placeholder="Required to reopen closed → delivered"
              />
            </label>
            <label className="grid gap-1 text-xs">
              Payment status (independent)
              <select
                className="dispatch-field"
                value={form.payment_status}
                onChange={(e) =>
                  setForm({ ...form, payment_status: e.target.value as PaymentStatus })
                }
              >
                {(Object.keys(PAYMENT_STATUS_LABELS) as PaymentStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {PAYMENT_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className="dispatch-btn-primary"
              disabled={opsBusy || load.status !== "delivered"}
              onClick={async () => {
                const nextClose = (
                  form.closeout_note.trim() ||
                  closeoutNoteRef.current?.value ||
                  ""
                ).trim();
                const err = validateCloseout(nextClose);
                if (err) {
                  setOpsError(err);
                  return;
                }
                setOpsBusy(true);
                setOpsError(null);
                try {
                  const next = await closeLoad(load, nextClose);
                  setForm((f) => ({
                    ...f,
                    status: "closed",
                    closeout_note: next.closeout_note ?? f.closeout_note,
                    payment_status: next.payment_status,
                  }));
                  await onLoadChanged(next);
                } catch (e) {
                  setOpsError(e instanceof Error ? e.message : "Closeout failed.");
                } finally {
                  setOpsBusy(false);
                }
              }}
            >
              Close load
            </button>
            <button
              type="button"
              className="dispatch-btn-ghost"
              disabled={opsBusy || load.status !== "closed"}
              onClick={async () => {
                const nextReopen = (
                  form.reopen_reason.trim() ||
                  reopenReasonRef.current?.value ||
                  ""
                ).trim();
                const err = validateReopen(nextReopen);
                if (err) {
                  setOpsError(err);
                  return;
                }
                setOpsBusy(true);
                setOpsError(null);
                try {
                  const next = await reopenLoad(load, nextReopen);
                  setForm((f) => ({
                    ...f,
                    status: "delivered",
                    reopen_reason: next.reopen_reason ?? f.reopen_reason,
                    payment_status: next.payment_status,
                  }));
                  await onLoadChanged(next);
                } catch (e) {
                  setOpsError(e instanceof Error ? e.message : "Reopen failed.");
                } finally {
                  setOpsBusy(false);
                }
              }}
            >
              Reopen to delivered
            </button>
            <button
              type="button"
              className="dispatch-btn-ghost"
              disabled={opsBusy}
              onClick={async () => {
                setOpsBusy(true);
                setOpsError(null);
                try {
                  const next = await setLoadPaymentStatus(load, form.payment_status);
                  setForm((f) => ({
                    ...f,
                    payment_status: next.payment_status,
                    status: next.status,
                  }));
                  await onLoadChanged(next);
                } catch (e) {
                  setOpsError(e instanceof Error ? e.message : "Payment update failed.");
                } finally {
                  setOpsBusy(false);
                }
              }}
            >
              Save payment status
            </button>
          </div>
        </div>
      )}

      {load?.id && (
        <>
          <div className="rounded-lg border border-[color:var(--dispatch-border)] p-3">
            <h3 className="mb-2 text-sm font-semibold">Communication &amp; decisions</h3>
            <p className="mb-2 text-xs text-[color:var(--dispatch-muted)]">
              Desk log only — never sends email, SMS, or push.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="grid gap-1 text-xs">
                Kind
                <select
                  className="dispatch-field"
                  value={commKind}
                  onChange={(e) => setCommKind(e.target.value as CommunicationKind)}
                >
                  <option value="call">Call</option>
                  <option value="email_note">Email note (manual)</option>
                  <option value="decision">Decision</option>
                  <option value="note">Note</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs sm:col-span-2">
                Summary
                <input
                  ref={commSummaryRef}
                  data-testid="dispatch-comm-summary"
                  className="dispatch-field"
                  value={commSummary}
                  onChange={(e) => setCommSummary(e.target.value)}
                  onInput={(e) => setCommSummary((e.target as HTMLInputElement).value)}
                />
              </label>
              {commKind === "decision" && (
                <label className="grid gap-1 text-xs sm:col-span-2">
                  Decided action
                  <input
                    ref={commDecisionRef}
                    data-testid="dispatch-comm-decision"
                    className="dispatch-field"
                    value={commDecision}
                    onChange={(e) => setCommDecision(e.target.value)}
                    onInput={(e) => setCommDecision((e.target as HTMLInputElement).value)}
                  />
                </label>
              )}
              <label className="grid gap-1 text-xs sm:col-span-2">
                Detail
                <input
                  ref={commDetailRef}
                  data-testid="dispatch-comm-detail"
                  className="dispatch-field"
                  value={commDetail}
                  onChange={(e) => setCommDetail(e.target.value)}
                  onInput={(e) => setCommDetail((e.target as HTMLInputElement).value)}
                />
              </label>
            </div>
            <button
              type="button"
              className="dispatch-btn-primary mt-2"
              disabled={opsBusy}
              onClick={async () => {
                const nextSummary = (commSummary.trim() || commSummaryRef.current?.value || "").trim();
                const nextDecision = (commDecision.trim() || commDecisionRef.current?.value || "").trim();
                const nextDetail = (commDetail.trim() || commDetailRef.current?.value || "").trim();
                const err = validateCommunication({
                  kind: commKind,
                  summary: nextSummary,
                  decided_action: nextDecision,
                });
                if (err) {
                  setOpsError(err);
                  return;
                }
                setOpsBusy(true);
                setOpsError(null);
                try {
                  await saveCommunication({
                    load_id: load.id,
                    kind: commKind,
                    summary: nextSummary,
                    detail: nextDetail || null,
                    decided_action: commKind === "decision" ? nextDecision : null,
                  });
                  setCommSummary("");
                  setCommDetail("");
                  setCommDecision("");
                  const nextComms = await listCommunications(load.id);
                  setComms(Array.isArray(nextComms) ? nextComms : []);
                } catch (e) {
                  setOpsError(e instanceof Error ? e.message : "Could not save communication.");
                } finally {
                  setOpsBusy(false);
                }
              }}
            >
              Log communication
            </button>
            <ul className="mt-3 space-y-2 text-sm">
              {comms.map((c) => (
                <li key={c.id} className="rounded-md bg-[color:var(--dispatch-soft)] px-2 py-1.5">
                  <span className="font-medium">
                    {asFormText(c.kind)} · {new Date(c.created_at).toLocaleString()}
                  </span>
                  {" — "}
                  {asFormText(c.summary)}
                  {c.decided_action ? ` · Decision: ${asFormText(c.decided_action)}` : ""}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-[color:var(--dispatch-border)] p-3">
            <h3 className="mb-2 text-sm font-semibold">Detention / accessorials on this load</h3>
            <p className="mb-2 text-xs text-[color:var(--dispatch-muted)]">
              {accessorials.length} claim(s). Use Detention / Accessorials board for full edit — no
              auto HR expense.
            </p>
            {!accessorials.length ? (
              <EmptyHint>No accessorials on this load.</EmptyHint>
            ) : (
              <ul className="space-y-1 text-sm">
                {accessorials.map((a) => (
                  <li key={a.id}>
                    {asFormText(a.kind)} · {asFormText(a.status)} · {asFormText(a.description)}
                    {a.amount_manual == null
                      ? " · amount Needs Policy"
                      : ` · ${asFormText(a.currency)} ${a.amount_manual}`}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-lg border border-[color:var(--dispatch-border)] p-3">
            <h3 className="mb-2 text-sm font-semibold">Check-call</h3>
            <p className="mb-2 text-xs text-[color:var(--dispatch-muted)]">
              Manual check-call log. Location fields are never Live GPS.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                ref={checkLocationRef}
                data-testid="dispatch-check-location"
                className="dispatch-field"
                placeholder="Manual location"
                value={checkLocation}
                onChange={(e) => setCheckLocation(e.target.value)}
                onInput={(e) => setCheckLocation((e.target as HTMLInputElement).value)}
              />
              <input
                ref={checkNotesRef}
                data-testid="dispatch-check-notes"
                className="dispatch-field"
                placeholder="Notes"
                value={checkNotes}
                onChange={(e) => setCheckNotes(e.target.value)}
                onInput={(e) => setCheckNotes((e.target as HTMLInputElement).value)}
              />
            </div>
            <button
              type="button"
              className="dispatch-btn-primary mt-2"
              onClick={async () => {
                const nextNotes = (checkNotes.trim() || checkNotesRef.current?.value || "").trim();
                const nextLoc = (checkLocation.trim() || checkLocationRef.current?.value || "").trim();
                if (!nextNotes) return;
                await addCheckCall({
                  load_id: load.id,
                  notes: nextNotes,
                  manual_location: nextLoc || null,
                });
                setCheckNotes("");
                setCheckLocation("");
                const nextCalls = await listCheckCalls(load.id);
                setCalls(Array.isArray(nextCalls) ? nextCalls : []);
                if (nextLoc) {
                  setForm((f) => ({ ...f, last_manual_location: nextLoc }));
                }
              }}
            >
              Log check-call
            </button>
            <ul className="mt-3 space-y-2 text-sm">
              {calls.map((c) => (
                <li key={c.id} className="rounded-md bg-[color:var(--dispatch-soft)] px-2 py-1.5">
                  <span className="font-medium">{new Date(c.called_at).toLocaleString()}</span>
                  {c.manual_location ? ` · ${asFormText(c.manual_location)}` : ""} —{" "}
                  {asFormText(c.notes)}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-[color:var(--dispatch-border)] p-3">
            <h3 className="mb-2 text-sm font-semibold">Open exception</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                ref={excKindRef}
                data-testid="dispatch-exc-kind"
                className="dispatch-field"
                value={excKind}
                onChange={(e) => setExcKind(e.target.value)}
                onInput={(e) => setExcKind((e.target as HTMLInputElement).value)}
              />
              <input
                ref={excNotesRef}
                data-testid="dispatch-exc-notes"
                className="dispatch-field"
                value={excNotes}
                onChange={(e) => setExcNotes(e.target.value)}
                onInput={(e) => setExcNotes((e.target as HTMLInputElement).value)}
                placeholder="Notes"
              />
            </div>
            <button
              type="button"
              className="dispatch-btn-ghost mt-2"
              onClick={async () => {
                const nextKind = (excKind.trim() || excKindRef.current?.value || "Delay").trim() || "Delay";
                const nextNotes = (excNotes.trim() || excNotesRef.current?.value || "").trim();
                await saveException({
                  load_id: load.id,
                  kind: nextKind,
                  notes: nextNotes,
                  severity: "medium",
                });
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
          data-testid="dispatch-save-load"
          disabled={busy}
          onClick={async () => {
            const loadNumber = (
              form.load_number.trim() ||
              loadNumberRef.current?.value ||
              ""
            ).trim();
            if (!loadNumber) return;
            const customer =
              form.customer_name || customerRef.current?.value || "";
            const notes = form.notes || notesRef.current?.value || "";
            const driver = safeDrivers.find((d) => d.id === form.assigned_driver_id);
            await onSaved({
              ...(form.id ? { id: form.id } : {}),
              load_number: loadNumber,
              customer_name: customer || null,
              commodity: form.commodity || null,
              equipment: form.equipment || null,
              notes: notes || null,
              status: form.status,
              exception_open: form.exception_open,
              bol_status: form.bol_status,
              pod_status: form.pod_status,
              assigned_driver_id: form.assigned_driver_id || null,
              assigned_driver_name: driver ? asFormText(driver.display_name) || null : null,
              external_ref_label: form.external_ref_label || null,
              external_ref_url: form.external_ref_url || null,
              planned_pickup_at: toIsoOrNull(form.planned_pickup_at),
              actual_pickup_at: toIsoOrNull(form.actual_pickup_at),
              planned_delivery_at: toIsoOrNull(form.planned_delivery_at),
              actual_delivery_at: toIsoOrNull(form.actual_delivery_at),
              last_manual_location: form.last_manual_location || null,
              last_manual_location_at: form.last_manual_location
                ? (load?.last_manual_location_at ?? new Date().toISOString())
                : null,
              cancel_reason: (form.cancel_reason || cancelReasonRef.current?.value || "") || null,
              reschedule_note: (form.reschedule_note || rescheduleNoteRef.current?.value || "") || null,
              closeout_note: (form.closeout_note || closeoutNoteRef.current?.value || "") || null,
              reopen_reason: (form.reopen_reason || reopenReasonRef.current?.value || "") || null,
              payment_status: form.payment_status,
              closed_at: load?.closed_at ?? null,
              reopened_at: load?.reopened_at ?? null,
              stale_after_minutes: form.stale_after_minutes,
              stops: editorStops.map((s, i) => ({ ...s, sequence: i + 1 })),
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
  const nameRef = useRef<HTMLInputElement>(null);
  const unitRef = useRef<HTMLInputElement>(null);
  const safeDrivers = Array.isArray(drivers) ? drivers : [];
  return (
    <section className="dispatch-panel">
      <SectionHelp>
        Dispatch-owned roster only. This does <strong>not</strong> read Driver Compliance profiles,
        drug tests, rate cards, or banking. Cross-module driver picker requires a separate approved
        integration.
      </SectionHelp>
      <div className="mb-3 flex flex-wrap gap-2">
        <input
          ref={nameRef}
          data-testid="dispatch-roster-name"
          className="dispatch-field"
          placeholder="Driver name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onInput={(e) => setName((e.target as HTMLInputElement).value)}
        />
        <input
          ref={unitRef}
          data-testid="dispatch-roster-unit"
          className="dispatch-field w-28"
          placeholder="Unit #"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          onInput={(e) => setUnit((e.target as HTMLInputElement).value)}
        />
        <button
          type="button"
          className="dispatch-btn-primary"
          onClick={async () => {
            const nextName = (name.trim() || nameRef.current?.value || "").trim();
            const nextUnit = (unit.trim() || unitRef.current?.value || "").trim();
            if (!nextName) return;
            await onSave({ display_name: nextName, unit_number: nextUnit || null });
            setName("");
            setUnit("");
          }}
        >
          Add roster driver
        </button>
      </div>
      {!safeDrivers.length ? (
        <EmptyHint>No roster drivers yet.</EmptyHint>
      ) : (
        <ul className="divide-y divide-[color:var(--dispatch-border)]">
          {safeDrivers.map((d) => (
            <li key={d.id} className="flex justify-between py-2 text-sm">
              <span className="font-medium">
                {asFormText(d.display_name)}
                {d.unit_number ? ` · #${asFormText(d.unit_number)}` : ""}
              </span>
              <span className="text-[color:var(--dispatch-muted)]">
                {asFormText(d.notes) || "Active"}
              </span>
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
  const safeLoads = Array.isArray(loads) ? loads : [];
  const openLoads = safeLoads.filter(
    (l) => ACTIVE_LOAD_STATUSES.includes(l.status) || l.status === "delivered",
  );
  const [rows, setRows] = useState<ShiftHandover[]>([]);
  const [summary, setSummary] = useState("");
  const [watch, setWatch] = useState("");
  const [priorities, setPriorities] = useState("");
  const [toDispatcher, setToDispatcher] = useState("");
  const [hintsReady, setHintsReady] = useState(false);
  const summaryRef = useRef<HTMLTextAreaElement>(null);
  const watchRef = useRef<HTMLTextAreaElement>(null);
  const prioritiesRef = useRef<HTMLTextAreaElement>(null);
  const toDispatcherRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void listHandovers().then((next) => setRows(Array.isArray(next) ? next : []));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [issues, followUps] = await Promise.all([listIssues(), listFollowUps()]);
      if (cancelled) return;
      const hints = buildHandoverWatchHints({
        loads: safeLoads,
        issues: Array.isArray(issues) ? issues : [],
        followUps: Array.isArray(followUps) ? followUps : [],
      });
      if (hints && !hintsReady) {
        setWatch((prev) => (prev.trim() ? prev : hints));
        setHintsReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loads, hintsReady]);

  return (
    <section className="dispatch-panel grid gap-3">
      <SectionHelp>
        Morning continuity: capture open loads, watch items, and next-day priorities before the desk
        turns over. Watch hints pull BOL/POD awaiting, open issues, due follow-ups, and
        cancellations — never invents ETAs or GPS.
      </SectionHelp>
      <label className="grid gap-1 text-sm">
        Summary
        <textarea
          ref={summaryRef}
          data-testid="dispatch-handover-summary"
          className="dispatch-field min-h-24"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          onInput={(e) => setSummary((e.target as HTMLTextAreaElement).value)}
        />
      </label>
      <label className="grid gap-1 text-sm">
        Watch items
        <textarea
          ref={watchRef}
          data-testid="dispatch-handover-watch"
          className="dispatch-field min-h-20"
          value={watch}
          onChange={(e) => setWatch(e.target.value)}
          onInput={(e) => setWatch((e.target as HTMLTextAreaElement).value)}
        />
      </label>
      <label className="grid gap-1 text-sm">
        Next-day priorities
        <textarea
          ref={prioritiesRef}
          data-testid="dispatch-handover-priorities"
          className="dispatch-field min-h-20"
          value={priorities}
          onChange={(e) => setPriorities(e.target.value)}
          onInput={(e) => setPriorities((e.target as HTMLTextAreaElement).value)}
        />
      </label>
      <label className="grid gap-1 text-sm">
        To dispatcher
        <input
          ref={toDispatcherRef}
          data-testid="dispatch-handover-to"
          className="dispatch-field"
          value={toDispatcher}
          onChange={(e) => setToDispatcher(e.target.value)}
          onInput={(e) => setToDispatcher((e.target as HTMLInputElement).value)}
        />
      </label>
      <p className="text-xs text-[color:var(--dispatch-muted)]">
        Open loads included: {openLoads.map((l) => l.load_number).join(", ") || "none"}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="dispatch-btn-primary"
          onClick={async () => {
            const nextSummary = summary || summaryRef.current?.value || "";
            const nextWatch = watch || watchRef.current?.value || "";
            const nextPriorities = priorities || prioritiesRef.current?.value || "";
            const nextTo = (toDispatcher.trim() || toDispatcherRef.current?.value || "").trim();
            const saved = await saveHandover({
              shift_date: new Date().toISOString().slice(0, 10),
              from_dispatcher: asFormText(account.display_name),
              to_dispatcher: nextTo || null,
              summary: nextSummary,
              watch_items: nextWatch,
              next_day_priorities: nextPriorities,
              open_load_ids: openLoads.map((l) => l.id),
            });
            const nextRows = await listHandovers();
            setRows(Array.isArray(nextRows) ? nextRows : []);
            await onSaved();
            exportHandoverPdf(saved, safeLoads);
          }}
        >
          Save handover + PDF
        </button>
      </div>
      <ul className="space-y-2">
        {rows.map((h) => (
          <li key={h.id} className="rounded-lg bg-[color:var(--dispatch-soft)] px-3 py-2 text-sm">
            <p className="font-semibold">
              {asFormText(h.shift_date)} · {asFormText(h.from_dispatcher)} →{" "}
              {asFormText(h.to_dispatcher) || "—"}
            </p>
            <p className="text-[color:var(--dispatch-muted)]">{asFormText(h.summary)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function IssuesBoard({ loads }: { loads: DispatchLoad[] }) {
  const safeLoads = Array.isArray(loads) ? loads : [];
  const [issues, setIssues] = useState<Awaited<ReturnType<typeof listIssues>>>([]);
  const [exceptions, setExceptions] = useState<Awaited<ReturnType<typeof listExceptions>>>([]);
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [loadId, setLoadId] = useState("");
  const [level, setLevel] = useState<DispatchIssue["escalation_level"]>("ops");
  const [seniorNote, setSeniorNote] = useState("");
  const issueTitleRef = useRef<HTMLInputElement>(null);
  const issueDetailRef = useRef<HTMLInputElement>(null);
  const seniorNoteRef = useRef<HTMLInputElement>(null);

  async function reload() {
    const [iss, exc] = await Promise.all([listIssues(), listExceptions()]);
    setIssues(Array.isArray(iss) ? iss : []);
    setExceptions(Array.isArray(exc) ? exc : []);
  }

  useEffect(() => {
    void reload();
  }, []);

  return (
    <div className="grid gap-3">
      <section className="dispatch-panel">
        <h2 className="mb-2 text-base font-semibold">Issues & escalations</h2>
        <SectionHelp>
          Escalate desk problems without changing load status by itself.{" "}
          <strong>Senior Informed</strong> is a manual checkbox/note only — it never sends
          notifications.
        </SectionHelp>
        <div className="mb-3 grid gap-2 sm:grid-cols-2">
          <input
            ref={issueTitleRef}
            data-testid="dispatch-issue-title"
            className="dispatch-field"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onInput={(e) => setTitle((e.target as HTMLInputElement).value)}
          />
          <select
            className="dispatch-field"
            value={loadId}
            onChange={(e) => setLoadId(e.target.value)}
          >
            <option value="">No load link</option>
            {safeLoads.map((l) => (
              <option key={l.id} value={l.id}>
                {asFormText(l.load_number)}
              </option>
            ))}
          </select>
          <select
            className="dispatch-field"
            value={level}
            onChange={(e) => setLevel(e.target.value as DispatchIssue["escalation_level"])}
          >
            <option value="ops">ops</option>
            <option value="supervisor">supervisor</option>
            <option value="manager">manager</option>
            <option value="critical">critical</option>
          </select>
          <input
            ref={issueDetailRef}
            data-testid="dispatch-issue-detail"
            className="dispatch-field"
            placeholder="Detail"
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            onInput={(e) => setDetail((e.target as HTMLInputElement).value)}
          />
        </div>
        <button
          type="button"
          className="dispatch-btn-primary"
          onClick={async () => {
            const nextTitle = (title.trim() || issueTitleRef.current?.value || "").trim();
            const nextDetail = detail || issueDetailRef.current?.value || "";
            if (!nextTitle) return;
            await saveIssue({
              title: nextTitle,
              detail: nextDetail,
              load_id: loadId || null,
              escalation_level: level,
              senior_informed: false,
            });
            setTitle("");
            setDetail("");
            await reload();
          }}
        >
          Open issue
        </button>
        <ul className="mt-3 divide-y divide-[color:var(--dispatch-border)]">
          {issues.map((issue) => (
            <li key={issue.id} className="grid gap-2 py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{asFormText(issue.title)}</p>
                  <p className="text-xs text-[color:var(--dispatch-muted)]">
                    {asFormText(issue.status)} · {asFormText(issue.escalation_level)}
                    {issue.senior_informed
                      ? ` · Senior Informed ${issue.senior_informed_at ? new Date(issue.senior_informed_at).toLocaleString() : ""}`
                      : " · Senior Informed: not recorded"}
                  </p>
                  {issue.senior_informed_note && (
                    <p className="text-xs text-[color:var(--dispatch-muted)]">
                      {asFormText(issue.senior_informed_note)}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {issue.status !== "resolved" && (
                    <>
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
                      <button
                        type="button"
                        className="dispatch-btn-ghost"
                        onClick={async () => {
                          await saveIssue({ ...issue, status: "resolved" });
                          await reload();
                        }}
                      >
                        Resolve
                      </button>
                    </>
                  )}
                </div>
              </div>
              {issue.status !== "resolved" && !issue.senior_informed && (
                <div className="flex flex-wrap items-end gap-2 rounded-md bg-[color:var(--dispatch-soft)] p-2">
                  <label className="grid flex-1 gap-1 text-xs">
                    Senior Informed note (manual)
                    <input
                      ref={seniorNoteRef}
                      data-testid="dispatch-senior-note"
                      className="dispatch-field"
                      placeholder="Who/when you informed — desk record only"
                      value={seniorNote}
                      onChange={(e) => setSeniorNote(e.target.value)}
                      onInput={(e) => setSeniorNote((e.target as HTMLInputElement).value)}
                    />
                  </label>
                  <button
                    type="button"
                    className="dispatch-btn-primary"
                    onClick={async () => {
                      await saveIssue({
                        ...issue,
                        senior_informed: true,
                        senior_informed_note:
                          (seniorNote.trim() || seniorNoteRef.current?.value || "").trim() ||
                          "Marked informed by desk",
                        senior_informed_at: new Date().toISOString(),
                      });
                      setSeniorNote("");
                      await reload();
                    }}
                  >
                    Mark Senior Informed
                  </button>
                </div>
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
                {asFormText(ex.kind)} · {asFormText(ex.severity)} · {asFormText(ex.status)}
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
  const safeLoads = Array.isArray(loads) ? loads : [];
  const safeDrivers = Array.isArray(drivers) ? drivers : [];
  const [mode, setMode] = useState<"driver" | "complete">("complete");
  const [driverId, setDriverId] = useState(safeDrivers[0]?.id ?? "");
  const [loadId, setLoadId] = useState(safeLoads[0]?.id ?? "");
  const [events, setEvents] = useState<ReturnType<typeof buildCompleteLoadHistory>>([]);
  const [error, setError] = useState<string | null>(null);
  const driverHistory = driverId ? driverLoadHistory(safeLoads, driverId) : [];
  const selectedLoad = safeLoads.find((l) => l.id === loadId) ?? null;

  useEffect(() => {
    if (mode !== "complete" || !selectedLoad) {
      setEvents([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [checkCalls, issues, followUps, communications, accessorials] = await Promise.all([
          listCheckCalls(selectedLoad.id),
          listIssues(),
          listFollowUps(),
          listCommunications(selectedLoad.id),
          listAccessorials(selectedLoad.id),
        ]);
        if (cancelled) return;
        const issueList = Array.isArray(issues) ? issues : [];
        const fuList = Array.isArray(followUps) ? followUps : [];
        setEvents(
          buildCompleteLoadHistory({
            load: selectedLoad,
            checkCalls: Array.isArray(checkCalls) ? checkCalls : [],
            issues: issueList.filter((i) => i.load_id === selectedLoad.id),
            followUps: fuList.filter((f) => f.load_id === selectedLoad.id),
            communications: Array.isArray(communications) ? communications : [],
            accessorials: Array.isArray(accessorials) ? accessorials : [],
          }),
        );
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not build history.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, selectedLoad]);

  return (
    <div className="grid gap-3">
      <SectionHelp>
        Complete load history combines check-calls, issues, follow-ups, communications,
        accessorials, and closeout events. Driver filter remains roster-scoped (not Compliance
        dossier). Delivered ≠ Closed ≠ Paid.
      </SectionHelp>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={mode === "complete" ? "dispatch-btn-primary" : "dispatch-btn-ghost"}
          onClick={() => setMode("complete")}
        >
          Complete load timeline
        </button>
        <button
          type="button"
          className={mode === "driver" ? "dispatch-btn-primary" : "dispatch-btn-ghost"}
          onClick={() => setMode("driver")}
        >
          By roster driver
        </button>
      </div>
      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {mode === "driver" ? (
        <section className="dispatch-panel">
          <select
            className="dispatch-field mb-3 max-w-sm"
            value={driverId}
            onChange={(e) => setDriverId(e.target.value)}
          >
            {safeDrivers.map((d) => (
              <option key={d.id} value={d.id}>
                {asFormText(d.display_name)}
              </option>
            ))}
          </select>
          {!driverHistory.length ? (
            <EmptyHint>No loads for this driver.</EmptyHint>
          ) : (
            <ul className="divide-y divide-[color:var(--dispatch-border)]">
              {driverHistory.map((load) => (
                <li key={load.id} className="flex items-center justify-between py-2 text-sm">
                  <span>
                    {asFormText(load.load_number)} · {statusLabel(load.status)} · pay{" "}
                    {paymentStatusLabel(load.payment_status)}
                  </span>
                  <button
                    type="button"
                    className="dispatch-btn-primary"
                    onClick={() => onOpen(load.id)}
                  >
                    Update Load
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <section className="dispatch-panel">
          <div className="mb-3 flex flex-wrap items-end gap-2">
            <label className="grid gap-1 text-xs">
              Load
              <select
                className="dispatch-field min-w-[14rem]"
                value={loadId}
                onChange={(e) => setLoadId(e.target.value)}
              >
                {safeLoads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {asFormText(l.load_number)} · {statusLabel(l.status)}
                  </option>
                ))}
              </select>
            </label>
            {selectedLoad && (
              <>
                <button
                  type="button"
                  className="dispatch-btn-primary"
                  onClick={() => onOpen(selectedLoad.id)}
                >
                  Update Load
                </button>
                <button
                  type="button"
                  className="dispatch-btn-ghost"
                  onClick={() => exportLoadHistoryPdf(selectedLoad, events)}
                >
                  Export history PDF
                </button>
              </>
            )}
          </div>
          {!events.length ? (
            <EmptyHint>No timeline events for this load.</EmptyHint>
          ) : (
            <ul className="divide-y divide-[color:var(--dispatch-border)]">
              {events.map((e, i) => (
                <li key={`${e.at}-${e.source}-${i}`} className="py-2 text-sm">
                  <p className="font-semibold">
                    {asFormText(e.title)}{" "}
                    <span className="text-xs font-normal text-[color:var(--dispatch-muted)]">
                      ({asFormText(e.source)})
                    </span>
                  </p>
                  <p className="text-xs text-[color:var(--dispatch-muted)]">
                    {new Date(e.at).toLocaleString()} · {asFormText(e.detail)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function ReportsBoard({ loads, drivers }: { loads: DispatchLoad[]; drivers: RosterDriver[] }) {
  const safeLoads = Array.isArray(loads) ? loads : [];
  const safeDrivers = Array.isArray(drivers) ? drivers : [];
  const [statusFilter, setStatusFilter] = useState<"all" | LoadStatus>("all");
  const [accessorials, setAccessorials] = useState<Awaited<ReturnType<typeof listAccessorials>>>(
    [],
  );
  const filtered =
    statusFilter === "all" ? safeLoads : safeLoads.filter((l) => l.status === statusFilter);

  useEffect(() => {
    void listAccessorials()
      .then((rows) => setAccessorials(Array.isArray(rows) ? rows : []))
      .catch(() => setAccessorials([]));
  }, [loads]);

  return (
    <section className="dispatch-panel grid gap-3">
      <SectionHelp>
        Dispatch PDF/CSV exports for desk reporting. Includes payment/closeout columns. No rate
        cards, free-time calculators, or Admin payroll fields. Accessorial export is manual amounts
        only.
      </SectionHelp>
      <label className="grid max-w-xs gap-1 text-xs">
        Status filter
        <select
          className="dispatch-field"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "all" | LoadStatus)}
        >
          <option value="all">All</option>
          {(Object.keys(LOAD_STATUS_LABELS) as LoadStatus[]).map((s) => (
            <option key={s} value={s}>
              {LOAD_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="dispatch-btn-primary"
          onClick={() => exportLoadsCsv(filtered)}
        >
          Loads CSV
        </button>
        <button
          type="button"
          className="dispatch-btn-ghost"
          onClick={() => exportLoadsPdf(filtered)}
        >
          Loads PDF
        </button>
        <button
          type="button"
          className="dispatch-btn-ghost"
          onClick={() => exportAccessorialsCsv(accessorials)}
        >
          Accessorials CSV
        </button>
        <button
          type="button"
          className="dispatch-btn-ghost"
          onClick={() => exportAccessorialsPdf(accessorials, safeLoads)}
        >
          Accessorials PDF
        </button>
      </div>
      <p className="text-sm text-[color:var(--dispatch-muted)]">
        {filtered.length} loads · {accessorials.length} accessorials · {safeDrivers.length} roster
        drivers · Delivered ≠ Closed ≠ Paid
      </p>
    </section>
  );
}

function TeamBoard({ account }: { account: DispatchAccount }) {
  const [rows, setRows] = useState<DispatchAccount[]>([]);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const displayNameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  async function reload() {
    const next = await listDispatchAccounts();
    setRows((Array.isArray(next) ? next : []).map((a) => healDispatchAccount(a)));
  }

  useEffect(() => {
    void reload().catch((err) =>
      setMsg(err instanceof Error ? err.message : "Could not load team."),
    );
  }, []);

  return (
    <section className="dispatch-panel grid gap-3">
      <SectionHelp>
        Invite or revoke Dispatch users. Backend edge function + RLS enforce admin. Dedicated
        dispatcher emails only — never reuse Driver Compliance seats.
      </SectionHelp>
      {isDispatchPreviewMode() && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Invite/revoke needs cloud SQL + create-dispatch-user function (approval gate).
        </p>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          ref={emailRef}
          data-testid="dispatch-invite-email"
          className="dispatch-field"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
        />
        <input
          ref={displayNameRef}
          data-testid="dispatch-invite-name"
          className="dispatch-field"
          placeholder="Display name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          onInput={(e) => setDisplayName((e.target as HTMLInputElement).value)}
        />
        <input
          ref={passwordRef}
          data-testid="dispatch-invite-password"
          className="dispatch-field"
          type="password"
          placeholder="Temp password (8+)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
        />
        <button
          type="button"
          className="dispatch-btn-primary"
          onClick={async () => {
            setMsg(null);
            try {
              await inviteDispatchUser({
                email: (email.trim() || emailRef.current?.value || "").trim(),
                displayName: (displayName.trim() || displayNameRef.current?.value || "").trim(),
                password: (password.trim() || passwordRef.current?.value || "").trim(),
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
                {asFormText(row.display_name)} · {asFormText(row.email)}
              </p>
              <p className="text-xs text-[color:var(--dispatch-muted)]">
                {asFormText(row.role)} · {row.active ? "active" : "revoked"}
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
