import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/admin/lib/store";
import { calcDay, fmtHours, monthDays, prettyDate } from "@/admin/lib/calc";
import {
  COMPENSATION_KIND_LABEL,
  collectOtCandidates,
  otApprovalId,
  useOtApprovalStore,
  type OtApprovalKind,
  type OtApprovalStatus,
} from "@/admin/lib/ot-approval";
import { SectionTitle, todayStr } from "./common";

type Row = { d: string; kind: OtApprovalKind; min: number; note: string; status: OtApprovalStatus; id: string };

export function Overtime() {
  const [month, setMonth] = useState(todayStr().slice(0, 7));
  const [dept, setDept] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | OtApprovalStatus>("all");
  const { employees, depts, records, settings } = useApp();
  const rowsMap = useOtApprovalStore((s) => s.rows);
  const ensureCandidate = useOtApprovalStore((s) => s.ensureCandidate);
  const setStatus = useOtApprovalStore((s) => s.setStatus);

  const candidates = useMemo(() => {
    const input: Parameters<typeof collectOtCandidates>[0] = {
      employees,
      depts,
      records,
      settings,
      month,
    };
    if (dept) input.deptId = dept;
    return collectOtCandidates(input);
  }, [employees, depts, records, settings, month, dept]);

  useEffect(() => {
    for (const c of candidates) ensureCandidate(c);
  }, [candidates, ensureCandidate]);

  const list = employees
    .map((e, i) => {
      const rows: Row[] = [];
      monthDays(month).forEach((d) => {
        const r = records[d]?.[e.id];
        if (!r) return;
        const c = calcDay(e, depts.find((x) => x.id === e.deptId), d, r, settings);
        if (c.overtimeMin > 0) {
          const id = otApprovalId(e.id, d, "overtime");
          const ap = rowsMap[id];
          rows.push({
            d,
            kind: "overtime",
            min: c.overtimeMin,
            note: r.note ?? "",
            status: ap?.status ?? "pending",
            id,
          });
        }
        if (c.extraDay) {
          const id = otApprovalId(e.id, d, "additional_day");
          const ap = rowsMap[id];
          rows.push({
            d,
            kind: "additional_day",
            min: c.extraDayMin,
            note: r.note ?? "",
            status: ap?.status ?? "pending",
            id,
          });
        }
      });
      const filtered =
        statusFilter === "all" ? rows : rows.filter((x) => x.status === statusFilter);
      const ot = rows.filter((x) => x.kind === "overtime").reduce((a, x) => a + x.min, 0);
      const ex = rows.filter((x) => x.kind === "additional_day");
      const approvedOt = rows.filter((x) => x.kind === "overtime" && x.status === "approved").reduce((a, x) => a + x.min, 0);
      const approvedEx = rows.filter((x) => x.kind === "additional_day" && x.status === "approved");
      return {
        e,
        n: i + 1,
        rows: filtered,
        allRows: rows,
        ot,
        exDays: ex.length,
        exMin: ex.reduce((a, x) => a + x.min, 0),
        approvedOt,
        approvedExDays: approvedEx.length,
        approvedExMin: approvedEx.reduce((a, x) => a + x.min, 0),
      };
    })
    .filter((x) => (!dept || x.e.deptId === dept) && x.allRows.length);

  const tot = list.reduce(
    (a, x) => ({
      ot: a.ot + x.ot,
      d: a.d + x.exDays,
      m: a.m + x.exMin,
      aOt: a.aOt + x.approvedOt,
      aD: a.aD + x.approvedExDays,
    }),
    { ot: 0, d: 0, m: 0, aOt: 0, aD: 0 },
  );

  return (
    <div>
      <SectionTitle
        title="Overtime & Additional Days Approval"
        sub={
          settings.overpay
            ? "Mark in Attendance → approve here for pay. Bonus is a separate line (never OT / Additional day)."
            : "Over pay is turned off in Settings — marking/approval UI still lists attendance marks"
        }
        right={
          <div className="flex flex-wrap gap-2">
            <select className="field w-auto" value={dept} onChange={(e) => setDept(e.target.value)} aria-label="Department">
              <option value="">All departments</option>
              {depts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <input
              type="month"
              className="field w-auto"
              value={month}
              onChange={(e) => e.target.value && setMonth(e.target.value)}
              aria-label="Month"
            />
          </div>
        }
      />

      <div className="mb-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm" role="note">
        <strong>Bonus ≠ OT ≠ Additional Days.</strong> Approvals are session finance memory (not{" "}
        <code>app_state</code>). Hours still come from Attendance <code>calcDay</code> — this page does not change
        payroll hours CSV.
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        {(
          [
            ["Employees", list.length],
            ["OT hours", fmtHours(tot.ot)],
            ["Additional days", tot.d],
            ["Approved OT h", fmtHours(tot.aOt)],
            ["Approved addl days", tot.aD],
          ] as const
        ).map(([k, v]) => (
          <div key={k} className="admin-stat">
            <p className="admin-stat-label">{k}</p>
            <p className="admin-stat-value">{v}</p>
          </div>
        ))}
      </div>

      <div className="admin-toolbar mb-3 flex-wrap gap-2">
        {(["all", "pending", "approved", "rejected"] as const).map((f) => (
          <button
            key={f}
            type="button"
            className={statusFilter === f ? "btn-primary" : "btn-ghost"}
            onClick={() => setStatusFilter(f)}
          >
            {f === "all" ? "All" : f[0]!.toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {list.length === 0 && (
        <div className="panel text-sm text-muted-foreground">No overtime or additional days this month.</div>
      )}
      <div className="space-y-3">
        {list.map((x) => (
          <div key={x.e.id} className="admin-emp-card">
            <div className="admin-emp-head">
              <h3 className="font-bold tracking-tight">
                {x.n}. {x.e.name}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  · {depts.find((d) => d.id === x.e.deptId)?.name} · {x.e.afterHours ? "After-hours" : "Normal"}
                </span>
              </h3>
              <p className="text-sm">
                OT <b>{fmtHours(x.ot)} h</b> (approved {fmtHours(x.approvedOt)}) · Additional{" "}
                <b>
                  {x.exDays} day(s) / {fmtHours(x.exMin)} h
                </b>{" "}
                (approved {x.approvedExDays})
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="admin-table">
                <thead className="admin-thead-sticky">
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Type</th>
                    <th scope="col">Hours</th>
                    <th scope="col">Approval</th>
                    <th scope="col">Actions</th>
                    <th scope="col">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {x.rows.map((r) => (
                    <tr key={r.id}>
                      <td>{prettyDate(r.d)}</td>
                      <td>{COMPENSATION_KIND_LABEL[r.kind]}</td>
                      <td>{fmtHours(r.min)}</td>
                      <td>
                        <span
                          className={
                            r.status === "approved"
                              ? "font-semibold text-primary"
                              : r.status === "rejected"
                                ? "font-semibold text-destructive"
                                : "text-muted-foreground"
                          }
                        >
                          {r.status}
                        </span>
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          <button
                            type="button"
                            className="btn-ghost text-xs"
                            disabled={r.status === "approved"}
                            onClick={() => setStatus(r.id, "approved")}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="btn-ghost text-xs"
                            disabled={r.status === "rejected"}
                            onClick={() => setStatus(r.id, "rejected")}
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            className="btn-ghost text-xs"
                            disabled={r.status === "pending"}
                            onClick={() =>
                              useOtApprovalStore.setState((s) => ({
                                rows: {
                                  ...s.rows,
                                  [r.id]: { ...s.rows[r.id]!, status: "pending", decidedAt: null },
                                },
                              }))
                            }
                          >
                            Reset
                          </button>
                        </div>
                      </td>
                      <td className="whitespace-pre-wrap">{r.note || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
