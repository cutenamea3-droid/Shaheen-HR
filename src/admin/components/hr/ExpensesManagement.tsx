import { useMemo, useState } from "react";
import { Plus, RotateCcw, Trash2 } from "lucide-react";
import { useApp } from "@/admin/lib/store";
import { SYNTHETIC_EMPLOYEES } from "@/admin/lib/employee-finance-mock";
import { expensesModeLabel, getExpensesMode } from "@/admin/lib/expenses-mode";
import { budgetUsage, employeeExpenseTotal, summarizeExpenses, templateToExpenseDraft } from "@/admin/lib/expenses-logic";
import {
  downloadText,
  expensesCsv,
  expensesPrintHtml,
  openPrintWindow,
  toExpenseExportRows,
} from "@/admin/lib/expenses-reports";
import { useExpensesStore, type ExpenseUpsertInput } from "@/admin/lib/expenses-store";
import {
  EXPENSE_SCOPE_LABEL,
  EXPENSE_STATUS_LABEL,
  type ExpenseScope,
  type ExpenseStatus,
} from "@/admin/lib/expenses-types";
import { formatPkr } from "@/admin/lib/salary-payments";
import { SectionTitle, todayStr } from "./common";

const emptyForm = (): ExpenseUpsertInput => ({
  title: "",
  categoryId: "office",
  amountPkr: 0,
  expenseDate: todayStr(),
  scope: "all",
  employeeIds: [],
  status: "draft",
  note: "",
  templateId: null,
  allowDuplicate: false,
});

