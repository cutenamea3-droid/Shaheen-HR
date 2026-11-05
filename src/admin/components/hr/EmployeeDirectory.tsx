import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/admin/lib/store";
import {
  SYNTHETIC_EMPLOYEES,
  useEmployeeFinanceMock,
} from "@/admin/lib/employee-finance-mock";
import {
  EMPLOYMENT_STATUS_LABEL,
  type EmploymentStatus,
} from "@/admin/lib/employee-finance-types";
import {
  PK_INSTITUTION_OTHER_ID,
  PK_PAYMENT_INSTITUTIONS,
  PK_PAYMENT_INSTITUTIONS_REF_DATE,
  institutionDisplayLabel,
  pkInstitutionKindLabel,
  searchPkInstitutions,
} from "@/admin/lib/pk-payment-institutions";
import { formatPkIbanGroups, maskPkIban } from "@/admin/lib/pk-iban";
import { SectionTitle } from "./common";

type DirectoryRow = {
  id: string;
  name: string;
  deptLabel: string;
  source: "live" | "mock";
};

export function EmployeeDirectory() {
  const liveEmployees = useApp((s) => s.employees);
  const depts = useApp((s) => s.depts);
  const meta = useEmployeeFinanceMock((s) => s.meta);
  const ensureMeta = useEmployeeFinanceMock((s) => s.ensureMeta);
  const setStatus = useEmployeeFinanceMock((s) => s.setStatus);
  const currentBanking = useEmployeeFinanceMock((s) => s.currentBanking);
  const bankingHistory = useEmployeeFinanceMock((s) => s.bankingHistory);
  const addBankingChange = useEmployeeFinanceMock((s) => s.addBankingChange);
  const toggleReveal = useEmployeeFinanceMock((s) => s.toggleReveal);
  const revealAccountIds = useEmployeeFinanceMock((s) => s.revealAccountIds);
  const resetMockSeed = useEmployeeFinanceMock((s) => s.resetMockSeed);

  const [statusFilter, setStatusFilter] = useState<"all" | EmploymentStatus>("all");
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(SYNTHETIC_EMPLOYEES[0]?.id ?? null);
  const [showDeactivateId, setShowDeactivateId] = useState<string | null>(null);
  const [bankErr, setBankErr] = useState("");
  const [instQuery, setInstQuery] = useState("");
  const [form, setForm] = useState({
    institutionId: "hbl",
    otherLabel: "",
    accountTitle: "",
    accountRef: "",
    isIban: true,
    effectiveFrom: new Date().toISOString().slice(0, 10),
    note: "",
  });

  const rows: DirectoryRow[] = useMemo(() => {
    const live: DirectoryRow[] = liveEmployees.map((e) => ({
      id: e.id,
      name: e.name,
      deptLabel: depts.find((d) => d.id === e.deptId)?.name ?? "—",
      source: "live",
    }));
    const mock: DirectoryRow[] = SYNTHETIC_EMPLOYEES.map((e) => ({
      id: e.id,
      name: e.name,
      deptLabel: e.deptLabel,
      source: "mock",
    }));
    // Prefer listing live roster + synthetic demo rows (mock IDs never collide with random live ids in practice).
    return [...live, ...mock];
  }, [liveEmployees, depts]);

  useEffect(() => {
    for (const r of rows) ensureMeta(r.id);
  }, [rows, ensureMeta]);

  const filtered = rows.filter((r) => {
    const st = meta[r.id]?.status ?? "active";
    if (statusFilter !== "all" && st !== statusFilter) return false;
    if (q.trim()) {
      const hay = `${r.name} ${r.deptLabel} ${r.id}`.toLowerCase();
      if (!hay.includes(q.trim().toLowerCase())) return false;
    }
    return true;
  });

  const selected = rows.find((r) => r.id === selectedId) ?? null;
  const hist = selected ? bankingHistory(selected.id) : [];
  const current = selected ? currentBanking(selected.id) : undefined;
  const institutions = searchPkInstitutions(instQuery);

  const counts = {
    all: rows.length,
    active: rows.filter((r) => (meta[r.id]?.status ?? "active") === "active").length,
    inactive: rows.filter((r) => meta[r.id]?.status === "inactive").length,
    leave: rows.filter((r) => meta[r.id]?.status === "leave").length,
  };

  return (
    <div className="space-y-4">
      <SectionTitle
        title="Employee directory"
        sub="Reuse Team employee IDs. Employment status + banking are MOCK session memory only — never written to localStorage or cloud app_state."
        right={
          <button type="button" className="btn-ghost" onClick={() => resetMockSeed()}>
            Reset mock seed
          </button>
        }
      />

      <div className="rounded-lg border border-warn/40 bg-warn-soft px-3 py-2 text-sm font-semibold text-warn" role="status">
        Persistence blocked until secure banking tables are approved. Synthetic MOCK employees include sample IBAN/wallet data for UI tests.
        Institution list reference date: {PK_PAYMENT_INSTITUTIONS_REF_DATE}.
      </div>

      <div className="admin-toolbar flex-wrap gap-2">
        <input
          className="field w-48"
          placeholder="Search name / dept"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Filter employees"
        />
        {(["all", "active", "inactive", "leave"] as const).map((f) => (
          <button
            key={f}
            type="button"
            className={statusFilter === f ? "btn-primary" : "btn-ghost"}
            onClick={() => setStatusFilter(f)}
          >
            {f === "all" ? `All (${counts.all})` : `${EMPLOYMENT_STATUS_LABEL[f]} (${counts[f]})`}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-2">
          {filtered.map((r) => {
            const st = meta[r.id]?.status ?? "active";
            return (
              <div
                key={r.id}
                className={`admin-emp-card grid gap-2 md:grid-cols-[1fr_auto_auto] md:items-center ${selectedId === r.id ? "ring-2 ring-primary/40" : ""}`}
              >
                <button type="button" className="text-left" onClick={() => setSelectedId(r.id)}>
                  <div className="font-bold tracking-tight">{r.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {r.deptLabel} · ID {r.id}
                    {r.source === "mock" ? " · synthetic" : ""}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {currentBanking(r.id)
                      ? `Pay to: ${institutionDisplayLabel(currentBanking(r.id)!.institutionId, currentBanking(r.id)!.otherLabel)} · ${
                          currentBanking(r.id)!.isIban
                            ? maskPkIban(currentBanking(r.id)!.accountRef)
                            : `••••${currentBanking(r.id)!.accountRef.slice(-4)}`
                        }`
                      : "No banking on file (mock)"}
                  </div>
                </button>
                <span
                  className={`justify-self-start rounded-md px-2 py-1 text-xs font-bold ${
                    st === "active" ? "bg-success/15 text-success" : st === "leave" ? "bg-info/15 text-info" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {EMPLOYMENT_STATUS_LABEL[st]}
                </span>
                <div className="admin-toolbar justify-end gap-1">
                  {st !== "active" && (
                    <button
                      type="button"
                      className="btn-primary px-3"
                      onClick={() => setStatus(r.id, "active")}
                      title="Reactivate same employee ID (no duplicate)"
                    >
                      Reactivate
                    </button>
                  )}
                  {st !== "leave" && st === "active" && (
                    <button type="button" className="btn-ghost px-3" onClick={() => setStatus(r.id, "leave")}>
                      Leave
                    </button>
                  )}
                  {st !== "inactive" && (
                    <button type="button" className="btn-danger px-3" onClick={() => setShowDeactivateId(r.id)}>
                      Deactivate
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <p className="text-sm text-muted-foreground">No employees match this filter.</p>}
        </div>

        <div className="space-y-4">
          {selected ? (
            <>
              <div className="admin-emp-card space-y-3">
                <h3 className="font-display text-lg font-extrabold tracking-tight">{selected.name}</h3>
                <p className="text-sm text-muted-foreground">Banking & wallet destinations — masked by default. History is append-only.</p>
                {current ? (
                  <div className="rounded-md bg-muted/40 px-3 py-2 text-sm">
                    <div className="font-semibold">{institutionDisplayLabel(current.institutionId, current.otherLabel)}</div>
                    <div>{current.accountTitle}</div>
                    <div className="font-mono text-xs">
                      {revealAccountIds.has(current.id)
                        ? current.isIban
                          ? formatPkIbanGroups(current.accountRef)
                          : current.accountRef
                        : current.isIban
                          ? maskPkIban(current.accountRef)
                          : `••••${current.accountRef.slice(-4)}`}
                    </div>
                    <button type="button" className="btn-ghost mt-2 h-8 px-2 text-xs" onClick={() => toggleReveal(current.id)}>
                      {revealAccountIds.has(current.id) ? "Hide" : "Reveal"} account
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No current account — add one below (session mock only).</p>
                )}

                <form
                  className="grid gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setBankErr("");
                    const res = addBankingChange({
                      employeeId: selected.id,
                      ...form,
                    });
                    if (!res.ok) setBankErr(res.error ?? "Failed");
                    else {
                      setForm((f) => ({ ...f, accountRef: "", note: "", accountTitle: "" }));
                    }
                  }}
                >
                  <label>
                    <span className="lbl">Search institution</span>
                    <input className="field" value={instQuery} onChange={(e) => setInstQuery(e.target.value)} placeholder="HBL, Meezan, JazzCash…" />
                  </label>
                  <label>
                    <span className="lbl">Institution</span>
                    <select
                      className="field"
                      value={form.institutionId}
                      onChange={(e) => setForm((f) => ({ ...f, institutionId: e.target.value }))}
                    >
                      {institutions.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name} — {pkInstitutionKindLabel(i.kind)}
                          {!i.isBank ? " (wallet)" : ""}
                        </option>
                      ))}
                      <option value={PK_INSTITUTION_OTHER_ID}>Other…</option>
                    </select>
                  </label>
                  {form.institutionId === PK_INSTITUTION_OTHER_ID && (
                    <label>
                      <span className="lbl">Other label</span>
                      <input className="field" value={form.otherLabel} onChange={(e) => setForm((f) => ({ ...f, otherLabel: e.target.value }))} />
                    </label>
                  )}
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      checked={form.isIban}
                      onChange={(e) => setForm((f) => ({ ...f, isIban: e.target.checked }))}
                    />
                    Pakistan IBAN (uncheck for wallet / mobile number)
                  </label>
                  <label>
                    <span className="lbl">Account title</span>
                    <input className="field" value={form.accountTitle} onChange={(e) => setForm((f) => ({ ...f, accountTitle: e.target.value }))} />
                  </label>
                  <label>
                    <span className="lbl">{form.isIban ? "IBAN" : "Wallet / account ref"}</span>
                    <input className="field font-mono" value={form.accountRef} onChange={(e) => setForm((f) => ({ ...f, accountRef: e.target.value }))} />
                  </label>
                  <label>
                    <span className="lbl">Effective from</span>
                    <input type="date" className="field" value={form.effectiveFrom} onChange={(e) => e.target.value && setForm((f) => ({ ...f, effectiveFrom: e.target.value }))} />
                  </label>
                  <label>
                    <span className="lbl">Note</span>
                    <input className="field" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
                  </label>
                  {bankErr && (
                    <p className="text-sm text-destructive" role="alert">
                      {bankErr}
                    </p>
                  )}
                  <button type="submit" className="btn-primary">
                    Save as new account (keep history)
                  </button>
                </form>
              </div>

              <div className="admin-emp-card space-y-2">
                <h4 className="font-bold">Account change history</h4>
                {hist.length === 0 && <p className="text-sm text-muted-foreground">No history yet.</p>}
                {hist.map((h) => (
                  <div key={h.id} className="border-b border-border/60 py-2 text-sm last:border-0">
                    <div className="font-semibold">
                      {institutionDisplayLabel(h.institutionId, h.otherLabel)}
                      {h.supersededAt ? (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">superseded {h.supersededAt}</span>
                      ) : (
                        <span className="ml-2 text-xs font-bold text-success">current</span>
                      )}
                    </div>
                    <div className="font-mono text-xs">
                      {revealAccountIds.has(h.id)
                        ? h.isIban
                          ? formatPkIbanGroups(h.accountRef)
                          : h.accountRef
                        : h.isIban
                          ? maskPkIban(h.accountRef)
                          : `••••${h.accountRef.slice(-4)}`}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      From {h.effectiveFrom}
                      {h.note ? ` · ${h.note}` : ""}
                    </div>
                    <button type="button" className="btn-ghost mt-1 h-7 px-2 text-xs" onClick={() => toggleReveal(h.id)}>
                      {revealAccountIds.has(h.id) ? "Hide" : "Reveal"}
                    </button>
                  </div>
                ))}
              </div>

              <div className="admin-emp-card text-xs text-muted-foreground">
                Directory lists {PK_PAYMENT_INSTITUTIONS.length} institutions (ref {PK_PAYMENT_INSTITUTIONS_REF_DATE}). EMI/PSP entries are labelled wallets — not banks.
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Select an employee to manage banking.</p>
          )}
        </div>
      </div>

      {showDeactivateId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="deactivate-title">
          <div className="admin-emp-card max-w-md space-y-3 bg-background shadow-lg">
            <h3 id="deactivate-title" className="font-display text-lg font-extrabold">
              Confirm deactivate
            </h3>
            <p className="text-sm text-muted-foreground">
              Mark this employee inactive? They stay under the same ID (no duplicate on reactivate). Attendance history is preserved.
            </p>
            <div className="admin-toolbar justify-end">
              <button type="button" className="btn-ghost" onClick={() => setShowDeactivateId(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={() => {
                  setStatus(showDeactivateId, "inactive", true);
                  setShowDeactivateId(null);
                }}
              >
                Deactivate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
