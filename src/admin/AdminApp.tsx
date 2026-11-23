import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  Banknote,
  BarChart3,
  CalendarClock,
  CalendarDays,
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
  FileText,
  FolderKanban,
  History,
  ListChecks,
  LogOut,
  ScrollText,
  Settings,
  ShieldCheck,
  Star,
  Timer,
  UserCog,
  Users,
  Wallet,
  Scale,
} from "lucide-react";
import { AdminIslandBoundary } from "@/admin/components/AdminIslandBoundary";
import { MyAccount } from "@/admin/components/hr/MyAccount";
import { TeamManagement } from "@/admin/components/hr/TeamManagement";
import { SystemLogs } from "@/admin/components/hr/SystemLogs";
import { Overtime } from "@/admin/components/hr/Overtime";
import { EmployeeDirectory } from "@/admin/components/hr/EmployeeDirectory";
import { LeaveManagement } from "@/admin/components/hr/LeaveManagement";
import { MyHrToday } from "@/admin/components/hr/MyHrToday";
import { SalaryPayments } from "@/admin/components/hr/SalaryPayments";
import { ExpensesManagement } from "@/admin/components/hr/ExpensesManagement";
import { PayrollVerify } from "@/admin/components/hr/PayrollVerify";
import { AuditHistory } from "@/admin/components/hr/AuditHistory";
import { useApp } from "@/admin/lib/store";
import { supabase } from "@/admin/integrations/supabase/client";
import {
  getConflictCloud,
  getSyncStatus,
  hasOpenHrConflict,
  hrSyncStatusLabel,
  resolveHrConflict,
  saveNow,
  startLocalOnlyGuard,
  startSync,
  stopLocalOnlyGuard,
  stopSync,
  subscribeSync,
} from "@/admin/lib/cloud-sync";
import {
  hrAttendanceEntryCount,
  isHrPayloadEmpty,
  isHrMeaningful,
  shouldAutoPreferCloud,
} from "@/admin/lib/hr-sync-protect";
import { attemptHrLogin } from "@/admin/lib/hr-login";
import { isPreviewIsolated } from "@/lib/preview-isolated";
import { BackupButtons, downloadBackup } from "@/admin/components/hr/Settings";

/**
 * Explicit conflict chooser — Prefer cloud when this browser looks empty (Entered 0).
 * Selectors must return stable primitives/refs (never a fresh object) or Zustand + React
 * hit #185 Maximum update depth and the Admin route ErrorBoundary ("didn't load").
 */
function ConflictChooser() {
  const employees = useApp((s) => s.employees);
  const records = useApp((s) => s.records);
  const cloud = getConflictCloud();
  const preferCloud = shouldAutoPreferCloud({ employees, records }, cloud);

  // Soft-refresh recovery: empty local + filled cloud → Prefer cloud without a click.
  useEffect(() => {
    if (!preferCloud || !cloud) return;
    void resolveHrConflict("use_cloud");
  }, [preferCloud, cloud]);

  return (
    <div
      className="space-y-2 rounded-lg border border-warn/40 bg-warn-soft px-3 py-2 text-sm"
      role="alertdialog"
    >
      <p className="font-semibold text-warn">
        Not Synced — this browser and the cloud both have attendance changes. Nothing is
        overwritten until you choose.
      </p>
      {preferCloud ? (
        <p className="text-warn">
          This browser looks empty (no attendance punches / Entered 0) while cloud has real
          records. Restoring from cloud automatically…
        </p>
      ) : (
        <ol className="list-decimal space-y-1 pl-5 text-warn">
          <li>
            Always click <strong>Download backup</strong> first.
          </li>
          <li>
            If this browser looks empty but cloud had your real records, choose{" "}
            <strong>Use cloud</strong>.
          </li>
          <li>
            Only choose <strong>Keep this browser</strong> if you are sure the browser copy is
            correct.
          </li>
        </ol>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn" onClick={() => downloadBackup()}>
          Download backup
        </button>
        <button
          type="button"
          className="btn-danger"
          onClick={() => void resolveHrConflict("use_cloud")}
        >
          {preferCloud ? "Use cloud (recommended)" : "Use cloud (replace this browser)"}
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            const blob = { employees, records };
            if (
              isHrPayloadEmpty(blob) ||
              !isHrMeaningful(blob) ||
              hrAttendanceEntryCount(blob) === 0
            ) {
              const ok = window.confirm(
                "This browser looks empty or incomplete (no attendance punches). Uploading it can replace cloud attendance with empty data.\n\nOnly continue if you are sure. Prefer Use cloud instead.",
              );
              if (!ok) return;
            }
            void resolveHrConflict("keep_local");
          }}
        >
          Keep this browser (upload)
        </button>
      </div>
    </div>
  );
}

