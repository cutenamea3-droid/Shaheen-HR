import { useState } from "react";
import { Btn, Field, Panel, SectionHead } from "./common";
import {
  clearPersonalSession,
  hasPersonalPassword,
  setPersonalPassword,
} from "@/personal/lib/auth";
import {
  FORBIDDEN_COMPANY_KEYS,
  PERSONAL_STORAGE_KEY,
} from "@/personal/lib/defaults";
import { PERSONAL_AUTH_KEYS } from "@/personal/lib/auth";
import { todayKey, usePersonal } from "@/personal/lib/store";

/**
 * Vault covers truncated Feature 8+ items from the original brief:
 * discipline dashboard, privacy/auth isolation, and reserved slots for follow-up.
 */
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
  const today = todayKey();

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
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--hp-border)] px-3 py-2"
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
          title="Privacy & auth isolation"
          subtitle="Separate gate and storage from company Admin / Driver systems"
        />
        <div className="mb-4 rounded-lg border border-[var(--hp-teal)]/30 bg-[var(--hp-teal)]/10 p-3 text-sm">
          <div className="font-semibold text-[var(--hp-teal)]">Personal-only keys</div>
          <ul className="mt-2 list-inside list-disc text-xs text-[var(--hp-muted)]">
            <li>
              Data: <code>{PERSONAL_STORAGE_KEY}</code>
            </li>
            {PERSONAL_AUTH_KEYS.map((k) => (
              <li key={k}>
                Auth: <code>{k}</code>
              </li>
            ))}
          </ul>
          <div className="mt-3 font-semibold text-[var(--hp-amber)]">Never touched</div>
          <ul className="mt-1 list-inside list-disc text-xs text-[var(--hp-muted)]">
            {FORBIDDEN_COMPANY_KEYS.map((k) => (
              <li key={k}>
                <code>{k}</code>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-[var(--hp-muted)]">
            Local-first only. Optional secure cloud sync is deferred — no production migrations
            without approval (avoids company data bleed).
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Theme">
            <select
              className="hp-field"
              value={settings.theme}
              onChange={(e) =>
                setSettings({ theme: e.target.value as "dark" | "light" })
              }
            >
              <option value="dark">Dark premium</option>
              <option value="light">Light</option>
            </select>
          </Field>
          <Field label="Daily target (minutes)">
            <input
              className="hp-field"
              type="number"
              min={20}
              max={300}
              value={settings.dailyTargetMinutes}
              onChange={(e) =>
                setSettings({ dailyTargetMinutes: Number(e.target.value) || 120 })
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

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label={hasPersonalPassword() ? "Change gate password" : "Set gate password"}>
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
              if (pw.length < 6) {
                setMsg("Use at least 6 characters.");
                return;
              }
              if (pw !== pw2) {
                setMsg("Passwords do not match.");
                return;
              }
              await setPersonalPassword(pw);
              setPw("");
              setPw2("");
              setMsg("Personal gate password saved locally.");
            }}
          >
            Save password
          </Btn>
          <Btn
            variant="danger"
            onClick={() => {
              clearPersonalSession();
              setAuthed(false);
            }}
          >
            Lock &amp; sign out
          </Btn>
        </div>
        {msg ? <p className="mt-2 text-sm text-[var(--hp-teal)]">{msg}</p> : null}
      </Panel>

      <Panel>
        <SectionHead
          title="Feature vault (truncated follow-up)"
          subtitle="Original prompt cut off mid Feature 8 — reserved slots for the rest"
        />
        <ul className="mb-3 space-y-2 text-sm text-[var(--hp-muted)]">
          <li className="rounded-lg border border-dashed border-[var(--hp-border)] px-3 py-2">
            <span className="font-semibold text-[var(--hp-ink)]">Shipped here:</span> discipline
            dashboard · privacy/auth isolation · local vault notes
          </li>
          <li className="rounded-lg border border-dashed border-[var(--hp-border)] px-3 py-2">
            <span className="font-semibold text-[var(--hp-amber)]">Follow-up (truncated):</span> any
            remaining Feature 8+ items from the full brief — paste when available; no invented scope
          </li>
          <li className="rounded-lg border border-dashed border-[var(--hp-border)] px-3 py-2">
            Deferred: optional encrypted cloud backup (requires separate backend approval — no company
            tables)
          </li>
        </ul>
        <Field label="Private vault scratchpad">
          <textarea
            className="hp-field min-h-[120px] py-2"
            value={vaultNotes}
            onChange={(e) => setVaultNotes(e.target.value)}
            placeholder="Credentials reminders? Don’t store real passwords here. Use for semester goals / truncated feature notes."
          />
        </Field>
      </Panel>
    </div>
  );
}
