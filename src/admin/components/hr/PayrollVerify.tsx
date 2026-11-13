import { useMemo, useState } from "react";
import { useApp } from "@/admin/lib/store";
import { SYNTHETIC_EMPLOYEES, useEmployeeFinanceMock } from "@/admin/lib/employee-finance-mock";
import { useOtApprovalStore } from "@/admin/lib/ot-approval";
import {
  HISTORICAL_ADDITIONAL_DAY_RATE_PKR,
  usePayrollPolicyStore,
} from "@/admin/lib/payroll-policy";
import { buildPayrollVerifyRow, summarizePayrollVerify } from "@/admin/lib/payroll-verify";
import { useBonusStore } from "@/admin/lib/bonus-store";
import { formatPkr } from "@/admin/lib/salary-payments";
import { SectionTitle, todayStr } from "./common";

export function PayrollVerify() {
  const liveEmployees = useApp((s) => s.employees);
  const payments = useEmployeeFinanceMock((s) => s.payments);
  const approvals = useOtApprovalStore((s) => s.rows);
  const policy = usePayrollPolicyStore((s) => s.policy);
  const setAdditionalDayRate = usePayrollPolicyStore((s) => s.setAdditionalDayRate);
  const setOvertimeHourlyRate = usePayrollPolicyStore((s) => s.setOvertimeHourlyRate);
  const setWorkingDaysDivisor = usePayrollPolicyStore((s) => s.setWorkingDaysDivisor);
  const confirmDivisorPolicy = usePayrollPolicyStore((s) => s.confirmDivisorPolicy);
  const bonuses = useBonusStore((s) => s.bonuses);
  const upsertBonus = useBonusStore((s) => s.upsertBonus);

  const [month, setMonth] = useState(todayStr().slice(0, 7));
  const [dayRateDraft, setDayRateDraft] = useState(String(policy.additionalDayRatePkr));
  const [otRateDraft, setOtRateDraft] = useState(policy.overtimeHourlyRatePkr != null ? String(policy.overtimeHourlyRatePkr) : "");
  const [divisorDraft, setDivisorDraft] = useState(policy.workingDaysDivisor != null ? String(policy.workingDaysDivisor) : "");
  const [bonusDraft, setBonusDraft] = useState<Record<string, string>>({});
  const [err, setErr] = useState("");

  const roster = useMemo(() => {
    const ids = new Map<string, string>();
    for (const e of liveEmployees) ids.set(e.id, e.name);
    for (const e of SYNTHETIC_EMPLOYEES) ids.set(e.id, e.name);
    return ids;
  }, [liveEmployees]);

  const rows = useMemo(() => {
    const out = [];
    for (const [employeeId] of roster) {
      const payment = payments.find((p) => p.employeeId === employeeId && p.month === month);
      const bonus = bonuses.find((b) => b.employeeId === employeeId && b.month === month);
      // Skip empty employees with no payment / approvals / bonus
      const hasApproval = Object.values(approvals).some(
        (a) => a.employeeId === employeeId && a.date.startsWith(month),
      );
      if (!payment && !bonus && !hasApproval) continue;
      const verifyInput: Parameters<typeof buildPayrollVerifyRow>[0] = {
        employeeId,
        month,
        policy,
        approvals,
        payment,
        bonusPkr: bonus?.amountPkr ?? 0,
      };
      if (bonus?.note != null) verifyInput.bonusNote = bonus.note;
      out.push(buildPayrollVerifyRow(verifyInput));
    }
    return out;
  }, [roster, payments, bonuses, approvals, month, policy]);

  const summary = useMemo(() => summarizePayrollVerify(rows), [rows]);

  const applyPolicy = () => {
    setErr("");
    const day = Number(dayRateDraft);
    const r1 = setAdditionalDayRate(day);
    if (!r1.ok) {
      setErr(r1.error ?? "Day rate failed");
      return;
    }
    if (otRateDraft.trim() === "") {
      setOvertimeHourlyRate(null);
    } else {
      const r2 = setOvertimeHourlyRate(Number(otRateDraft));
      if (!r2.ok) {
        setErr(r2.error ?? "OT rate failed");
        return;
      }
    }
    if (divisorDraft.trim() === "") {
      setWorkingDaysDivisor(null);
    } else {
      const r3 = setWorkingDaysDivisor(Number(divisorDraft));
      if (!r3.ok) {
        setErr(r3.error ?? "Divisor failed");
        return;
      }
    }
  };

  return (
    <div className="space-y-4">
      <SectionTitle
        title="Payroll verification"
        sub="Payable (basic + approved OT + approved additional days + bonus) vs Actual Paid from the salary register. Never auto-equates."
        right={
          <input
            type="month"
            className="field w-auto"
            aria-label="Verify month"
            value={month}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
          />
        }
      />

      <div className="rounded-lg border border-warn/40 bg-warn-soft px-3 py-2 text-sm font-semibold text-warn" role="status">
        Actual Paid ≠ Payable. Bonus ≠ OT ≠ Additional Days. Working-days divisors (26/27) are{" "}
        <em>not</em> invented — unset or unconfirmed → Needs Policy Confirmation. Historical additional-day rate
        reference: Rs {HISTORICAL_ADDITIONAL_DAY_RATE_PKR}/day (configurable). Oct 2026 salary history stays locked
        in the register.
      </div>

      <div className="admin-emp-card space-y-3">
        <h3 className="font-bold">Pay policy (session)</h3>
        <p className="text-sm text-muted-foreground">
          Not stored in attendance <code>app_state</code>. Changing the divisor clears confirmation.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">
            Additional day rate (PKR)
            <input className="field mt-1" value={dayRateDraft} onChange={(e) => setDayRateDraft(e.target.value)} />
          </label>
          <label className="text-sm">
            OT hourly rate (PKR) — blank = Needs Policy
            <input className="field mt-1" value={otRateDraft} onChange={(e) => setOtRateDraft(e.target.value)} placeholder="unset" />
          </label>
          <label className="text-sm">
            Working-days divisor — blank = Needs Policy
            <input className="field mt-1" value={divisorDraft} onChange={(e) => setDivisorDraft(e.target.value)} placeholder="do not invent 26/27" />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-primary" onClick={applyPolicy}>
            Apply policy
          </button>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={policy.divisorPolicyConfirmed}
              disabled={policy.workingDaysDivisor == null}
              onChange={(e) => confirmDivisorPolicy(e.target.checked)}
            />
            Owner confirms divisor policy
          </label>
          {err && <span className="text-sm font-semibold text-destructive">{err}</span>}
        </div>
        <p className="text-xs text-muted-foreground">
          Active: day Rs {policy.additionalDayRatePkr} · OT{" "}
          {policy.overtimeHourlyRatePkr == null ? "Needs Policy Confirmation" : `Rs ${policy.overtimeHourlyRatePkr}/h`} ·
          divisor{" "}
          {policy.workingDaysDivisor == null
            ? "Needs Policy Confirmation"
            : `${policy.workingDaysDivisor}${policy.divisorPolicyConfirmed ? " (confirmed)" : " (unconfirmed)"}`}
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryTile label="Payable (computable)" value={formatPkr(summary.payablePkr)} />
        <SummaryTile label="Actual Paid" value={formatPkr(summary.actualPaidPkr)} />
        <SummaryTile label="Variance (Payable − Paid)" value={formatPkr(summary.variancePkr)} />
        <SummaryTile label="Needs Policy rows" value={String(summary.needsPolicyCount)} />
      </div>

      {rows.length === 0 && (
        <div className="panel text-sm text-muted-foreground">
          No salary register / bonus / OT approval rows for this month. Enter dues on Salary pay or approve OT first.
        </div>
      )}

      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.employeeId} className="admin-emp-card space-y-2">
            <div className="admin-emp-head">
              <h3 className="font-bold tracking-tight">{roster.get(r.employeeId) ?? r.employeeId}</h3>
              <p className="text-sm">
                Payable <b>{formatPkr(r.payablePkr)}</b> · Actual Paid <b>{formatPkr(r.actualPaidPkr)}</b> · Variance{" "}
                <b>{formatPkr(r.variancePkr)}</b>
                {r.needsPolicyConfirmation && (
                  <span className="ml-2 font-semibold text-warn"> · Needs Policy Confirmation</span>
                )}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">Line</th>
                    <th scope="col">Amount</th>
                    <th scope="col">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {r.lines.map((line) => (
                    <tr key={line.kind}>
                      <td>{line.label}</td>
                      <td>
                        {line.amountPkr != null
                          ? formatPkr(line.amountPkr)
                          : line.gate && !line.gate.ok
                            ? "Needs Policy Confirmation"
                            : "—"}
                      </td>
                      <td className="text-sm text-muted-foreground">
                        {line.gate && !line.gate.ok ? line.gate.message : line.detail}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-sm">
                Bonus (PKR) — separate line
                <input
                  className="field mt-1 w-36"
                  value={bonusDraft[r.employeeId] ?? ""}
                  onChange={(e) => setBonusDraft((s) => ({ ...s, [r.employeeId]: e.target.value }))}
                  placeholder="0"
                />
              </label>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  const n = Number(bonusDraft[r.employeeId] ?? "0");
                  const res = upsertBonus(r.employeeId, month, n, "manual bonus");
                  if (!res.ok) setErr(res.error ?? "Bonus failed");
                }}
              >
                Save bonus
              </button>
              <span className="text-xs text-muted-foreground">Register status: {r.paymentStatus}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="admin-stat">
      <p className="admin-stat-label">{label}</p>
      <p className="admin-stat-value text-base">{value}</p>
    </div>
  );
}
