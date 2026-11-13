import { useMemo, useState } from "react";
import { useApp } from "@/admin/lib/store";
import { leaveBalance, prettyDate } from "@/admin/lib/calc";
import { leaveRoster, listLeaveDaysInMonth } from "@/admin/lib/leave-management";
import { useAdminNav } from "@/admin/lib/admin-nav";
import { SectionTitle, todayStr } from "./common";

/**
 * Leave Management — balances + month ledger from existing attendance leave days.
 * Does not invent accrual policy (uses leaveBalance / openingLeave / joinMonth).
 */
export function LeaveManagement() {
  const { employees, records } = useApp();
  const requestTab = useAdminNav((s) => s.requestTab);
  const [month, setMonth] = useState(todayStr().slice(0, 7));
  const asOf = month === todayStr().slice(0, 7) ? todayStr() : `${month}-28`;

  const roster = useMemo(() => leaveRoster(employees, records, asOf), [employees, records, asOf]);
  const days = useMemo(() => listLeaveDaysInMonth(month, employees, records), [month, employees, records]);
  const nameOf = (id: string) => employees.find((e) => e.id === id)?.name ?? id;

  return (
    <div className="space-y-4">
      <SectionTitle
        title="Leave Management"
        sub="Balances use existing accrual (1 paid leave / month from Leave-from + saved leaves). Mark leave on Attendance."
        right={
          <div className="admin-toolbar gap-2">
            <input
              type="month"
              className="field w-auto"
              aria-label="Leave month"
              value={month}
              onChange={(e) => e.target.value && setMonth(e.target.value)}
            />
            <button type="button" className="btn-ghost" onClick={() => requestTab("attendance", "leave")}>
              Open Attendance · Leave
            </button>
          </div>
        }
      />

      <section className="panel space-y-2" aria-label="Leave balances">
        <h3 className="text-sm font-extrabold tracking-wide uppercase text-muted-foreground">Balances</h3>
        <p className="text-sm text-muted-foreground">
          As of {prettyDate(asOf)} — paid leave remaining before marking more leave.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="py-2 pr-3 font-semibold">Employee</th>
                <th className="py-2 pr-3 font-semibold">Join month</th>
                <th className="py-2 pr-3 font-semibold">Saved</th>
                <th className="py-2 pr-3 font-semibold">Balance</th>
                <th className="py-2 pr-3 font-semibold">Paid this month</th>
                <th className="py-2 font-semibold">Unpaid this month</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((row) => (
                <tr key={row.employeeId} className="border-b border-border/60">
                  <td className="py-2 pr-3 font-medium">{row.name}</td>
                  <td className="py-2 pr-3">{row.joinMonth}</td>
                  <td className="py-2 pr-3">{row.openingLeave}</td>
                  <td className="py-2 pr-3 font-semibold">{row.balanceAsOf}</td>
                  <td className="py-2 pr-3">{row.paidThisMonth}</td>
                  <td className="py-2">{row.unpaidThisMonth}</td>
                </tr>
              ))}
              {!roster.length && (
                <tr>
                  <td colSpan={6} className="py-4 text-muted-foreground">
                    Add employees in Team first.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel space-y-2" aria-label="Leave days this month">
        <h3 className="text-sm font-extrabold tracking-wide uppercase text-muted-foreground">Leave days · {month}</h3>
        <ul className="space-y-1.5">
          {days.map((d) => (
            <li key={`${d.date}-${d.employeeId}`} className="flex flex-wrap items-baseline gap-2 text-sm">
              <span className="font-semibold">{prettyDate(d.date)}</span>
              <span>{nameOf(d.employeeId)}</span>
              <span className="chip bg-muted/70 text-muted-foreground">{d.paid ? "Paid" : "Unpaid"}</span>
              {d.note ? <span className="text-muted-foreground">— {d.note}</span> : null}
            </li>
          ))}
          {!days.length && <li className="text-sm text-muted-foreground">No leave marked this month.</li>}
        </ul>
      </section>

      <p className="text-xs text-muted-foreground">
        Spot-check: balance for first employee today ={" "}
        {employees[0] ? leaveBalance(employees[0], todayStr(), records) : "—"} (same formula as Attendance).
      </p>
    </div>
  );
}
