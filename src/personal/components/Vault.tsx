import { useEffect, useRef, useState } from "react";
import { Btn, Field, Panel, SectionHead } from "./common";
import {
  hasPersonalCredentials,
  setPersonalCredentials,
  PERSONAL_AUTH_KEYS,
  readPersonalSessionLogin,
} from "@/personal/lib/auth";
import { PERSONAL_NAV_KEY } from "@/personal/lib/access";
import {
  FORBIDDEN_COMPANY_KEYS,
  PERSONAL_STORAGE_KEY,
} from "@/personal/lib/defaults";
import { todayKey, usePersonal } from "@/personal/lib/store";
import { ThemeToggle } from "@/personal/components/ThemeToggle";
import {
  applyPersonalBackup,
  downloadPersonalBackup,
  parsePersonalBackup,
  PERSONAL_LOCAL_STORAGE_KEYS,
} from "@/personal/lib/backup";
import {
  getPersonalCloudStatus,
  subscribePersonalCloudStatus,
} from "@/personal/lib/cloud-sync";
import {
  isPersonalSecureEnabled,
  personalAuthMode,
  personalSignOut,
  personalSessionLabel,
} from "@/personal/lib/session";
import { updatePersonalSecurePassword } from "@/personal/lib/secure-auth";
import { PERSONAL_UNSYNCED_KEY } from "@/personal/lib/sync-protect";
import { PERSONAL_SB_AUTH_STORAGE_KEY } from "@/personal/integrations/supabase/client";

function AccessNavControls() {
  return (
    <div className="mb-4 rounded-md border border-[var(--hp-violet)]/35 bg-[var(--hp-violet)]/10 p-3 text-sm">
      <div className="font-semibold text-[var(--hp-violet)]">Company switcher policy</div>
      <p className="mt-1 text-xs text-[var(--hp-muted)]">
        HR Personal is <strong className="text-[var(--hp-ink)]">never</strong> shown in the company
        AppSwitcher for ordinary users. The Personal tab appears only while you are already on{" "}
        <code>/personal</code>. Bookmark the URL to return. Hiding the tab is not security — auth
        still required.
      </p>
    </div>
  );
}

