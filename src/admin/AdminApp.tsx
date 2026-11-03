import { useEffect, useState, useSyncExternalStore } from "react";
import { BarChart3, CalendarClock, ChevronsLeft, ChevronsRight, FileText, ListChecks, LogOut, ScrollText, Settings, ShieldCheck, Star, Timer, UserCog, Users } from "lucide-react";
import { MyAccount } from "@/admin/components/hr/MyAccount";
import { TeamManagement } from "@/admin/components/hr/TeamManagement";
import { SystemLogs } from "@/admin/components/hr/SystemLogs";
import { Overtime } from "@/admin/components/hr/Overtime";
import { useApp } from "@/admin/lib/store";
import { supabase } from "@/admin/integrations/supabase/client";
import { getSyncStatus, saveNow, startSync, stopSync, subscribeSync } from "@/admin/lib/cloud-sync";
import { isPreviewIsolated } from "@/lib/preview-isolated";
import { BackupButtons } from "@/admin/components/hr/Settings";

function SyncBadge() {
  const s = useSyncExternalStore(subscribeSync, getSyncStatus, () => "connecting" as const);
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <BackupButtons />
      {s === "error" ? (
        <button type="button" onClick={() => void saveNow()} className="inline-flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-1.5 text-sm font-bold text-destructive">
          <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" /> Not saved to cloud — Try again
        </button>
      ) : (
        <span className="inline-flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-1.5 text-sm font-bold text-primary">
          <span className={`h-2 w-2 rounded-full bg-primary ${s !== "synced" ? "animate-pulse" : ""}`} />
          {s === "syncing" ? "Saving to cloud…" : s === "synced" ? "Saved to cloud" : "Connecting to cloud…"}
        </span>
      )}
    </div>
  );
}
import { Overview } from "@/admin/components/hr/Overview";
import { Attendance } from "@/admin/components/hr/Attendance";
import { Performance } from "@/admin/components/hr/Performance";
import { Reports } from "@/admin/components/hr/Reports";
import { Team } from "@/admin/components/hr/Team";
import { SettingsPanel } from "@/admin/components/hr/Settings";
import { TaskGate, Tasks } from "@/admin/components/hr/Tasks";
import { AboutPanel } from "@/admin/components/hr/AboutPanel";


const HR_EMAIL = "hr.compliance@gmail.com";

const TABS = [
  ["overview", "Overview", Overview, BarChart3],
  ["attendance", "Attendance", Attendance, CalendarClock],
  ["performance", "Performance", Performance, Star],
  ["overtime", "Overtime", Overtime, Timer],
  ["reports", "CEO Reports", Reports, FileText],
  ["tasks", "Tasks", Tasks, ListChecks],
  ["team", "Team", Team, Users],
  ["settings", "Settings", SettingsPanel, Settings],
] as const;

const OPS_IDS = new Set(["overview", "attendance", "performance", "overtime"]);
const REPORT_IDS = new Set(["reports", "tasks"]);
const PEOPLE_IDS = new Set(["team"]);
const CONFIG_IDS = new Set(["settings"]);

const TAB_TITLE: Record<string, string> = {
  overview: "Overview",
  attendance: "Attendance",
  performance: "Performance",
  overtime: "Overtime",
  reports: "CEO Reports",
  tasks: "Tasks",
  team: "Team",
  settings: "Settings",
  account: "My Account",
  "team-mgmt": "User Accounts",
  logs: "Activity Logs",
};

function adminCrumbs(tab: string): { label: string; current?: boolean }[] {
  const title = TAB_TITLE[tab] ?? "Overview";
  let group = "Operations";
  if (REPORT_IDS.has(tab)) group = "Reports & work";
  else if (PEOPLE_IDS.has(tab)) group = "People";
  else if (CONFIG_IDS.has(tab)) group = "Configuration";
  else if (tab === "account") group = "My Account";
  else if (tab === "team-mgmt") group = "Team Management";
  else if (tab === "logs") group = "System";
  else if (!OPS_IDS.has(tab)) group = "Admin & Attendance";
  return [
    { label: "Admin & Attendance" },
    { label: group },
    { label: title, current: true },
  ];
}