function SyncBadge() {
  const s = useSyncExternalStore(subscribeSync, getSyncStatus, () => "connecting" as const);
  const conflict = s === "conflict" || hasOpenHrConflict();
  const label = hrSyncStatusLabel(s);
  const tone =
    s === "error" || conflict
      ? "destructive"
      : s === "unsynced"
        ? "warn"
        : s === "connecting"
          ? "muted"
          : "primary";
  return (
    <div className="mb-3 space-y-2" data-testid="admin-sync-badge">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <BackupButtons />
        {s === "error" ? (
          <button
            type="button"
            onClick={() => void saveNow()}
            className="inline-flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-1.5 text-sm font-bold text-destructive"
          >
            <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" /> {label} — Try
            again
          </button>
        ) : (
          <span
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-bold ${
              tone === "destructive"
                ? "bg-destructive/10 text-destructive"
                : tone === "warn"
                  ? "bg-warn-soft text-warn"
                  : tone === "muted"
                    ? "bg-muted text-muted-foreground"
                    : "bg-primary/10 text-primary"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full bg-current ${s !== "synced" ? "animate-pulse" : ""}`}
            />
            {label}
          </span>
        )}
      </div>
      {conflict && (
        <AdminIslandBoundary label="sync conflict">
          <ConflictChooser />
        </AdminIslandBoundary>
      )}
    </div>
  );
}

/** Upgrade a local-only session to Supabase Auth without wiping pending local attendance. */
function CloudReconnectBanner({
  email,
  onConnected,
}: {
  email: string;
  onConnected: (mail: string, uid: string) => void;
}) {
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const busyRef = useRef(false);
  const reconnectPassRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // One-click path: focus password so Enter / Sign In completes cloud reconnect.
    reconnectPassRef.current?.focus();
  }, []);

  return (
    <div
      className="mb-3 space-y-2 rounded-lg border border-warn/40 bg-warn-soft px-3 py-2 text-sm"
      role="status"
      data-testid="admin-cloud-reconnect"
    >
      <p className="font-semibold text-warn">
        Sign In Required — this browser is on a local session (cloud sync paused). Sign in once with
        the same Admin password to enable Cloud Saved. Soft refresh will keep the cloud session
        after that. Empty local attendance prefers cloud automatically (nothing overwritten
        silently when both sides have real edits).
      </p>
      <form
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busyRef.current) return;
          busyRef.current = true;
          setBusy(true);
          setErr("");
          setMsg("");
          try {
            const {
              hasHrLocalPassword,
              verifyHrLocalPassword,
              writeHrLocalSession,
              clearHrLocalSession,
            } = await import("@/admin/lib/hr-auth-local");

            const nextPass = (pass || reconnectPassRef.current?.value || "").trim();
            const result = await attemptHrLogin(email, nextPass, {
              signInWithPassword: async (creds) => {
                const { error } = await supabase.auth.signInWithPassword(creds);
                return {
                  error: error
                    ? {
                        message: error.message,
                        status: error.status,
                        name: error.name,
                        code: typeof error.code === "string" ? error.code : undefined,
                      }
                    : null,
                };
              },
              signOut: () => supabase.auth.signOut(),
              hasHrLocalPassword,
              verifyHrLocalPassword,
              writeHrLocalSession,
              clearHrLocalSession,
            });

            if (!result.ok) {
              setErr(
                result.kind === "stale" ? "" : result.message || "Could not connect to cloud.",
              );
              return;
            }
            if (result.mode !== "cloud") {
              setErr(
                "Cloud sign-in failed — check network and password. Local data is still on this browser.",
              );
              return;
            }
            const { data } = await supabase.auth.getSession();
            const uid = data.session?.user.id;
            if (!uid) {
              setErr("Couldn't reach the server. Try again.");
              return;
            }
            setMsg("Signed in — syncing from cloud when this browser looks empty…");
            {
              const sessMail = data.session?.user.email;
              const mail =
                sessMail == null
                  ? ""
                  : (typeof sessMail === "string" ? sessMail : String(sessMail)).trim().toLowerCase();
              onConnected(mail || email, uid);
            }
          } catch {
            setErr("Couldn't reach the server. Try again.");
          } finally {
            busyRef.current = false;
            setBusy(false);
          }
        }}
      >
        <label className="block min-w-0 flex-1">
          <span className="lbl">Password for {email}</span>
          <input
            ref={reconnectPassRef}
            data-testid="admin-cloud-reconnect-password"
            type="password"
            className="field"
            value={pass}
            onChange={(e) => {
              setPass(e.target.value);
              if (err) setErr("");
            }}
            onInput={(e) => {
              setPass((e.target as HTMLInputElement).value);
              if (err) setErr("");
            }}
            autoComplete="current-password"
            required
          />
        </label>
        <button
          type="submit"
          className="btn-primary shrink-0"
          disabled={busy}
          aria-busy={busy}
          data-testid="admin-cloud-reconnect-submit"
        >
          {busy ? "Signing in…" : "Sign In"}
        </button>
      </form>
      {err && (
        <p role="alert" className="text-destructive">
          {err}
        </p>
      )}
      {msg && <p className="text-muted-foreground">{msg}</p>}
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
import { ForgotPasswordLink } from "@/components/portal-login/ForgotPasswordLink";
import { PasswordField } from "@/components/portal-login/PasswordField";
import { PortalLoginCard, PortalLoginShell } from "@/components/portal-login/PortalLoginShell";
import { useAdminNav } from "@/admin/lib/admin-nav";
import { useDensity } from "@/lib/density";

import { HR_OWNER_EMAIL, isAdminHrAdmin } from "@/admin/lib/hr-access";

const HR_EMAIL = HR_OWNER_EMAIL;

const TABS = [
  ["hr-today", "My HR Today", MyHrToday, ClipboardList],
  ["overview", "Overview", Overview, BarChart3],
  ["attendance", "Attendance", Attendance, CalendarClock],
  ["leave", "Leave", LeaveManagement, CalendarDays],
  ["performance", "Performance", Performance, Star],
  ["overtime", "Overtime", Overtime, Timer],
  ["reports", "CEO Reports", Reports, FileText],
  ["audit-history", "Audit History", AuditHistory, History],
  ["tasks", "Tasks", Tasks, ListChecks],
  ["team", "Team", Team, Users],
  ["directory", "Directory", EmployeeDirectory, FolderKanban],
  ["salary-pay", "Salary pay", SalaryPayments, Banknote],
  ["payroll-verify", "Payroll verify", PayrollVerify, Scale],
  ["expenses", "Expenses", ExpensesManagement, Wallet],
  ["settings", "Settings", SettingsPanel, Settings],
] as const;

const OPS_IDS = new Set(["hr-today", "overview", "attendance", "leave", "performance", "overtime"]);
const REPORT_IDS = new Set(["reports", "audit-history", "tasks"]);
const PEOPLE_IDS = new Set(["team", "directory"]);
const FINANCE_IDS = new Set(["salary-pay", "payroll-verify", "expenses"]);
const CONFIG_IDS = new Set(["settings"]);

const TAB_TITLE: Record<string, string> = {
  "hr-today": "My HR Today",
  overview: "Overview",
  attendance: "Attendance",
  leave: "Leave Management",
  performance: "Performance & Follow-Ups",
  overtime: "Overtime & Approval",
  reports: "CEO Reports",
  "audit-history": "HR Audit History",
  tasks: "Tasks",
  team: "Team",
  directory: "Employee Directory",
  "salary-pay": "Salary payments",
  "payroll-verify": "Payroll verification",
  expenses: "Expenses Management",
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
  else if (FINANCE_IDS.has(tab)) group = "Finance";
  else if (CONFIG_IDS.has(tab)) group = "Configuration";
  else if (tab === "account") group = "My Account";
  else if (tab === "team-mgmt") group = "Team Management";
  else if (tab === "logs") group = "System";
  else if (!OPS_IDS.has(tab)) group = "Admin & Attendance";
  return [{ label: "Admin & Attendance" }, { label: group }, { label: title, current: true }];
}

function Login({
  onLocalAuth,
  onCloudAuth,
}: {
  onLocalAuth: (email: string) => void;
  onCloudAuth: (email: string, uid: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState(HR_EMAIL);
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  // Synchronous guards: React `busy` alone allows a second submit before re-render.
  const busyRef = useRef(false);
  const attemptRef = useRef(0);
  const emailRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);

  const clearErrOnEdit = () => {
    if (err) setErr("");
  };

  return (
    <PortalLoginShell
      about={<AboutPanel compact />}
      footerRole="Yousaf · HR Operations & Administration"
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (busyRef.current) return;
          busyRef.current = true;
          const attempt = ++attemptRef.current;
          const isStale = () => attempt !== attemptRef.current;
          setBusy(true);
          setErr("");

          // Prefer live DOM values so browser autofill that skipped onChange still signs in.
          const form = e.currentTarget;
          const fd = new FormData(form);
          const mailRaw = String(fd.get("email") ?? emailRef.current?.value ?? email);
          const passRaw = String(fd.get("password") ?? passRef.current?.value ?? pass);
          if (mailRaw !== email) setEmail(mailRaw);
          if (passRaw !== pass) setPass(passRaw);

          try {
            const {
              hasHrLocalPassword,
              verifyHrLocalPassword,
              writeHrLocalSession,
              clearHrLocalSession,
            } = await import("@/admin/lib/hr-auth-local");

            const result = await attemptHrLogin(mailRaw, passRaw, {
              signInWithPassword: async (creds) => {
                const { error } = await supabase.auth.signInWithPassword(creds);
                return {
                  error: error
                    ? {
                        message: error.message,
                        status: error.status,
                        name: error.name,
                        code: typeof error.code === "string" ? error.code : undefined,
                      }
                    : null,
                };
              },
              signOut: () => supabase.auth.signOut(),
              hasHrLocalPassword,
              verifyHrLocalPassword,
              writeHrLocalSession,
              clearHrLocalSession,
              isStale,
            });

            if (isStale()) return;

            if (result.ok) {
              setErr("");
              const normalized = mailRaw.trim().toLowerCase();
              if (result.mode === "local") {
                onLocalAuth(normalized);
                // Keep busy until parent swaps to the dashboard (local path).
                return;
              }
              // Open dashboard from the session now — do not wait solely on onAuthStateChange
              // (that race left the form briefly interactive and sometimes showed a stale error).
              const { data } = await supabase.auth.getSession();
              if (isStale()) return;
              const uid = data.session?.user.id;
              if (uid) {
                {
                  const sessMail = data.session?.user.email;
                  const mail =
                    sessMail == null
                      ? ""
                      : (typeof sessMail === "string" ? sessMail : String(sessMail))
                          .trim()
                          .toLowerCase();
                  onCloudAuth(mail || normalized, uid);
                }
                return;
              }
              // Session should exist after a successful cloud sign-in; treat as network-ish failure.
              setErr("Couldn't reach the server. Try again.");
              busyRef.current = false;
              setBusy(false);
              return;
            }

            if (result.kind === "stale") return;
            setErr(result.message);
            busyRef.current = false;
            setBusy(false);
          } catch {
            if (isStale()) return;
            setErr("Couldn't reach the server. Try again.");
            busyRef.current = false;
            setBusy(false);
          }
        }}
      >
        <PortalLoginCard
          logoSrc="/logo.jpg"
          title="Admin & Attendance"
          subtitle="Sign in to continue"
        >
          {err && (
            <p role="alert" className="mt-4 rounded-lg bg-danger-soft p-3 text-sm font-semibold text-danger">
              {err}
            </p>
          )}
          <label className="mt-5 block text-sm font-bold text-foreground" htmlFor="admin-email">
            Email
          </label>
          <input
            id="admin-email"
            ref={emailRef}
            name="email"
            type="email"
            className="mt-1 h-11 w-full rounded-xl border bg-card px-3 text-foreground"
            data-testid="admin-email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              clearErrOnEdit();
            }}
            onInput={(e) => {
              setEmail((e.target as HTMLInputElement).value);
              clearErrOnEdit();
            }}
            autoComplete="username"
          />
          <PasswordField
            id="admin-password"
            testId="admin-password"
            value={pass}
            onChange={(v) => {
              setPass(v);
              clearErrOnEdit();
            }}
            inputRef={passRef}
            autoFocus
            className="mt-1 h-11 w-full rounded-xl border bg-card px-3 pr-11 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <div className="mt-1 flex justify-end">
            <ForgotPasswordLink
              email={email}
              resetPasswordForEmail={async (mail) => {
                const redirectTo = `${window.location.origin}/admin`;
                const { error } = await supabase.auth.resetPasswordForEmail(mail, { redirectTo });
                return { error: error ? { message: error.message } : null };
              }}
            />
          </div>
          <button
            type="submit"
            className="ui-press mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand text-lg font-bold text-primary-foreground shadow-pop disabled:opacity-60"
            data-testid="admin-sign-in"
            disabled={busy}
            aria-busy={busy}
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Use the email and password from your administrator. Your attendance data stays on this
            browser and in Admin cloud when signed in.
          </p>
        </PortalLoginCard>
      </form>
    </PortalLoginShell>
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
      stopSync();
      stopLocalOnlyGuard();
      void import("@/admin/lib/hr-auth-local")
        .then((m) => m.clearHrLocalSession())
        .catch(() => undefined);
      setLocalOnly(false);
      setAuthedState(false);
      setEmail("");
      void supabase.auth.signOut();
    }
  };
  const [tab, setTab] = useState<TabId>("hr-today");
  const [small, setSmall] = useState(false);
  // Rehydrate density dataset; honor Overview → Attendance chip requests (UI only).
  useDensity();
  const tabRequest = useAdminNav((s) => s.tabRequest);
  const clearTabRequest = useAdminNav((s) => s.clearTabRequest);
  useEffect(() => {
    if (!tabRequest) return;
    setTab(tabRequest as TabId);
    clearTabRequest();
  }, [tabRequest, clearTabRequest]);
  useEffect(() => {
    if (isPreviewIsolated()) {
      stopSync();
      stopLocalOnlyGuard();
      setLocalOnly(true);
      setEmail(HR_EMAIL);
      setAuthedState(true);
      setReady(true);
      return;
    }
    let cancelled = false;
    /** Avoid re-running startSync on every TOKEN_REFRESHED / duplicate INITIAL_SESSION. */
    let cloudUid: string | null = null;
    /** Monotonic apply generation — late local-only resolves must not clobber a newer cloud apply. */
    let applyGen = 0;
    const apply = async (uid: string | null, mail: string) => {
      if (cancelled) return;
      const gen = ++applyGen;
      if (uid) {
        if (cloudUid !== uid) {
          cloudUid = uid;
          await startSync(uid);
          if (cancelled || gen !== applyGen) return;
        }
        if (gen !== applyGen) return;
        setLocalOnly(false);
        setEmail(mail);
        setAuthedState(true);
      } else {
        // Only clear cloud if this generation is still current (no newer SIGNED_IN won the race).
        cloudUid = null;
        stopSync();
        try {
          const { readHrLocalSessionEmail } = await import("@/admin/lib/hr-auth-local");
          if (cancelled || gen !== applyGen || cloudUid) return;
          const localMail = readHrLocalSessionEmail();
          if (cancelled || gen !== applyGen || cloudUid) return;
          if (localMail) {
            setLocalOnly(true);
            setEmail(localMail);
            setAuthedState(true);
            void startLocalOnlyGuard();
          } else {
            stopLocalOnlyGuard();
            setLocalOnly(false);
            setEmail("");
            setAuthedState(false);
          }
        } catch {
          if (cancelled || gen !== applyGen || cloudUid) return;
          stopLocalOnlyGuard();
          setLocalOnly(false);
          setEmail("");
          setAuthedState(false);
        }
      }
      if (!cancelled && gen === applyGen) setReady(true);
    };
    // Soft refresh: restore Supabase session first. Also listen for INITIAL_SESSION /
    // TOKEN_REFRESHED — ignoring those left a local-only badge when getSession raced.
    void supabase.auth.getSession().then(async ({ data }) => {
      let session = data.session;
      if (!session) {
        // One recovery tick: storage/refresh can lag the first getSession on soft refresh.
        const { data: again } = await supabase.auth.getSession();
        session = again.session;
      }
      if (!session) {
        try {
          const { data: userData } = await supabase.auth.getUser();
          if (userData.user) {
            const { data: after } = await supabase.auth.getSession();
            session = after.session;
          }
        } catch {
          /* stay signed out / local-only */
        }
      }
      if (cancelled) return;
      await apply(session?.user.id ?? null, session?.user.email ?? "");
    });
    const { data: sub } = supabase.auth.onAuthStateChange((ev, session) => {
      if (
        ev === "SIGNED_IN" ||
        ev === "SIGNED_OUT" ||
        ev === "INITIAL_SESSION" ||
        ev === "TOKEN_REFRESHED" ||
        ev === "USER_UPDATED"
      ) {
        void apply(session?.user.id ?? null, session?.user.email ?? "");
      }
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
      stopLocalOnlyGuard();
    };
  }, []);
  // Admin-HR role: owner email or active TeamMember.role (directory is soft until hr_portal_accounts SQL).
  const team = useApp((s) => s.team);
  const isAdmin = isAdminHrAdmin(email, team);
  useActivityLog(authed ? email : "");
  if (!ready) return null;
  if (!authed) {
    return (
      <Login
        onLocalAuth={(mail) => {
          setLocalOnly(true);
          setEmail(mail);
          setAuthedState(true);
          void startLocalOnlyGuard();
        }}
        onCloudAuth={(mail, uid) => {
          void startSync(uid).then(() => {
            setLocalOnly(false);
            setEmail(mail);
            setAuthedState(true);
            // Soft refresh keeps Cloud Saved via persisted Supabase session.
          });
        }}
      />
    );
  }
  const opsTabs = isAdmin ? TABS : TABS.filter((t) => t[0] === "hr-today" || t[0] === "overview");
  const current: TabId =
    !isAdmin &&
    (tab === "team-mgmt" ||
      tab === "logs" ||
      (tab !== "account" && tab !== "overview" && tab !== "hr-today"))
      ? "hr-today"
      : tab;
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
      <a href="#admin-main-content" className="shell-skip tracker-no-print">
        Skip to main content
      </a>
      {!isPreviewIsolated() && <TaskGate />}
      {isPreviewIsolated() && (
        <div
          role="status"
          className="tracker-no-print fixed top-[44px] right-0 left-0 z-[60] border-b border-warn/40 bg-warn-soft px-3 py-1.5 text-center text-xs font-bold text-warn md:left-0"
        >
          Isolated preview — Admin mock session + local seed only. Cloud sync disabled; Supabase URL
          is non-routable.
        </div>
      )}
      <aside
        className={`admin-aside sticky top-0 flex h-screen shrink-0 flex-col overflow-y-auto overflow-x-visible border-r border-sidebar-border bg-sidebar p-2 text-sidebar-foreground transition-all ${small ? "w-16" : "w-16 md:w-60"}`}
        aria-label="Admin & Attendance sidebar"
      >
        <div className="mb-3 flex items-center gap-2 px-1 py-2">
          <img
            src="/logo.jpg"
            alt="Shaheen Transport LLC"
            className="h-10 w-10 shrink-0 rounded-lg object-contain"
          />
          {!small && (
            <span className="hidden font-display text-sm font-bold leading-tight md:block">
              <span className="text-primary">SHAHEEN</span>
              <br />
              HR Dashboard
            </span>
          )}
        </div>
        <nav className="flex flex-1 flex-col gap-0.5" aria-label="Admin & Attendance">
          {groupLbl("Operations")}
          {renderTabGroup(OPS_IDS)}
          {isAdmin && groupLbl("Reports & work")}
          {isAdmin && renderTabGroup(REPORT_IDS)}
          {isAdmin && groupLbl("People")}
          {isAdmin && renderTabGroup(PEOPLE_IDS)}
          {isAdmin && groupLbl("Finance")}
          {isAdmin && renderTabGroup(FINANCE_IDS)}
          {isAdmin && groupLbl("Configuration")}
          {isAdmin && renderTabGroup(CONFIG_IDS)}
          {groupLbl("My Account")}
          {navBtn("account", "My Account", UserCog)}
          {isAdmin && groupLbl("Team Management")}
          {isAdmin && navBtn("team-mgmt", "User Accounts", ShieldCheck)}
          {isAdmin && groupLbl("System")}
          {isAdmin && navBtn("logs", "Activity Logs", ScrollText)}
        </nav>
        <button
          type="button"
          className="btn mt-3 h-10 justify-start px-3 text-sidebar-foreground hover:bg-sidebar-accent"
          title="Sign out"
          onClick={() => setAuthed(false)}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!small && <span className="hidden md:inline">Sign out</span>}
        </button>
        <button
          type="button"
          className="btn mt-1 hidden h-10 justify-start px-3 text-sidebar-foreground hover:bg-sidebar-accent md:inline-flex"
          title={small ? "Expand" : "Collapse"}
          onClick={() => setSmall(!small)}
        >
          {small ? (
            <ChevronsRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronsLeft className="h-4 w-4" /> Collapse
            </>
          )}
        </button>
      </aside>
      <main
        id="admin-main-content"
        tabIndex={-1}
        className={`ui-enter admin-main shell-main-pad min-w-0 flex-1 overflow-x-visible outline-none md:px-6 md:pt-5 ${isPreviewIsolated() ? "pt-10" : ""}`}
      >
        <header
          className="shell-page-header tracker-no-print border-b border-border/70 pb-2.5"
          role="banner"
        >
          <nav aria-label="Breadcrumb" className="shell-crumb">
            {crumbs.map((c, i) => (
              <span key={`${c.label}-${i}`} className="inline-flex items-center gap-1.5">
                {i > 0 && (
                  <span className="shell-crumb-sep" aria-hidden>
                    /
                  </span>
                )}
                <span
                  className={c.current ? "shell-crumb-current" : undefined}
                  aria-current={c.current ? "page" : undefined}
                >
                  {c.label}
                </span>
              </span>
            ))}
          </nav>
        </header>
        {isPreviewIsolated() ? (
          <div
            className="mb-3 rounded-lg bg-muted px-3 py-1.5 text-sm font-semibold text-muted-foreground"
            role="status"
          >
            Isolated preview — local seed/Zustand only; Save stays on this browser.
          </div>
        ) : localOnly ? (
          <CloudReconnectBanner
            email={email}
            onConnected={(mail, uid) => {
              void startSync(uid).then(() => {
                setLocalOnly(false);
                setEmail(mail);
                setAuthedState(true);
              });
            }}
          />
        ) : (
          <SyncBadge />
        )}
        <div className="admin-page">
          {current === "account" ? (
            <MyAccount email={email} isAdmin={isAdmin} />
          ) : current === "team-mgmt" ? (
            <TeamManagement adminEmail={HR_EMAIL} />
          ) : current === "logs" ? (
            <SystemLogs />
          ) : current === "hr-today" ? (
            <MyHrToday localOnly={localOnly} />
          ) : Active ? (
            <Active />
          ) : null}
        </div>
      </main>
    </div>
  );
}

type TabId = (typeof TABS)[number][0] | "account" | "team-mgmt" | "logs";

const LOG_LABEL: Record<string, string> = {
  depts: "Updated departments",
  employees: "Updated team members",
  records: "Updated attendance",
  perf: "Updated performance",
  tasks: "Updated tasks",
  settings: "Updated settings",
  team: "Updated user accounts / roles",
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