export function ExpensesManagement() {
  const liveEmployees = useApp((s) => s.employees);
  const company = useApp((s) => s.settings.company);
  const categories = useExpensesStore((s) => s.categories);
  const expenses = useExpensesStore((s) => s.expenses);
  const templates = useExpensesStore((s) => s.templates);
  const budgets = useExpensesStore((s) => s.budgets);
  const upsertExpense = useExpensesStore((s) => s.upsertExpense);
  const softDeleteExpense = useExpensesStore((s) => s.softDeleteExpense);
  const restoreExpense = useExpensesStore((s) => s.restoreExpense);
  const setExpenseStatus = useExpensesStore((s) => s.setExpenseStatus);
  const addCategory = useExpensesStore((s) => s.addCategory);
  const upsertTemplate = useExpensesStore((s) => s.upsertTemplate);
  const removeTemplate = useExpensesStore((s) => s.removeTemplate);
  const upsertBudget = useExpensesStore((s) => s.upsertBudget);
  const auditFor = useExpensesStore((s) => s.auditFor);
  const mode = getExpensesMode();

  const [month, setMonth] = useState(() => todayStr().slice(0, 7));
  const [statusFilter, setStatusFilter] = useState<"all" | ExpenseStatus>("all");
  const [scopeFilter, setScopeFilter] = useState<"all" | ExpenseScope>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showDeleted, setShowDeleted] = useState(false);
  const [q, setQ] = useState("");
  const [form, setForm] = useState<ExpenseUpsertInput>(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(true);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [customCat, setCustomCat] = useState("");
  const [auditId, setAuditId] = useState<string | null>(null);
  const [finEmpId, setFinEmpId] = useState("");
  const [budgetLimit, setBudgetLimit] = useState("");
  const [budgetCat, setBudgetCat] = useState("office");
  const [empPick, setEmpPick] = useState<string[]>([]);

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of liveEmployees) m.set(e.id, e.name);
    for (const e of SYNTHETIC_EMPLOYEES) m.set(e.id, e.name);
    return m;
  }, [liveEmployees]);

  const roster = useMemo(
    () => [
      ...liveEmployees.map((e) => ({ id: e.id, name: e.name })),
      ...SYNTHETIC_EMPLOYEES.map((e) => ({ id: e.id, name: e.name })),
    ],
    [liveEmployees],
  );

  const activeCats = categories.filter((c) => !c.archived);

  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      if (showDeleted ? !e.deletedAt : !!e.deletedAt) return false;
      if (!e.expenseDate.startsWith(month)) return false;
      if (statusFilter !== "all" && e.status !== statusFilter) return false;
      if (scopeFilter !== "all" && e.scope !== scopeFilter) return false;
      if (categoryFilter !== "all" && e.categoryId !== categoryFilter) return false;
      if (q.trim()) {
        const hay = `${e.title} ${e.note} ${e.employeeIds.map((id) => nameById.get(id) ?? "").join(" ")}`.toLowerCase();
        if (!hay.includes(q.trim().toLowerCase())) return false;
      }
      return true;
    });
  }, [expenses, showDeleted, month, statusFilter, scopeFilter, categoryFilter, q, nameById]);

  const monthActive = expenses.filter((e) => !e.deletedAt && e.expenseDate.startsWith(month));
  const summary = summarizeExpenses(monthActive);
  const chartMax = Math.max(1, ...Object.values(summary.byCategory));

  const save = (andAnother: boolean) => {
    setErr("");
    setMsg("");
    const input: ExpenseUpsertInput = {
      ...form,
      amountPkr: Number(form.amountPkr),
      employeeIds: form.scope === "all" ? [] : empPick,
    };
    const res = upsertExpense(input, editId ? { id: editId } : undefined);
    if (!res.ok) {
      if (res.duplicateId && confirm(`${res.error}\n\nSave anyway?`)) {
        const forced = upsertExpense({ ...input, allowDuplicate: true }, editId ? { id: editId } : undefined);
        if (!forced.ok) {
          setErr(forced.error);
          return;
        }
      } else {
        setErr(res.error);
        return;
      }
    }
    setMsg(editId ? "Expense updated." : "Expense saved.");
    if (andAnother || !editId) {
      setEditId(null);
      setForm(emptyForm());
      setEmpPick([]);
      setFormOpen(true);
    } else {
      setEditId(null);
      setForm(emptyForm());
      setEmpPick([]);
    }
  };

  const startEdit = (id: string) => {
    const e = expenses.find((x) => x.id === id);
    if (!e || e.deletedAt) return;
    setEditId(e.id);
    setForm({
      title: e.title,
      categoryId: e.categoryId,
      amountPkr: e.amountPkr,
      expenseDate: e.expenseDate,
      scope: e.scope,
      employeeIds: e.employeeIds,
      status: e.status,
      note: e.note,
      templateId: e.templateId,
      allowDuplicate: false,
    });
    setEmpPick([...e.employeeIds]);
    setFormOpen(true);
    setErr("");
    setMsg("");
  };

  const applyTemplate = (templateId: string) => {
    const t = templates.find((x) => x.id === templateId);
    if (!t) return;
    const draft = templateToExpenseDraft(t, `${month}-01`);
    setForm({
      title: draft.title,
      categoryId: draft.categoryId,
      amountPkr: draft.amountPkr,
      expenseDate: draft.expenseDate,
      scope: draft.scope,
      employeeIds: draft.employeeIds,
      status: "draft",
      note: draft.note,
      templateId: draft.templateId,
      allowDuplicate: false,
    });
    setEmpPick([...draft.employeeIds]);
    setEditId(null);
    setFormOpen(true);
    setMsg(`Filled from template “${t.name}” — not auto-created. Review and Save.`);
  };

  const exportCsv = () => {
    const rows = toExpenseExportRows(filtered.filter((e) => !e.deletedAt), categories, nameById);
    downloadText(`Shaheen_Expenses_${month}.csv`, expensesCsv(rows), "text/csv;charset=utf-8");
  };

  const exportPdf = () => {
    const rows = toExpenseExportRows(filtered.filter((e) => !e.deletedAt), categories, nameById);
    const total = rows.reduce((s, r) => s + r.amountPkr, 0);
    openPrintWindow(
      expensesPrintHtml({
        company: company || "Shaheen HR",
        monthLabel: month,
        rows,
        totalPkr: total,
      }),
    );
  };

  const finTotal = finEmpId ? employeeExpenseTotal(expenses, finEmpId, month) : 0;
  const budgetInfo = budgetUsage(budgets, expenses, month, budgetCat);

  return (
    <div className="admin-expenses-full w-full max-w-none space-y-4">
      <SectionTitle
        title="Expenses Management"
        sub="Company and employee spend in whole PKR. Basic salary is not an expense. Totals are never auto-split across people."
        right={
          <div className="admin-toolbar gap-2">
            <button type="button" className="btn-ghost" onClick={exportCsv}>
              CSV
            </button>
            <button type="button" className="btn-ghost" onClick={exportPdf}>
              PDF
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setEditId(null);
                setForm(emptyForm());
                setEmpPick([]);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Quick Add
            </button>
          </div>
        }
      />

      <div className="rounded-lg border border-warn/40 bg-warn-soft px-3 py-2 text-sm text-warn" role="status">
        <strong>Mode:</strong> {expensesModeLabel(mode)}. Browser-local only until Admin expenses migration is applied and
        Attendance cloud sync (PR #19) is verified. Not stored in attendance <code>app_state</code>. No bank/IBAN in this
        module. Live cloud persistence is <strong>not</strong> claimed from this local store.
      </div>

      <p className="text-sm text-muted-foreground">
        Help: Use <em>Company / all</em> for a single company total (do not also enter the same amount per employee). Use{" "}
        <em>One</em> / <em>Multiple</em> to tag people without splitting the amount. Salary payments live under{" "}
        <strong>Salary pay</strong> — they are not expenses.
      </p>

      {/* Dashboard summaries */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="admin-emp-card">
          <div className="lbl">Expenses ({month})</div>
          <div className="font-display text-2xl font-extrabold">{summary.count}</div>
        </div>
        <div className="admin-emp-card">
          <div className="lbl">Total (once each)</div>
          <div className="font-display text-2xl font-extrabold">{formatPkr(summary.totalPkr)}</div>
        </div>
        <div className="admin-emp-card">
          <div className="lbl">Paid / Approved</div>
          <div className="font-display text-2xl font-extrabold">
            {(summary.byStatus.paid ?? 0) + (summary.byStatus.approved ?? 0)}
          </div>
        </div>
        <div className="admin-emp-card">
          <div className="lbl">Draft / Submitted</div>
          <div className="font-display text-2xl font-extrabold">
            {(summary.byStatus.draft ?? 0) + (summary.byStatus.submitted ?? 0)}
          </div>
        </div>
      </div>

      {/* Optional category chart */}
      <div className="admin-emp-card space-y-2">
        <div className="font-bold">Category spend ({month})</div>
        {Object.keys(summary.byCategory).length === 0 ? (
          <p className="text-sm text-muted-foreground">No expenses this month yet.</p>
        ) : (
          <div className="space-y-1.5">
            {Object.entries(summary.byCategory)
              .sort((a, b) => b[1] - a[1])
              .map(([catId, amt]) => {
                const name = activeCats.find((c) => c.id === catId)?.name ?? catId;
                const pct = Math.round((amt / chartMax) * 100);
                return (
                  <div key={catId} className="grid grid-cols-[8rem_1fr_6rem] items-center gap-2 text-sm">
                    <span className="truncate font-medium">{name}</span>
                    <div className="h-2 overflow-hidden rounded bg-muted">
                      <div className="h-full bg-primary/70" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-right tabular-nums">{formatPkr(amt)}</span>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="admin-toolbar flex-wrap gap-2">
        <label>
          <span className="sr-only">Month</span>
          <input type="month" className="field w-40" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
        </label>
        <input className="field w-48" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="field w-36" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "all" | ExpenseStatus)}>
          <option value="all">All statuses</option>
          {(Object.keys(EXPENSE_STATUS_LABEL) as ExpenseStatus[]).map((s) => (
            <option key={s} value={s}>
              {EXPENSE_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <select className="field w-40" value={scopeFilter} onChange={(e) => setScopeFilter(e.target.value as "all" | ExpenseScope)}>
          <option value="all">All scopes</option>
          {(Object.keys(EXPENSE_SCOPE_LABEL) as ExpenseScope[]).map((s) => (
            <option key={s} value={s}>
              {EXPENSE_SCOPE_LABEL[s]}
            </option>
          ))}
        </select>
        <select className="field w-40" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="all">All categories</option>
          {activeCats.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button type="button" className={showDeleted ? "btn-primary" : "btn-ghost"} onClick={() => setShowDeleted((v) => !v)}>
          {showDeleted ? "Showing deleted" : "Show deleted"}
        </button>
      </div>

      {/* Add / Edit form */}
      {formOpen && (
        <form
          className="admin-emp-card grid gap-3 md:grid-cols-2 lg:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            save(false);
          }}
        >
          <div className="md:col-span-2 lg:col-span-3">
            <h3 className="font-display text-lg font-extrabold">{editId ? "Edit expense" : "Add expense"}</h3>
          </div>
          <label>
            <span className="lbl">Title</span>
            <input className="field" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required />
          </label>
          <label>
            <span className="lbl">Category</span>
            <select className="field" value={form.categoryId} onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}>
              {activeCats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.custom ? " (custom)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="lbl">Amount (PKR whole)</span>
            <input
              type="number"
              min={1}
              step={1}
              className="field"
              value={form.amountPkr || ""}
              onChange={(e) => setForm((f) => ({ ...f, amountPkr: Number(e.target.value) }))}
              required
            />
          </label>
          <label>
            <span className="lbl">Date</span>
            <input
              type="date"
              className="field"
              value={form.expenseDate}
              onChange={(e) => e.target.value && setForm((f) => ({ ...f, expenseDate: e.target.value }))}
              required
            />
          </label>
          <label>
            <span className="lbl">Scope</span>
            <select
              className="field"
              value={form.scope}
              onChange={(e) => {
                const scope = e.target.value as ExpenseScope;
                setForm((f) => ({ ...f, scope }));
                if (scope === "all") setEmpPick([]);
              }}
            >
              {(Object.keys(EXPENSE_SCOPE_LABEL) as ExpenseScope[]).map((s) => (
                <option key={s} value={s}>
                  {EXPENSE_SCOPE_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="lbl">Status</span>
            <select
              className="field"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ExpenseStatus }))}
            >
              {(Object.keys(EXPENSE_STATUS_LABEL) as ExpenseStatus[]).map((s) => (
                <option key={s} value={s}>
                  {EXPENSE_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          {form.scope !== "all" && (
            <div className="md:col-span-2 lg:col-span-3">
              <span className="lbl">Employees ({form.scope === "one" ? "pick one" : "pick two or more"})</span>
              <div className="mt-1 flex max-h-36 flex-wrap gap-2 overflow-y-auto rounded-md border border-border p-2">
                {roster.map((e) => {
                  const on = empPick.includes(e.id);
                  return (
                    <button
                      key={e.id}
                      type="button"
                      className={on ? "chip bg-primary/15 text-primary" : "chip bg-muted text-muted-foreground"}
                      onClick={() => {
                        if (form.scope === "one") setEmpPick([e.id]);
                        else setEmpPick((prev) => (on ? prev.filter((x) => x !== e.id) : [...prev, e.id]));
                      }}
                    >
                      {e.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <label className="md:col-span-2 lg:col-span-3">
            <span className="lbl">Note</span>
            <input className="field" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
          </label>
          {err && (
            <p className="md:col-span-2 lg:col-span-3 text-sm text-destructive" role="alert">
              {err}
            </p>
          )}
          {msg && (
            <p className="md:col-span-2 lg:col-span-3 text-sm text-muted-foreground" role="status">
              {msg}
            </p>
          )}
          <div className="admin-toolbar md:col-span-2 lg:col-span-3 gap-2">
            <button type="submit" className="btn-primary">
              Save
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                save(true);
              }}
            >
              Save &amp; Add Another
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setFormOpen(false);
                setEditId(null);
                setForm(emptyForm());
                setEmpPick([]);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Table */}
      <div className="panel overflow-x-auto p-0">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="p-3">Title</th>
              <th className="p-3">Category</th>
              <th className="p-3">Amount</th>
              <th className="p-3">Date</th>
              <th className="p-3">Scope</th>
              <th className="p-3">Status</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr key={e.id} className={`border-t border-border ${e.deletedAt ? "opacity-60" : ""}`}>
                <td className="p-3 font-semibold">
                  {e.title}
                  <div className="text-xs font-normal text-muted-foreground">
                    {e.scope === "all"
                      ? "Company total (not split)"
                      : e.employeeIds.map((id) => nameById.get(id) ?? id).join(", ")}
                  </div>
                </td>
                <td className="p-3">{activeCats.find((c) => c.id === e.categoryId)?.name ?? e.categoryId}</td>
                <td className="p-3 tabular-nums">{formatPkr(e.amountPkr)}</td>
                <td className="p-3">{e.expenseDate}</td>
                <td className="p-3">{EXPENSE_SCOPE_LABEL[e.scope]}</td>
                <td className="p-3">
                  {e.deletedAt ? (
                    <span className="chip bg-muted">Deleted</span>
                  ) : (
                    <select
                      className="field h-8 w-32"
                      value={e.status}
                      onChange={(ev) => setExpenseStatus(e.id, ev.target.value as ExpenseStatus)}
                    >
                      {(Object.keys(EXPENSE_STATUS_LABEL) as ExpenseStatus[]).map((s) => (
                        <option key={s} value={s}>
                          {EXPENSE_STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="p-3">
                  <div className="admin-toolbar justify-end gap-1">
                    {!e.deletedAt && (
                      <>
                        <button type="button" className="btn-ghost h-8 px-2" onClick={() => startEdit(e.id)}>
                          Edit
                        </button>
                        <button type="button" className="btn-ghost h-8 px-2" onClick={() => setAuditId(e.id)}>
                          History
                        </button>
                        <button
                          type="button"
                          className="btn-danger h-8 px-2"
                          title="Soft delete"
                          onClick={() => softDeleteExpense(e.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    {e.deletedAt && (
                      <button type="button" className="btn-primary h-8 px-2" onClick={() => restoreExpense(e.id)}>
                        <RotateCcw className="h-4 w-4" /> Restore
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground">
                  No expenses match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Categories */}
        <div className="admin-emp-card space-y-2">
          <h3 className="font-bold">Categories</h3>
          <ul className="text-sm">
            {activeCats.map((c) => (
              <li key={c.id} className="border-b border-border/50 py-1">
                {c.name}
                {c.custom ? " · custom" : ""}
              </li>
            ))}
          </ul>
          <form
            className="admin-toolbar gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const r = addCategory(customCat);
              if (!r.ok) setErr(r.error ?? "Failed");
              else {
                setCustomCat("");
                setMsg(`Category “${customCat}” added.`);
              }
            }}
          >
            <input className="field" placeholder="Custom category" value={customCat} onChange={(e) => setCustomCat(e.target.value)} />
            <button type="submit" className="btn-ghost">
              Add
            </button>
          </form>
        </div>

        {/* Templates */}
        <div className="admin-emp-card space-y-2">
          <h3 className="font-bold">Recurring templates</h3>
          <p className="text-xs text-muted-foreground">Templates never auto-create expenses. Use “Fill” then Save.</p>
          {templates.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-2 border-b border-border/50 py-2 text-sm">
              <div>
                <div className="font-semibold">{t.name}</div>
                <div className="text-xs text-muted-foreground">
                  {formatPkr(t.amountPkr)} · {t.cadence} · {EXPENSE_SCOPE_LABEL[t.scope]}
                </div>
              </div>
              <div className="admin-toolbar gap-1">
                <button type="button" className="btn-primary h-8 px-2" onClick={() => applyTemplate(t.id)}>
                  Fill
                </button>
                <button type="button" className="btn-ghost h-8 px-2" onClick={() => removeTemplate(t.id)}>
                  ✕
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              const r = upsertTemplate({
                name: form.title || "New template",
                title: form.title || "Expense",
                categoryId: form.categoryId,
                amountPkr: Number(form.amountPkr) || 1000,
                scope: form.scope,
                employeeIds: form.scope === "all" ? [] : empPick,
                note: form.note,
                cadence: "monthly",
                active: true,
              });
              setMsg(r.ok ? "Template saved from form (manual use only)." : r.error ?? "Failed");
            }}
          >
            Save form as template
          </button>
        </div>

        {/* Budgets + employee financial summary */}
        <div className="admin-emp-card space-y-3">
          <h3 className="font-bold">Optional budget ({month})</h3>
          <div className="admin-toolbar gap-2">
            <select className="field" value={budgetCat} onChange={(e) => setBudgetCat(e.target.value)}>
              {activeCats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={0}
              step={1}
              className="field w-28"
              placeholder="Limit PKR"
              value={budgetLimit}
              onChange={(e) => setBudgetLimit(e.target.value)}
            />
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                const r = upsertBudget({ month, categoryId: budgetCat, limitPkr: Number(budgetLimit), note: "" });
                setMsg(r.ok ? "Budget saved." : r.error ?? "Failed");
              }}
            >
              Set
            </button>
          </div>
          <p className="text-sm">
            Spent {formatPkr(budgetInfo.spentPkr)}
            {budgetInfo.limitPkr != null ? ` / ${formatPkr(budgetInfo.limitPkr)}` : " (no limit)"}
            {budgetInfo.over ? <span className="ml-2 font-bold text-destructive">Over budget</span> : null}
          </p>

          <h3 className="font-bold">Employee expense summary</h3>
          <p className="text-xs text-muted-foreground">
            Personal totals exclude company-wide (All) expenses so aggregates are never double-counted.
          </p>
          <select className="field" value={finEmpId} onChange={(e) => setFinEmpId(e.target.value)}>
            <option value="">Select employee…</option>
            {roster.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          {finEmpId && (
            <p className="text-sm font-semibold">
              {nameById.get(finEmpId)} · {month}: {formatPkr(finTotal)}
            </p>
          )}
        </div>
      </div>

      {auditId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="admin-emp-card max-h-[80vh] w-full max-w-lg space-y-3 overflow-y-auto bg-background shadow-lg">
            <h3 className="font-display text-lg font-extrabold">Audit history</h3>
            <ul className="space-y-2 text-sm">
              {auditFor(auditId).map((a) => (
                <li key={a.id} className="border-b border-border/50 pb-2">
                  <div className="font-semibold">{a.action}</div>
                  <div className="text-muted-foreground">{a.detail}</div>
                  <div className="text-xs text-muted-foreground">{new Date(a.at).toLocaleString()}</div>
                </li>
              ))}
              {auditFor(auditId).length === 0 && <li className="text-muted-foreground">No events yet.</li>}
            </ul>
            <button type="button" className="btn-ghost" onClick={() => setAuditId(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