function Login({ onLocalAuth }: { onLocalAuth: (email: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState(HR_EMAIL);
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
     <div className="grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[1.2fr_1fr]">
      <div className="order-2 lg:order-1"><AboutPanel /></div>
      <form
        className="panel ui-glow order-1 mx-auto w-full max-w-sm space-y-4 lg:order-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErr("");
          const mail = email.trim().toLowerCase();
          try {
            const {
              hasHrLocalPassword,
              verifyHrLocalPassword,
              writeHrLocalSession,
              clearHrLocalSession,
            } = await import("@/admin/lib/hr-auth-local");
            const hasLocal = hasHrLocalPassword(mail);
            const localOk = hasLocal && (await verifyHrLocalPassword(mail, pass));

            const { error } = await supabase.auth.signInWithPassword({ email: mail, password: pass });
            if (!error) {
              // A prior My Account change may have saved a newer password locally while
              // cloud still had the old one. Do not let the stale cloud password win.
              if (hasLocal && !localOk) {
                await supabase.auth.signOut();
                setBusy(false);
                setErr("Wrong email or password");
                return;
              }
              clearHrLocalSession();
              setBusy(false);
              return;
            }
            if (localOk) {
              writeHrLocalSession(mail);
              onLocalAuth(mail);
              setBusy(false);
              return;
            }
          } catch {
            /* fall through */
          }
          setBusy(false);
          setErr("Wrong email or password");
        }}
      >
        <div className="text-center">
          <img src="/logo.jpg" alt="Shaheen Transport LLC" className="mx-auto mb-2 h-24 w-auto" />
          <h1 className="text-2xl font-bold">HR Attendance</h1>
          <p className="text-sm text-muted-foreground">Sign in to continue</p>
        </div>
        <label className="block"><span className="lbl">Email</span><input className="field" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" /></label>
        <label className="block"><span className="lbl">Password</span><input type="password" className="field" value={pass} onChange={(e) => setPass(e.target.value)} autoFocus autoComplete="current-password" /></label>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
     </div>
    </div>
  );
}

