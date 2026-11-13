import { useMemo, useState } from "react";
import { useApp } from "@/admin/lib/store";
import {
  SYNTHETIC_EMPLOYEES,
  useEmployeeFinanceMock,
} from "@/admin/lib/employee-finance-mock";
import {
  SALARY_PAYMENT_STATUS_LABEL,
  type SalaryPaymentStatus,
} from "@/admin/lib/employee-finance-types";
import { employeeFinanceModeLabel, getEmployeeFinanceMode } from "@/admin/lib/employee-finance-mode";
import { institutionDisplayLabel } from "@/admin/lib/pk-payment-institutions";
import { maskPkIban } from "@/admin/lib/pk-iban";
import { formatPkr, salaryPaymentsCsv, summarizePayments } from "@/admin/lib/salary-payments";
import { SectionTitle, todayStr } from "./common";

export function SalaryPayments() {
  const liveEmployees = useApp((s) => s.employees);
  const payments = useEmployeeFinanceMock((s) => s.payments);
  const banking = useEmployeeFinanceMock((s) => s.banking);
  const meta = useEmployeeFinanceMock((s) => s.meta);
  const paymentEvents = useEmployeeFinanceMock((s) => s.paymentEvents);
  const upsertPaymentDue = useEmployeeFinanceMock((s) => s.upsertPaymentDue);
  const recordPayment = useEmployeeFinanceMock((s) => s.recordPayment);
  const setPaymentStatus = useEmployeeFinanceMock((s) => s.setPaymentStatus);
  const ensureMeta = useEmployeeFinanceMock((s) => s.ensureMeta);
  const financeMode = getEmployeeFinanceMode();

  const [month, setMonth] = useState("2026-10");
  const [statusFilter, setStatusFilter] = useState<"all" | SalaryPaymentStatus>("all");
  const [payAmount, setPayAmount] = useState<Record<string, string>>({});
  const [dueDraft, setDueDraft] = useState<Record<string, string>>({});
  const [err, setErr] = useState("");
  const [historyFor, setHistoryFor] = useState<string | null>(null);

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of liveEmployees) m.set(e.id, e.name);
    for (const e of SYNTHETIC_EMPLOYEES) m.set(e.id, e.name);
    return m;
  }, [liveEmployees]);

  const monthRows = useMemo(() => {
    return payments
      .filter((p) => p.month === month)
      .filter((p) => (statusFilter === "all" ? true : p.status === statusFilter));
  }, [payments, month, statusFilter]);

  const summary = useMemo(() => summarizePayments(payments.filter((p) => p.month === month)), [payments, month]);

  const bankById = useMemo(() => {
    const m = new Map(banking.map((b) => [b.id, b]));
    return m;
  }, [banking]);

  const ensureRowsForRoster = () => {
    setErr("");
    const ids = [...liveEmployees.map((e) => e.id), ...SYNTHETIC_EMPLOYEES.map((e) => e.id)];
    for (const id of ids) {
      ensureMeta(id);
      const draft = dueDraft[id];
      const existing = payments.find((p) => p.employeeId === id && p.month === month);
      if (draft != null && draft !== "") {
        const n = Number(draft);
        const r = upsertPaymentDue(id, month, n);
        if (!r.ok) {
          setErr(r.error ?? "Failed");
          return;
        }
      } else if (!existing) {
        // do not invent amounts — leave HR to enter due
      }
    }
  };

  const exportCsv = () => {
    const rows = payments
      .filter((p) => p.month === month)
      .map((p) => {
        const bank = p.bankingAccountId ? bankById.get(p.bankingAccountId) : undefined;
        return {
          employeeName: nameById.get(p.employeeId) ?? p.employeeId,
          month: p.month,
          amountDuePkr: p.amountDuePkr,
          amountPaidPkr: p.amountPaidPkr,
          status: p.status,
          institution: bank ? institutionDisplayLabel(bank.institutionId, bank.otherLabel) : "",
          accountLast4: bank?.accountLast4 ?? "",
          paidOn: p.paidOn ?? "",
          note: p.note,
        };
      });
    const csv = salaryPaymentsCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Shaheen_Salary_Payments_${month}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-4">
      <SectionTitle
        title="Monthly salary payments"
        sub="PKR whole numbers. Status is manual — payroll hours CSV never auto-marks Paid. No fund transfers. Bank refs masked; export uses last4 only."
        right={
          <>
            <input
              type="month"
              className="field w-auto"
              aria-label="Payment month"
              value={month}
              onChange={(e) => e.target.value && setMonth(e.target.value)}
            />
            <button type="button" className="btn-primary" onClick={exportCsv}>
              Export CSV (masked)
            </button>
          </>
        }
      />

      <div className="rounded-lg border border-warn/40 bg-warn-soft px-3 py-2 text-sm font-semibold text-warn" role="status">
        Mode: {employeeFinanceModeLabel(financeMode)}. Recording a payment does not move money or change attendance payroll calc.
        Basic salary paid here is <strong>not</strong> an expense (see Expenses). Secure RPCs stay off until migration apply +
        VITE_HR_FINANCE_SECURE=1. Gate production release behind Attendance sync (PR #19) verified — mock persistence is not live cloud.
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryTile label="Due" value={formatPkr(summary.duePkr)} />
        <SummaryTile label="Paid" value={formatPkr(summary.paidPkr)} />
        <SummaryTile label="Remaining" value={formatPkr(summary.remainingPkr)} />
        <SummaryTile
          label="Statuses"
          value={`${summary.unpaid} unpaid · ${summary.partial} partial · ${summary.paid} paid · ${summary.onHold} hold`}
        />
      </div>

      <div className="admin-toolbar flex-wrap gap-2">
        {(["all", "unpaid", "partial", "paid", "on_hold"] as const).map((f) => (
          <button key={f} type="button" className={statusFilter === f ? "btn-primary" : "btn-ghost"} onClick={() => setStatusFilter(f)}>
            {f === "all" ? "All" : SALARY_PAYMENT_STATUS_LABEL[f]}
          </button>
        ))}
      </div>

      <div className="admin-emp-card space-y-3">
        <h3 className="font-bold">Seed / update due amounts (mock)</h3>
        <p className="text-sm text-muted-foreground">Enter whole PKR due for an employee, then Apply. Does not set status to Paid.</p>
        <div className="space-y-2">
          {[...SYNTHETIC_EMPLOYEES].map((e) => (
            <div key={e.id} className="grid gap-2 md:grid-cols-[1fr_160px] md:items-end">
              <div>
                <div className="text-sm font-semibold">{e.name}</div>
                <div className="text-xs text-muted-foreground">{EMP_STATUS(meta[e.id]?.status)}</div>
              </div>
              <label>
                <span className="lbl">Due PKR</span>
                <input
                  className="field"
                  inputMode="numeric"
                  value={dueDraft[e.id] ?? ""}
                  placeholder="e.g. 150000"
                  onChange={(ev) => setDueDraft((d) => ({ ...d, [e.id]: ev.target.value }))}
                />
              </label>
            </div>
          ))}
        </div>
        <button type="button" className="btn-primary" onClick={ensureRowsForRoster}>
          Apply due amounts
        </button>
        {err && (
          <p className="text-sm text-destructive" role="alert">
            {err}
          </p>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="py-2 pr-2 font-bold">Employee</th>
              <th className="py-2 pr-2 font-bold">Due</th>
              <th className="py-2 pr-2 font-bold">Paid</th>
              <th className="py-2 pr-2 font-bold">Status</th>
              <th className="py-2 pr-2 font-bold">Bank / wallet (masked)</th>
              <th className="py-2 pr-2 font-bold">Record payment</th>
            </tr>
          </thead>
          <tbody>
            {monthRows.map((p) => {
              const bank = p.bankingAccountId ? bankById.get(p.bankingAccountId) : undefined;
              return (
                <tr key={p.id} className="border-b border-border/70 align-top">
                  <td className="py-3 pr-2">
                    <div className="font-semibold">{nameById.get(p.employeeId) ?? p.employeeId}</div>
                    <div className="text-xs text-muted-foreground">{p.month}</div>
                  </td>
                  <td className="py-3 pr-2 whitespace-nowrap">{formatPkr(p.amountDuePkr)}</td>
                  <td className="py-3 pr-2 whitespace-nowrap">{formatPkr(p.amountPaidPkr)}</td>
                  <td className="py-3 pr-2">
                    <select
                      className="field w-auto"
                      value={p.status}
                      aria-label={`Status for ${nameById.get(p.employeeId)}`}
                      onChange={(e) => setPaymentStatus(p.id, e.target.value as SalaryPaymentStatus)}
                    >
                      {(Object.keys(SALARY_PAYMENT_STATUS_LABEL) as SalaryPaymentStatus[]).map((st) => (
                        <option key={st} value={st}>
                          {SALARY_PAYMENT_STATUS_LABEL[st]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3 pr-2 font-mono text-xs">
                    {bank ? (
                      <>
                        <div className="font-sans text-sm font-medium">{institutionDisplayLabel(bank.institutionId, bank.otherLabel)}</div>
                        {bank.isIban && bank.accountRef ? maskPkIban(bank.accountRef) : `••••${bank.accountLast4}`}
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-3 pr-2">
                    <div className="admin-toolbar gap-1">
                      <input
                        className="field w-28"
                        inputMode="numeric"
                        placeholder="PKR"
                        value={payAmount[p.id] ?? ""}
                        disabled={p.status === "on_hold" || p.status === "paid"}
                        onChange={(e) => setPayAmount((m) => ({ ...m, [p.id]: e.target.value }))}
                        aria-label="Partial payment amount"
                      />
                      <button
                        type="button"
                        className="btn-primary px-3"
                        disabled={p.status === "on_hold" || p.status === "paid"}
                        onClick={() => {
                          setErr("");
                          const n = Number(payAmount[p.id] ?? "");
                          const r = recordPayment(p.id, n, todayStr());
                          if (!r.ok) setErr(r.error ?? "Failed");
                          else setPayAmount((m) => ({ ...m, [p.id]: "" }));
                        }}
                      >
                        Add
                      </button>
                      <button type="button" className="btn-ghost px-3" onClick={() => setHistoryFor(historyFor === p.id ? null : p.id)}>
                        History
                      </button>
                    </div>
                    {historyFor === p.id && (
                      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                        {paymentEvents(p.id).map((ev) => (
                          <li key={ev.id}>
                            {new Date(ev.createdAt).toISOString().slice(0, 10)} · {ev.eventType}
                            {ev.amountPkr != null ? ` · ${formatPkr(ev.amountPkr)}` : ""}
                            {ev.statusAfter ? ` → ${ev.statusAfter}` : ""}
                            {ev.note ? ` · ${ev.note}` : ""}
                          </li>
                        ))}
                        {paymentEvents(p.id).length === 0 && <li>No events yet.</li>}
                      </ul>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {monthRows.length === 0 && <p className="mt-3 text-sm text-muted-foreground">No payment rows for this month/filter. Apply due amounts or reset mock seed from Directory.</p>}
      </div>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="admin-emp-card">
      <div className="text-xs font-bold tracking-wide text-muted-foreground uppercase">{label}</div>
      <div className="mt-1 text-sm font-bold leading-snug">{value}</div>
    </div>
  );
}

function EMP_STATUS(s?: string) {
  if (s === "inactive") return "Inactive";
  if (s === "leave") return "On leave";
  return "Active";
}
