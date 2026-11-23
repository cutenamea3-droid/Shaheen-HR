import {
  createContext,
  useContext,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link, useLocation, useRouter, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  FileText,
  HeartPulse,
  SearchCheck,
  IdCard,
  FolderOpen,
  Users,
  UserX,
  PanelLeftClose,
  PanelLeftOpen,
  Download,
  Upload,
  RotateCcw,
  ClipboardList,
  FlaskConical,
  Bell,
  Eraser,
} from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/logo.jpg.asset.json";
import { cn } from "@/lib/utils";
import { setWorkMode, useWorkMode } from "@/lib/workmode";
import { setViewMode, useViewMode } from "@/lib/viewmode";
import { useDensity } from "@/lib/density";
import { Activity, Briefcase, Eye, LogOut, ShieldCheck, UserCog } from "lucide-react";
import {
  isPreviewIsolated,
  lockPortal,
  useOptionalPortalAccount,
  usePortalAccount,
} from "./LockGate";
import { applyTheme, setDarkMode, useDarkMode } from "@/lib/theme";
import { Moon, Sun } from "lucide-react";
import { DensityToggle } from "./DensityToggle";
import { ComplianceDrBackupControls } from "./ComplianceDrBackupControls";
import { SECTIONS, headersOf } from "@/lib/sections";
import { analyzeRow, rowOrdinaryComplianceMuted } from "@/lib/alerts";
import { exportDotAuditSummary } from "@/lib/dot-audit";
import { navIsPending, shellMeta } from "@/lib/shell-meta";
import {
  backupCoverageSummary,
  clearComplianceTodayViewState,
  exportBackup,
  importBackup,
  loadFromStorage,
  resetToSpreadsheet,
  retrySync,
  useData,
  useLoaded,
  useSyncStatus,
} from "@/lib/store";
import { AlertsBell } from "./AlertsDrawer";
import { QuickFind } from "./QuickFind";

/** When set, page-level <AppShell> only guards + renders children (chrome is persistent). */
const ShellChromeContext = createContext(false);

export const SECTION_ICONS: Record<string, typeof FileText> = {
  dmv: FileText,
  medical: HeartPulse,
  queries: SearchCheck,
  ssccdl: IdCard,
  docs: FolderOpen,
  info: Users,
  inactive: UserX,
};

type ShellProps = { title: string; subtitle?: string; children: React.ReactNode };

type Crumb = { label: string; to?: string };

function driverCrumbs(pathname: string, title: string): Crumb[] {
  const root: Crumb = { label: "Driver Compliance", to: "/" };
  if (pathname === "/") return [root, { label: "Dashboard" }];
  if (pathname.startsWith("/s/")) return [root, { label: "Sections" }, { label: title }];
  if (pathname === "/drivers") return [root, { label: "Driver Cards" }];
  if (pathname === "/alerts") return [root, { label: "My Compliance Today" }];
  if (pathname === "/drug-tests") return [root, { label: "Drug Test Records" }];
  if (pathname === "/records") return [root, { label: "Records" }];
  if (pathname === "/account") return [root, { label: "My Account" }];
  if (pathname === "/team") return [root, { label: "User Accounts" }];
  if (pathname === "/activity") return [root, { label: "Activity Logs" }];
  return [root, { label: title }];
}

function ShellBreadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="shell-crumb tracker-no-print">
      {crumbs.map((c, i) => {
        const last = i === crumbs.length - 1;
        return (
          <span key={`${c.label}-${i}`} className="inline-flex items-center gap-1.5">
            {i > 0 && (
              <span className="shell-crumb-sep" aria-hidden>
                /
              </span>
            )}
            {last || !c.to ? (
              <span
                className={last ? "shell-crumb-current" : undefined}
                aria-current={last ? "page" : undefined}
              >
                {c.label}
              </span>
            ) : (
              <Link to={c.to} className="hover:text-foreground hover:underline underline-offset-2">
                {c.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}

/**
 * Persistent chrome for signed-in Driver Compliance (mounted once in LockGate).
 * Avoids remounting sidebar badges / QuickFind / AlertsBell on every section switch.
 */
export function PersistentDriverShell({ children }: { children: ReactNode }) {
  return (
    <ShellChromeContext.Provider value={true}>
      <AppShellInner>{children}</AppShellInner>
    </ShellChromeContext.Provider>
  );
}

// While switching to Admin & Attendance, the old Driver page can render once outside
// the Driver lock; show nothing instead of crashing.
// Inside PersistentDriverShell, only render page children (no nested chrome).
export function AppShell({ title: _title, subtitle: _subtitle, children }: ShellProps) {
  const portal = useOptionalPortalAccount();
  const inChrome = useContext(ShellChromeContext);
  if (!portal) return null;
  if (inChrome) return <>{children}</>;
  return <AppShellInner>{children}</AppShellInner>;
}

function AppShellInner({ children }: { children: ReactNode }) {
  const router = useRouter();
  // TanStack's Transitioner assigns React.startTransition on each render, which
  // lets location/crumbs update while the previous route body stays painted.
  // Re-assign sync commits after that so chrome + Outlet swap in one paint.
  // (Safe: AppShell sits under Matches → Transitioner always runs first.)
  router.startTransition = async (fn) => {
    const ack = router._rendered as unknown[] | undefined;
    if (ack) ack.length = 0;
    fn();
    return true;
  };

  const data = useData();
  // Defer sidebar issue badges so route content can paint first (proven hot path).
  const deferredData = useDeferredValue(data);
  const loaded = useLoaded();
  const loc = useLocation();
  const navigating = useRouterState({ select: navIsPending });
  const meta = useMemo(() => shellMeta(loc.pathname), [loc.pathname]);
  const { title, subtitle } = meta;
  const { account } = usePortalAccount();
  const [collapsed, setCollapsedState] = useState(false);
  useEffect(() => {
    if (localStorage.getItem("shaheen-sidebar-collapsed") === "1") setCollapsedState(true);
  }, []);
  const setCollapsed = (v: boolean) => {
    setCollapsedState(v);
    localStorage.setItem("shaheen-sidebar-collapsed", v ? "1" : "0");
  };
  const work = useWorkMode();
  const sync = useSyncStatus();
  const dark = useDarkMode();
  useEffect(() => applyTheme(dark), [dark]);
  const view = useViewMode();
  // Rehydrate density → documentElement dataset (local UI pref only).
  useDensity();
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => loadFromStorage(), []);
  const crumbs = useMemo(() => driverCrumbs(loc.pathname, title), [loc.pathname, title]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const def of SECTIONS) {
      const sec = deferredData.sections[def.id];
      if (!sec || !Array.isArray(sec.rows)) {
        c[def.id] = 0;
        continue;
      }
      const headers = headersOf(sec);
      c[def.id] = sec.rows.filter(
        (r) =>
          !rowOrdinaryComplianceMuted(def, r, deferredData) &&
          analyzeRow(def, headers, r).issues.length,
      ).length;
    }
    return c;
  }, [deferredData]);

  const groupLbl = (label: string) =>
    !collapsed ? <p className="shell-nav-group">{label}</p> : null;

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <a href="#main-content" className="shell-skip tracker-no-print">
        Skip to main content
      </a>
      <aside
        className={cn(
          "tracker-no-print flex shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-all",
          collapsed ? "w-16" : "w-60",
        )}
        aria-label="Driver Compliance sidebar"
      >
        <div className="flex items-center gap-3 border-b border-sidebar-border px-4 py-4">
          <img
            src={logo.url}
            alt="Shaheen Transport logo"
            className="size-12 shrink-0 rounded-xl bg-card object-contain p-0.5"
          />
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-display text-xl leading-tight font-extrabold text-brand">
                SHAHEEN
              </div>
              <div className="text-sm font-semibold tracking-wide text-ink-muted">
                Driver Files Tracker
              </div>
            </div>
          )}
        </div>
        <nav
          className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3"
          aria-label="Driver Compliance"
        >
          {groupLbl("Overview")}
          <NavItem
            to="/"
            active={loc.pathname === "/"}
            icon={LayoutDashboard}
            label="Dashboard"
            collapsed={collapsed}
          />
          <NavItem
            to="/drivers"
            active={loc.pathname === "/drivers"}
            icon={IdCard}
            label="Driver Cards"
            collapsed={collapsed}
          />
          <NavItem
            to="/alerts"
            active={loc.pathname === "/alerts"}
            icon={Bell}
            label="My Compliance Today"
            collapsed={collapsed}
          />
          {account.role === "admin" && (
            <NavItem
              to="/drug-tests"
              active={loc.pathname === "/drug-tests"}
              icon={FlaskConical}
              label="Drug Test Records"
              collapsed={collapsed}
            />
          )}
          <NavItem
            to="/records"
            active={loc.pathname === "/records"}
            icon={FolderOpen}
            label="Records"
            collapsed={collapsed}
          />
          {groupLbl("Compliance sections")}
          {SECTIONS.map((s) => (
            <NavItem
              key={s.id}
              to={`/s/${s.id}`}
              active={loc.pathname === `/s/${s.id}`}
              icon={SECTION_ICONS[s.id]}
              label={
                s.id === "dmv"
                  ? "DMV"
                  : s.id === "medical"
                    ? "Medical"
                    : s.id === "queries"
                      ? "Clearinghouse"
                      : s.id === "docs"
                        ? "Other Docs"
                        : s.title
              }
              count={counts[s.id]}
              collapsed={collapsed}
            />
          ))}
          {groupLbl("My Account")}
          <NavItem
            to="/account"
            active={loc.pathname === "/account"}
            icon={UserCog}
            label="My Account"
            collapsed={collapsed}
          />
          {account.role === "admin" && groupLbl("Team Management")}
          {account.role === "admin" && (
            <NavItem
              to="/team"
              active={loc.pathname === "/team"}
              icon={ShieldCheck}
              label="User Accounts"
              collapsed={collapsed}
            />
          )}
          {account.role === "admin" && groupLbl("System")}
          {account.role === "admin" && (
            <NavItem
              to="/activity"
              active={loc.pathname === "/activity"}
              icon={Activity}
              label="Activity Logs"
              collapsed={collapsed}
            />
          )}
        </nav>
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-expanded={!collapsed}
          aria-controls="main-content"
          className="ui-press flex items-center gap-3 border-t border-sidebar-border px-6 py-4 text-base font-semibold text-ink-muted hover:text-sidebar-foreground"
        >
          {collapsed ? <PanelLeftOpen className="size-5" /> : <PanelLeftClose className="size-5" />}
          {!collapsed && "Collapse"}
        </button>
        <button
          type="button"
          onClick={lockPortal}
          title="Log out"
          className="ui-press flex items-center gap-3 border-t border-sidebar-border px-6 py-4 text-base font-bold text-danger hover:bg-danger-soft"
        >
          <LogOut className="size-5" />
          {!collapsed && "Log out"}
        </button>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header
          className="tracker-no-print relative flex flex-wrap items-center justify-between gap-3 border-b bg-card px-5 py-3 shadow-card"
          role="banner"
        >
          <div className="min-w-0 space-y-1">
            <ShellBreadcrumbs crumbs={crumbs} />
            <h1 className="font-display text-xl font-extrabold tracking-tight">{title}</h1>
            {subtitle && !work && (
              <p className="text-sm leading-snug text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <QuickFind />
            <AlertsBell />
            <DensityToggle />
            <button
              type="button"
              onClick={() => setWorkMode(!work)}
              title="Work Mode hides explanations so you see only driver data"
              className={cn(
                btn,
                work &&
                  "border-primary bg-brand text-primary-foreground hover:text-primary-foreground",
              )}
            >
              <Briefcase className="size-4" /> Work Mode: {work ? "ON" : "OFF"}
            </button>
            <button
              type="button"
              onClick={() => setViewMode(!view)}
              title="View Mode: you can only look, nothing can be edited"
              className={cn(
                btn,
                view && "border-ink bg-ink text-ink-foreground hover:text-ink-foreground",
              )}
            >
              <Eye className="size-4" /> View Mode: {view ? "ON" : "OFF"}
            </button>
            <button
              type="button"
              onClick={() => setDarkMode(!dark)}
              title="Switch light / dark"
              className={btn}
            >
              {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}{" "}
              {dark ? "Light" : "Dark"} Mode
            </button>
            {sync === "error" ? (
              <button
                type="button"
                onClick={() => retrySync()}
                title="Changes are not saved to the cloud — click to try again"
                className="inline-flex items-center gap-2 rounded-lg bg-danger-soft px-3 py-2 text-sm font-bold text-danger"
              >
                <span className="size-2 animate-pulse rounded-full bg-danger" /> Not saved to cloud
                — Try again
              </button>
            ) : (
              <span className="hidden items-center gap-2 rounded-lg bg-ok-soft px-3 py-2 text-sm font-bold text-ok md:inline-flex">
                <span className="size-2 rounded-full bg-ok" />{" "}
                {isPreviewIsolated()
                  ? "Local only (not syncing)"
                  : sync === "syncing"
                    ? "Saving to cloud…"
                    : sync === "synced"
                      ? "Saved to cloud"
                      : "Connecting to cloud…"}
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                exportDotAuditSummary(data);
                toast.success("DOT Audit Summary ready — CSV downloaded and print view opened");
              }}
              title="Printable table + CSV: Driver Name, CDL, DMV Status, Medical Expiry, Clearinghouse Annual, Overall Status"
              className={btn}
            >
              <ClipboardList className="size-4" /> Export DOT Audit Summary
            </button>
            {account.role === "admin" ? (
              <ComplianceDrBackupControls />
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    const json = exportBackup();
                    const blob = new Blob([json], { type: "application/json" });
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(blob);
                    a.download = `shaheen-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(a.href), 30000);
                    toast.success("Backup downloaded", { description: backupCoverageSummary(json) });
                  }}
                  title={`Download tracker backup — ${backupCoverageSummary()}`}
                  className={btn}
                >
                  <Download className="size-4" /> Backup
                </button>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  title="Restore tracker backup (plans, notes, docs, follow-ups, records; mock drug/CCF when present)"
                  className={btn}
                >
                  <Upload className="size-4" /> Restore
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    try {
                      importBackup(await f.text());
                      toast.success("Backup restored", {
                        description:
                          "Plans, notes, docs, and follow-ups restored. Secure drug/CCF stays in cloud.",
                      });
                    } catch {
                      toast.error("That file is not a valid backup");
                    }
                    e.target.value = "";
                  }}
                />
              </>
            )}
            <button
              type="button"
              onClick={() => {
                if (
                  !confirm(
                    "Clear My Compliance Today view state only?\n\nThis clears today’s checklist ticks and collapsed Future Plan panels.\nIt does NOT delete documents, saved Future Plans, notes, or cloud data.",
                  )
                ) {
                  return;
                }
                const { clearedChecklistKeys } = clearComplianceTodayViewState();
                toast.success("My Compliance Today view cleared", {
                  description:
                    clearedChecklistKeys > 0
                      ? `Removed ${clearedChecklistKeys} checklist day(s). Documents and plans unchanged.`
                      : "Expand panels reset. Documents and plans unchanged.",
                });
              }}
              title="Clear My Compliance Today view (checklist + expand) — does not delete plans or docs"
              className={btn}
            >
              <Eraser className="size-4" /> Clear Today
            </button>
            <button
              type="button"
              onClick={() => {
                if (
                  confirm(
                    "Reset ALL data back to the original spreadsheet? Your changes will be lost (download a Backup first).",
                  )
                ) {
                  resetToSpreadsheet();
                  toast.success("Data reset to the spreadsheet");
                }
              }}
              className={btn}
            >
              <RotateCcw className="size-4" /> Reset
            </button>
          </div>
        </header>
        <div
          id="main-content"
          tabIndex={-1}
          className="shell-main-pad flex min-h-0 flex-1 flex-col overflow-auto outline-none"
          data-nav-pending={navigating ? "true" : "false"}
        >
          {navigating && (
            <div
              role="status"
              aria-live="polite"
              data-testid="nav-pending"
              className="tracker-no-print mb-3 rounded-lg border border-border/70 bg-muted/40 px-4 py-3 text-sm font-semibold text-muted-foreground"
            >
              Opening {title}…
            </div>
          )}
          {!loaded ? (
            <div className="p-10 text-lg text-muted-foreground" role="status">
              Loading your data…
            </div>
          ) : (
            <div
              key={loc.pathname}
              className="ui-enter flex min-h-0 flex-1 flex-col"
              // Hide previous route body while the router is still resolving so
              // chrome never sits over stale Drug Tests (or other) content.
              hidden={navigating}
              aria-hidden={navigating || undefined}
            >
              {children}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

const btn =
  "ui-press inline-flex items-center gap-2 rounded-lg border-2 bg-card px-3 py-2 text-sm font-bold hover:border-primary hover:text-primary";

function NavItem({
  to,
  active,
  icon: Icon,
  label,
  count,
  collapsed,
}: {
  to: string;
  active: boolean;
  icon: typeof FileText;
  label: string;
  count?: number;
  collapsed: boolean;
}) {
  return (
    <Link
      to={to}
      title={label}
      aria-current={active ? "page" : undefined}
      activeOptions={{ exact: true }}
      className={cn(
        "tracker-nav flex items-center gap-3 rounded-2xl text-[15px] font-semibold",
        collapsed ? "justify-center px-2 py-2.5" : "px-4 py-2.5",
        active
          ? "tracker-nav-active text-primary-foreground"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/90 hover:text-sidebar-foreground",
      )}
    >
      <Icon className="size-5 shrink-0 opacity-95" strokeWidth={active ? 2.35 : 2} />
      {!collapsed && <span className="flex-1 truncate leading-tight tracking-tight">{label}</span>}
      {!collapsed && !!count && (
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-extrabold tabular-nums leading-none",
            active ? "bg-white/95 text-primary shadow-sm" : "bg-danger text-primary-foreground",
          )}
        >
          {count}
        </span>
      )}
    </Link>
  );
}
