import { formatPkr } from "./salary-payments";
import type { ExpenseCategory, ExpenseRecord, ExpenseStatus } from "./expenses-types";
import { EXPENSE_SCOPE_LABEL, EXPENSE_STATUS_LABEL } from "./expenses-types";

export type ExpenseExportRow = {
  title: string;
  category: string;
  amountPkr: number;
  expenseDate: string;
  scope: string;
  employees: string;
  status: string;
  note: string;
};

/** CSV — never includes bank/IBAN fields. */
export function expensesCsv(rows: ExpenseExportRow[]): string {
  const esc = (s: string | number) => `"${String(s).replace(/"/g, '""')}"`;
  const head = ["Title", "Category", "Amount (PKR)", "Date", "Scope", "Employees", "Status", "Note"];
  const lines = [
    head.map(esc).join(","),
    ...rows.map((r) =>
      [r.title, r.category, r.amountPkr, r.expenseDate, r.scope, r.employees, r.status, r.note].map(esc).join(","),
    ),
  ];
  return "\ufeff" + lines.join("\n");
}

export function toExpenseExportRows(
  expenses: ExpenseRecord[],
  categories: ExpenseCategory[],
  nameById: Map<string, string>,
): ExpenseExportRow[] {
  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? id;
  return expenses
    .filter((e) => !e.deletedAt)
    .map((e) => ({
      title: e.title,
      category: catName(e.categoryId),
      amountPkr: e.amountPkr,
      expenseDate: e.expenseDate,
      scope: EXPENSE_SCOPE_LABEL[e.scope],
      employees:
        e.scope === "all"
          ? "(company total — not split)"
          : e.employeeIds.map((id) => nameById.get(id) ?? id).join("; "),
      status: EXPENSE_STATUS_LABEL[e.status as ExpenseStatus],
      note: e.note,
    }));
}

/** Simple printable HTML for browser PDF — no bank numbers. */
export function expensesPrintHtml(opts: {
  company: string;
  monthLabel: string;
  rows: ExpenseExportRow[];
  totalPkr: number;
}): string {
  const body = opts.rows
    .map(
      (r) =>
        `<tr><td>${escapeHtml(r.title)}</td><td>${escapeHtml(r.category)}</td><td class="num">${r.amountPkr.toLocaleString("en-PK")}</td><td>${escapeHtml(r.expenseDate)}</td><td>${escapeHtml(r.scope)}</td><td>${escapeHtml(r.employees)}</td><td>${escapeHtml(r.status)}</td></tr>`,
    )
    .join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Expenses — ${escapeHtml(opts.monthLabel)}</title>
<style>
  body{font-family:system-ui,sans-serif;padding:24px;color:#111}
  h1{font-size:20px;margin:0 0 4px} p{margin:0 0 16px;color:#444;font-size:13px}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}
  th{background:#f3f3f3} .num{text-align:right;font-variant-numeric:tabular-nums}
  .total{margin-top:12px;font-weight:700}
</style></head><body>
<h1>${escapeHtml(opts.company)} — Expenses</h1>
<p>${escapeHtml(opts.monthLabel)} · Bank account numbers are never included in this report.</p>
<table><thead><tr><th>Title</th><th>Category</th><th>Amount (PKR)</th><th>Date</th><th>Scope</th><th>Employees</th><th>Status</th></tr></thead>
<tbody>${body}</tbody></table>
<p class="total">Total (counted once per expense): ${formatPkr(opts.totalPkr)}</p>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function openPrintWindow(html: string) {
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
  return true;
}