export function Vault() {
  const settings = usePersonal((s) => s.settings);
  const setSettings = usePersonal((s) => s.setSettings);
  const discipline = usePersonal((s) => s.discipline);
  const toggleDiscipline = usePersonal((s) => s.toggleDiscipline);
  const vaultNotes = usePersonal((s) => s.vaultNotes);
  const setVaultNotes = usePersonal((s) => s.setVaultNotes);
  const setAuthed = usePersonal((s) => s.setAuthed);

  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState("");
  const [sessionLabel, setSessionLabel] = useState<string | null>(null);
  const [cloudStatus, setCloudStatus] = useState(getPersonalCloudStatus);
  const fileRef = useRef<HTMLInputElement>(null);
  const today = todayKey();
  const secure = isPersonalSecureEnabled();
  const mode = personalAuthMode();

  useEffect(() => {
    const unsub = subscribePersonalCloudStatus(() => setCloudStatus(getPersonalCloudStatus()));
    return () => {
      unsub();
    };
  }, []);
  useEffect(() => {
    void personalSessionLabel().then(setSessionLabel);
  }, []);

  return (
    <div className="space-y-4">
      <Panel>
        <SectionHead
          title="Discipline dashboard"
          subtitle="Daily checks you mark yourself — no automatic attendance fiction"
        />
        <ul className="space-y-2">
          {discipline.map((d) => {
            const on = d.doneDates.includes(today);
            return (
              <li
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--hp-border)] px-3 py-2"
              >
                <div>
                  <div className="text-sm font-semibold">{d.label}</div>
                  <div className="text-xs text-[var(--hp-muted)]">
                    {d.doneDates.length} day(s) logged
                  </div>
                </div>
                <Btn variant={on ? "teal" : "ghost"} onClick={() => toggleDiscipline(d.id, today)}>
                  {on ? "Done today" : "Mark today"}
                </Btn>
              </li>
            );
          })}
        </ul>
      </Panel>

      <Panel>
        <SectionHead
          title="Schedule budgets"
          subtitle="Mon–Sat Normal · Sunday Recovery Mission · Busy 45 · Rescue 20 — adjustable"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Mon–Sat Normal (minutes)">
            <input
              className="hp-field"
              type="number"
              min={20}
              max={480}
              value={settings.weekdayMinutes}
              onChange={(e) =>
                setSettings({ weekdayMinutes: Number(e.target.value) || 120 })
              }
            />
          </Field>
          <Field label="Sunday Recovery Mission (minutes)">
            <input
              className="hp-field"
              type="number"
              min={20}
              max={600}
              value={settings.sundayMinutes}
              onChange={(e) =>
                setSettings({ sundayMinutes: Number(e.target.value) || 270 })
              }
            />
          </Field>
          <Field label="Pomodoro focus (min)">
            <input
              className="hp-field"
              type="number"
              min={5}
              max={90}
              value={settings.pomodoroFocus}
              onChange={(e) =>
                setSettings({ pomodoroFocus: Number(e.target.value) || 25 })
              }
            />
          </Field>
          <Field label="Pomodoro break (min)">
            <input
              className="hp-field"
              type="number"
              min={1}
              max={30}
              value={settings.pomodoroBreak}
              onChange={(e) =>
                setSettings({ pomodoroBreak: Number(e.target.value) || 5 })
              }
            />
          </Field>
        </div>
      </Panel>

      <Panel>
        <SectionHead
          title="Backup & restore"
          subtitle="Personal study JSON only — never company Driver/Attendance backups"
        />
        <p className="mb-3 text-xs text-[var(--hp-muted)]">
          Export a Personal-only file you can keep offline. Restore replaces study data in this
          workspace (and pushes to Personal cloud when secure mode is on).
        </p>
        <div className="flex flex-wrap gap-2">
          <Btn
            onClick={() => {
              downloadPersonalBackup();
              setMsg("Personal backup downloaded.");
            }}
          >
            Download backup
          </Btn>
          <Btn variant="ghost" onClick={() => fileRef.current?.click()}>
            Restore backup…
          </Btn>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              try {
                const text = await file.text();
                const env = parsePersonalBackup(text);
                applyPersonalBackup(env);
                setMsg(`Restored Personal backup from ${env.exportedAt}.`);
              } catch (err) {
                setMsg(err instanceof Error ? err.message : "Restore failed.");
              }
            }}
          />
        </div>
      </Panel>

      <Panel>
        <SectionHead
          title="Privacy & auth isolation"
          subtitle={
            secure
              ? "Secure mode — Personal Supabase Auth + personal_study_state (RLS)"
              : "Local mock gate — enable VITE_PERSONAL_AUTH_SECURE after Personal SQL apply"
          }
        />
        <AccessNavControls />
        <div className="mb-4 space-y-3 rounded-md border border-[var(--hp-teal)]/30 bg-[var(--hp-teal)]/10 p-3 text-sm">
          <div>
            <div className="font-semibold text-[var(--hp-teal)]">Auth mode: {mode}</div>
            <p className="mt-1 text-xs text-[var(--hp-muted)]">
              {secure ? (
                <>
                  Signed in as <code>{sessionLabel ?? "…"}</code>. Cloud status:{" "}
                  <strong className="text-[var(--hp-ink)]">{cloudStatus}</strong>. Study data
                  persists in Personal-only table <code>personal_study_state</code> — same login on
                  another browser loads the same records after sign-in.{" "}
                  <code>{PERSONAL_STORAGE_KEY}</code> is cache only.
                </>
              ) : (
                <>
                  Feature flag off: device-local hash gate + <code>{PERSONAL_STORAGE_KEY}</code> only.
                  Cross-browser sync is unavailable until Personal project SQL is applied and{" "}
                  <code>VITE_PERSONAL_AUTH_SECURE=1</code> is set (Preview first).
                </>
              )}
            </p>
          </div>
          <div>
            <div className="font-semibold text-[var(--hp-violet)]">Isolation (hard)</div>
            <ul className="mt-1 list-inside list-disc text-xs text-[var(--hp-muted)]">
              <li>Personal client uses only <code>VITE_PERSONAL_*</code> — never Driver/Admin URLs</li>
              <li>
                Never writes company <code>app_state</code>, <code>tracker_sections</code>, payroll,
                banking, drug tests, or rate cards
              </li>
              <li>URL alone never unlocks the vault — credentials required every new browser</li>
            </ul>
          </div>
          <div>
            <div className="font-semibold text-[var(--hp-ink)]">Personal browser keys (audit)</div>
            <ul className="mt-1 list-inside list-disc text-xs text-[var(--hp-muted)]">
              <li>
                Study cache: <code>{PERSONAL_LOCAL_STORAGE_KEYS.studyData}</code>
              </li>
              <li>
                Local secrets (mock mode): <code>{PERSONAL_LOCAL_STORAGE_KEYS.authSecrets}</code>
              </li>
              <li>
                Local session (mock mode): <code>{PERSONAL_LOCAL_STORAGE_KEYS.authSession}</code>
              </li>
              <li>
                Unsynced flag: <code>{PERSONAL_UNSYNCED_KEY}</code>
              </li>
              <li>
                Secure auth namespace: <code>{PERSONAL_SB_AUTH_STORAGE_KEY}</code>
              </li>
              {PERSONAL_AUTH_KEYS.map((k) => (
                <li key={k}>
                  Auth key: <code>{k}</code>
                </li>
              ))}
              <li>
                Nav flag: <code>{PERSONAL_NAV_KEY}</code>
              </li>
            </ul>
            <div className="mt-2 font-semibold text-[var(--hp-amber)]">Never touched</div>
            <ul className="mt-1 list-inside list-disc text-xs text-[var(--hp-muted)]">
              {FORBIDDEN_COMPANY_KEYS.map((k) => (
                <li key={k}>
                  <code>{k}</code>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mb-4">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--hp-muted)]">
            Appearance
          </div>
          <ThemeToggle />
          <p className="mt-2 text-xs text-[var(--hp-muted)]">
            Mixed-color enterprise theme — violet / blue / teal accents. Never company orange.
          </p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Password">
            <input
              className="hp-field"
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              autoComplete="new-password"
            />
          </Field>
          <Field label="Confirm password">
            <input
              className="hp-field"
              type="password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              autoComplete="new-password"
            />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Btn
            onClick={async () => {
              if (pw.length < 4 || pw !== pw2) {
                setMsg("Invalid credentials.");
                return;
              }
              if (secure) {
                const r = await updatePersonalSecurePassword(pw);
                setMsg(r.ok ? "Password updated on Personal Auth." : r.message);
              } else {
                const login = readPersonalSessionLogin() || "owner";
                await setPersonalCredentials(login, pw);
                setMsg(hasPersonalCredentials() ? "Password updated locally (hashed)." : "Saved.");
              }
              setPw("");
              setPw2("");
            }}
          >
            Save password
          </Btn>
          <Btn
            variant="danger"
            onClick={() => {
              void personalSignOut().then(() => setAuthed(false));
            }}
          >
            Sign out
          </Btn>
        </div>
        {msg ? <p className="mt-2 text-sm text-[var(--hp-teal)]">{msg}</p> : null}
      </Panel>

      <Panel>
        <SectionHead
          title="Study options"
          subtitle="Timetable · Focus · Progress · Notes — all Personal-only"
        />
        <ul className="mb-3 space-y-2 text-sm text-[var(--hp-muted)]">
          <li className="rounded-md border border-dashed border-[var(--hp-border)] px-3 py-2">
            <span className="font-semibold text-[var(--hp-ink)]">Timetable</span> — Normal / Busy /
            Rescue / Sunday Recovery budgets from your backlog
          </li>
          <li className="rounded-md border border-dashed border-[var(--hp-border)] px-3 py-2">
            <span className="font-semibold text-[var(--hp-ink)]">Focus</span> — pomodoro sessions
            logged as real minutes only
          </li>
          <li className="rounded-md border border-dashed border-[var(--hp-border)] px-3 py-2">
            <span className="font-semibold text-[var(--hp-ink)]">Progress</span> — Analytics from
            logged sessions; course lecture % only when you enter counts
          </li>
          <li className="rounded-md border border-dashed border-[var(--hp-border)] px-3 py-2">
            <span className="font-semibold text-[var(--hp-ink)]">Notes</span> — revision notes scoped
            to this Personal account
          </li>
        </ul>
        <Field label="Private vault scratchpad">
          <textarea
            className="hp-field min-h-[120px] py-2"
            value={vaultNotes}
            onChange={(e) => setVaultNotes(e.target.value)}
            placeholder="Do not store real passwords here. Semester goals only."
          />
        </Field>
      </Panel>
    </div>
  );
}