export function AdminApp() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthedState] = useState(false);
  const [email, setEmail] = useState("");
  const [localOnly, setLocalOnly] = useState(false);
  const setAuthed = (v: boolean) => {
    if (!v) {
      if (isPreviewIsolated()) {
        // Stay signed into mock preview account — never call Auth.
        setLocalOnly(true);
        setEmail(HR_EMAIL);
        setAuthedState(true);
        return;
      }
      void import("@/admin/lib/hr-auth-local").then((m) => m.clearHrLocalSession()).catch(() => undefined);
      setLocalOnly(false);
      setAuthedState(false);
      setEmail("");
      void supabase.auth.signOut();
    }
  };
  const [tab, setTab] = useState<TabId>("overview");
  const [small, setSmall] = useState(false);
  useEffect(() => {
    if (isPreviewIsolated()) {
      stopSync();
      setLocalOnly(true);
      setEmail(HR_EMAIL);
      setAuthedState(true);
      setReady(true);
      return;
    }
    const apply = async (uid: string | null, mail: string) => {
      if (uid) {
        await startSync(uid);
        setLocalOnly(false);
        setEmail(mail);
        setAuthedState(true);
      } else {
        stopSync();
        try {
          const { readHrLocalSessionEmail } = await import("@/admin/lib/hr-auth-local");
          const localMail = readHrLocalSessionEmail();
          if (localMail) {
            setLocalOnly(true);
            setEmail(localMail);
            setAuthedState(true);
          } else {
            setLocalOnly(false);
            setEmail("");
            setAuthedState(false);
          }
        } catch {
          setLocalOnly(false);
          setEmail("");
          setAuthedState(false);
        }
      }
      setReady(true);
    };
    void supabase.auth.getSession().then(({ data }) => apply(data.session?.user.id ?? null, data.session?.user.email ?? ""));
    const { data: sub } = supabase.auth.onAuthStateChange((ev, session) => {
      if (ev === "SIGNED_IN" || ev === "SIGNED_OUT") void apply(session?.user.id ?? null, session?.user.email ?? "");
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  // Admin = the HR owner account (email verified by the sign-in server).
  const isAdmin = email.toLowerCase() === HR_EMAIL;
  useActivityLog(authed ? email : "");
  if (!ready) return null;
  if (!authed) {
    return (
      <Login
        onLocalAuth={(mail) => {
          setLocalOnly(true);
          setEmail(mail);
          setAuthedState(true);
        }}
      />
    );
  }
  const opsTabs = isAdmin ? TABS : TABS.filter((t) => t[0] === "overview");
  const current: TabId = !isAdmin && (tab === "team-mgmt" || tab === "logs" || (tab !== "account" && tab !== "overview")) ? "overview" : tab;
  const Active = TABS.find((t) => t[0] === current)?.[2];
  const crumbs = adminCrumbs(current);
  const navBtn = (id: TabId, label: string, Icon: typeof Users) => (
    <button
      key={id}
      type="button"
      title={label}
      aria-current={current === id ? "page" : undefined}
      onClick={() => setTab(id)}
      className={`admin-nav btn h-10 justify-start gap-3 px-3 ${current === id ? "admin-nav-active text-primary-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent"}`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!small && <span className="hidden truncate md:inline">{label}</span>}
    </button>
  );
  const groupLbl = (t: string) => !small && <p className="shell-nav-group hidden md:block">{t}</p>;
  const renderTabGroup = (ids: Set<string>) =>
    opsTabs.filter(([id]) => ids.has(id)).map(([id, label, , Icon]) => navBtn(id, label, Icon));
  return (
    <div className="admin-shell flex min-h-screen">
      {!isPreviewIsolated() && <TaskGate />}
      {isPreviewIsolated() && (
        <div
          role="status"
          className="tracker-no-print fixed top-[44px] right-0 left-0 z-[60] border-b border-warn/40 bg-warn-soft px-3 py-1.5 text-center text-xs font-bold text-warn md:left-0"
        >
          Isolated preview — Admin mock session + local seed only. Cloud sync disabled; Supabase URL is non-routable.
        </div>
      )}
      <aside className={`admin-aside sticky top-0 flex h-screen shrink-0 flex-col overflow-y-auto overflow-x-visible border-r border-sidebar-border bg-sidebar p-2 text-sidebar-foreground transition-all ${small ? "w-16" : "w-16 md:w-60"}`}>
        <div className="mb-3 flex items-center gap-2 px-1 py-2">
          <img src="/logo.jpg" alt="Shaheen Transport LLC" className="h-10 w-10 shrink-0 rounded-lg object-contain" />
          {!small && <span className="hidden font-display text-sm font-bold leading-tight md:block"><span className="text-primary">SHAHEEN</span><br />HR Dashboard</span>}
        </div>
        <nav className="flex flex-1 flex-col gap-0.5" aria-label="Admin & Attendance">
          {groupLbl("Operations")}
          {renderTabGroup(OPS_IDS)}
          {isAdmin && groupLbl("Reports & work")}
          {isAdmin && renderTabGroup(REPORT_IDS)}
          {isAdmin && groupLbl("People")}
          {isAdmin && renderTabGroup(PEOPLE_IDS)}
          {isAdmin && groupLbl("Configuration")}
          {isAdmin && renderTabGroup(CONFIG_IDS)}
          {groupLbl("My Account")}
          {navBtn("account", "My Account", UserCog)}
          {isAdmin && groupLbl("Team Management")}
          {isAdmin && navBtn("team-mgmt", "User Accounts", ShieldCheck)}
          {isAdmin && groupLbl("System")}
          {isAdmin && navBtn("logs", "Activity Logs", ScrollText)}
        </nav>
        <button type="button" className="btn mt-3 h-10 justify-start px-3 text-sidebar-foreground hover:bg-sidebar-accent" title="Sign out" onClick={() => setAuthed(false)}>
          <LogOut className="h-4 w-4 shrink-0" />
          {!small && <span className="hidden md:inline">Sign out</span>}
        </button>
        <button type="button" className="btn mt-1 hidden h-10 justify-start px-3 text-sidebar-foreground hover:bg-sidebar-accent md:inline-flex" title={small ? "Expand" : "Collapse"} onClick={() => setSmall(!small)}>
          {small ? <ChevronsRight className="h-4 w-4" /> : <><ChevronsLeft className="h-4 w-4" /> Collapse</>}
        </button>
      </aside>
      <main className={`ui-enter admin-main shell-main-pad min-w-0 flex-1 overflow-x-visible md:px-6 md:pt-5 ${isPreviewIsolated() ? "pt-10" : ""}`}>
        <header className="shell-page-header tracker-no-print border-b border-border/70 pb-2.5">
          <nav aria-label="Breadcrumb" className="shell-crumb">
            {crumbs.map((c, i) => (
              <span key={`${c.label}-${i}`} className="inline-flex items-center gap-1.5">
                {i > 0 && <span className="shell-crumb-sep" aria-hidden>/</span>}
                <span className={c.current ? "shell-crumb-current" : undefined} aria-current={c.current ? "page" : undefined}>
                  {c.label}
                </span>
              </span>
            ))}
          </nav>
        </header>
        {isPreviewIsolated() || localOnly ? (
          <div className="mb-3 rounded-lg bg-muted px-3 py-1.5 text-sm font-semibold text-muted-foreground">
            {isPreviewIsolated()
              ? "Isolated preview — local seed/Zustand only; Save stays on this browser."
              : "Local session — cloud sync paused until you sign in with Supabase."}
          </div>
        ) : (
          <SyncBadge />
        )}
        <div className="admin-page">
          {current === "account" ? <MyAccount email={email} isAdmin={isAdmin} />
            : current === "team-mgmt" ? <TeamManagement adminEmail={HR_EMAIL} />
            : current === "logs" ? <SystemLogs />
            : Active ? <Active /> : null}
        </div>
      </main>
    </div>
  );
}

type TabId = (typeof TABS)[number][0] | "account" | "team-mgmt" | "logs";

const LOG_LABEL: Record<string, string> = {
  depts: "Updated departments", employees: "Updated team members", records: "Updated attendance",
  perf: "Updated performance", tasks: "Updated tasks", settings: "Updated settings", team: "Updated user accounts / roles",
};

/** Adds an activity-log entry whenever existing dashboard data changes. Read-only towards that data. */
function useActivityLog(who: string) {
  useEffect(() => {
    if (!who) return;
    useApp.getState().addLog(who, "Signed in");
    let prev = useApp.getState();
    return useApp.subscribe((s) => {
      const p = prev;
      prev = s;
      for (const k of Object.keys(LOG_LABEL) as (keyof typeof s)[]) {
        if (s[k] !== p[k]) s.addLog(who, LOG_LABEL[k as string]!);
      }
    });
  }, [who]);
}
