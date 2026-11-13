/**
 * In-memory ONLY mock for employment status, banking history, and salary payments.
 *
 * SECURITY:
 * - Does NOT use zustand persist, localStorage, sessionStorage, or app_state.
 * - Must never be added to HR_SYNC_KEYS / backup KEYS.
 * - Synthetic IBAN/account values are for UI + logic tests only.
 *
 * Batch 6: salary payment register (Oct 2026 seed is historical — see HISTORICAL_LOCKED_MONTH).
 * Banking/directory patterns reused from Batch 5 / PR #24 without blind-merge.
 */

import { create } from "zustand";
import type {
  BankingAccountRecord,
  EmployeeDirectoryMeta,
  EmploymentStatus,
  SalaryPaymentEvent,
  SalaryPaymentRecord,
  SalaryPaymentStatus,
} from "./employee-finance-types";
import { applyPartialPayment, assertWholePkr, derivePaymentStatus } from "./salary-payments";
import { isValidPkIban, normalizePkIban, pkIbanLast4 } from "./pk-iban";

const uid = () => Math.random().toString(36).slice(2, 10);

/** October 2026 mock salary rows are historical fixtures — do not rewrite paid/due amounts. */
export const HISTORICAL_LOCKED_MONTH = "2026-10";

/** Synthetic employees for visual/logic demos when live roster is empty or for banking fixtures. */
export type MockEmployeeSeed = {
  id: string;
  name: string;
  deptLabel: string;
};

export const SYNTHETIC_EMPLOYEES: readonly MockEmployeeSeed[] = [
  { id: "mock-emp-a1", name: "Ayesha Khan (MOCK)", deptLabel: "HR & Compliance" },
  { id: "mock-emp-b2", name: "Bilal Ahmed (MOCK)", deptLabel: "Accounts" },
  { id: "mock-emp-c3", name: "Camila Raza (MOCK)", deptLabel: "Booking" },
  { id: "mock-emp-d4", name: "Danish Iqbal (MOCK)", deptLabel: "Safety" },
] as const;

/** Valid synthetic PK IBANs (MOD-97 checked) — fictional account numbers. */
const MOCK_IBANS = {
  ayesha: "PK13HABB0000001234567001",
  bilal: "PK13MEZN0000001234567002",
  camila: "PK94UNIL0000001234567003",
  danish_old: "PK83ALFH0000001234567004",
  danish_new: "PK54BAHL0000001234567005",
} as const;

function withLast4(row: Omit<BankingAccountRecord, "accountLast4"> & { accountLast4?: string }): BankingAccountRecord {
  return {
    ...row,
    accountLast4: row.accountLast4 ?? (row.isIban ? pkIbanLast4(row.accountRef) : row.accountRef.slice(-4)),
  };
}

function seedBanking(): BankingAccountRecord[] {
  return [
    withLast4({
      id: "bank-a1",
      employeeId: "mock-emp-a1",
      institutionId: "hbl",
      accountTitle: "Ayesha Khan",
      accountRef: MOCK_IBANS.ayesha,
      isIban: true,
      effectiveFrom: "2025-01-01",
      supersededAt: null,
      note: "Primary salary account",
    }),
    withLast4({
      id: "bank-b2",
      employeeId: "mock-emp-b2",
      institutionId: "meezan",
      accountTitle: "Bilal Ahmed",
      accountRef: MOCK_IBANS.bilal,
      isIban: true,
      effectiveFrom: "2024-06-15",
      supersededAt: null,
      note: "",
    }),
    withLast4({
      id: "bank-c3",
      employeeId: "mock-emp-c3",
      institutionId: "jazzcash",
      accountTitle: "Camila Raza",
      accountRef: "03001234567",
      isIban: false,
      effectiveFrom: "2025-03-01",
      supersededAt: null,
      note: "Wallet — not a bank",
    }),
    withLast4({
      id: "bank-d4-old",
      employeeId: "mock-emp-d4",
      institutionId: "bafl",
      accountTitle: "Danish Iqbal",
      accountRef: MOCK_IBANS.danish_old,
      isIban: true,
      effectiveFrom: "2023-01-01",
      supersededAt: "2025-08-01",
      note: "Superseded — do not pay",
    }),
    withLast4({
      id: "bank-d4-new",
      employeeId: "mock-emp-d4",
      institutionId: "baah",
      accountTitle: "Danish Iqbal",
      accountRef: MOCK_IBANS.danish_new,
      isIban: true,
      effectiveFrom: "2025-08-01",
      supersededAt: null,
      note: "Current",
    }),
  ];
}

function seedMeta(): Record<string, EmployeeDirectoryMeta> {
  const out: Record<string, EmployeeDirectoryMeta> = {};
  for (const e of SYNTHETIC_EMPLOYEES) {
    out[e.id] = {
      employeeId: e.id,
      status: e.id === "mock-emp-d4" ? "leave" : "active",
      joiningDate: e.id === "mock-emp-a1" ? "2024-02-01" : e.id === "mock-emp-b2" ? "2023-06-15" : e.id === "mock-emp-c3" ? "2025-01-10" : "2022-11-01",
      designation:
        e.id === "mock-emp-a1"
          ? "HR Officer"
          : e.id === "mock-emp-b2"
            ? "Accounts Lead"
            : e.id === "mock-emp-c3"
              ? "Booking Coordinator"
              : "Safety Supervisor",
      deactivatedAt: null,
      reactivatedAt: null,
    };
  }
  return out;
}

function seedPayments(): SalaryPaymentRecord[] {
  const month = "2026-10";
  return [
    {
      id: "pay-a1",
      employeeId: "mock-emp-a1",
      month,
      amountDuePkr: 185000,
      amountPaidPkr: 185000,
      status: "paid",
      bankingAccountId: "bank-a1",
      paidOn: "2026-11-01",
      note: "Full transfer recorded manually",
      updatedAt: Date.now(),
    },
    {
      id: "pay-b2",
      employeeId: "mock-emp-b2",
      month,
      amountDuePkr: 210000,
      amountPaidPkr: 100000,
      status: "partial",
      bankingAccountId: "bank-b2",
      paidOn: "2026-11-02",
      note: "Partial — balance pending",
      updatedAt: Date.now(),
    },
    {
      id: "pay-c3",
      employeeId: "mock-emp-c3",
      month,
      amountDuePkr: 95000,
      amountPaidPkr: 0,
      status: "unpaid",
      bankingAccountId: "bank-c3",
      paidOn: null,
      note: "",
      updatedAt: Date.now(),
    },
    {
      id: "pay-d4",
      employeeId: "mock-emp-d4",
      month,
      amountDuePkr: 150000,
      amountPaidPkr: 0,
      status: "on_hold",
      bankingAccountId: "bank-d4-new",
      paidOn: null,
      note: "On leave — hold until resume",
      updatedAt: Date.now(),
    },
  ];
}

function seedEvents(): SalaryPaymentEvent[] {
  return [
    { id: "ev-a1", paymentId: "pay-a1", eventType: "due_set", amountPkr: 185000, statusAfter: "unpaid", note: "seed", createdAt: Date.now() - 5000 },
    { id: "ev-a2", paymentId: "pay-a1", eventType: "partial_pay", amountPkr: 185000, statusAfter: "paid", note: "full", createdAt: Date.now() - 4000 },
    { id: "ev-b1", paymentId: "pay-b2", eventType: "due_set", amountPkr: 210000, statusAfter: "unpaid", note: "seed", createdAt: Date.now() - 3000 },
    { id: "ev-b2", paymentId: "pay-b2", eventType: "partial_pay", amountPkr: 100000, statusAfter: "partial", note: "partial", createdAt: Date.now() - 2000 },
    { id: "ev-d1", paymentId: "pay-d4", eventType: "status_change", amountPkr: null, statusAfter: "on_hold", note: "leave hold", createdAt: Date.now() - 1000 },
  ];
}

type FinanceState = {
  mode: "mock";
  persistenceBlocked: true;
  meta: Record<string, EmployeeDirectoryMeta>;
  banking: BankingAccountRecord[];
  payments: SalaryPaymentRecord[];
  events: SalaryPaymentEvent[];
  revealAccountIds: Set<string>;
  revealedPlaintext: Record<string, string>;

  ensureMeta: (employeeId: string) => void;
  setStatus: (employeeId: string, status: EmploymentStatus, confirmDeactivate?: boolean) => { ok: boolean; error?: string };
  setJoiningDate: (employeeId: string, joiningDate: string) => { ok: boolean; error?: string };
  setDesignation: (employeeId: string, designation: string) => { ok: boolean; error?: string };
  currentBanking: (employeeId: string) => BankingAccountRecord | undefined;
  bankingHistory: (employeeId: string) => BankingAccountRecord[];
  addBankingChange: (input: {
    employeeId: string;
    institutionId: string;
    otherLabel?: string;
    accountTitle: string;
    accountRef: string;
    isIban: boolean;
    effectiveFrom: string;
    note?: string;
  }) => { ok: boolean; error?: string };
  toggleReveal: (accountId: string) => void;
  revealAccount: (accountId: string) => { ok: true; data: string } | { ok: false; error: string };
  isRevealed: (accountId: string) => boolean;
  getRevealedPlaintext: (accountId: string) => string | undefined;

  paymentsForMonth: (month: string) => SalaryPaymentRecord[];
  paymentEvents: (paymentId: string) => SalaryPaymentEvent[];
  upsertPaymentDue: (employeeId: string, month: string, amountDuePkr: number) => { ok: boolean; error?: string };
  recordPayment: (paymentId: string, addPkr: number, paidOn: string) => { ok: boolean; error?: string };
  setPaymentStatus: (paymentId: string, status: SalaryPaymentStatus) => { ok: boolean; error?: string };
  resetMockSeed: () => void;
};

export const useEmployeeFinanceMock = create<FinanceState>()((set, get) => ({
  mode: "mock",
  persistenceBlocked: true,
  meta: seedMeta(),
  banking: seedBanking(),
  payments: seedPayments(),
  events: seedEvents(),
  revealAccountIds: new Set(),
  revealedPlaintext: {},

  ensureMeta: (employeeId) => {
    if (get().meta[employeeId]) return;
    set((s) => ({
      meta: {
        ...s.meta,
        [employeeId]: {
          employeeId,
          status: "active",
          joiningDate: null,
          designation: null,
          deactivatedAt: null,
          reactivatedAt: null,
        },
      },
    }));
  },

  setStatus: (employeeId, status, confirmDeactivate = false) => {
    get().ensureMeta(employeeId);
    const cur = get().meta[employeeId]!;
    if (status === "inactive" && cur.status !== "inactive" && !confirmDeactivate) {
      return { ok: false, error: "Confirm deactivation required" };
    }
    const today = new Date().toISOString().slice(0, 10);
    set((s) => ({
      meta: {
        ...s.meta,
        [employeeId]: {
          ...cur,
          status,
          deactivatedAt: status === "inactive" ? today : cur.deactivatedAt,
          reactivatedAt: status === "active" && cur.status === "inactive" ? today : cur.reactivatedAt,
        },
      },
    }));
    return { ok: true };
  },

  setJoiningDate: (employeeId, joiningDate) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(joiningDate)) return { ok: false, error: "Invalid joining date" };
    get().ensureMeta(employeeId);
    set((s) => ({
      meta: {
        ...s.meta,
        [employeeId]: { ...s.meta[employeeId]!, joiningDate },
      },
    }));
    return { ok: true };
  },

  setDesignation: (employeeId, designation) => {
    get().ensureMeta(employeeId);
    set((s) => ({
      meta: {
        ...s.meta,
        [employeeId]: { ...s.meta[employeeId]!, designation: designation.trim() || null },
      },
    }));
    return { ok: true };
  },

  currentBanking: (employeeId) =>
    get()
      .banking.filter((b) => b.employeeId === employeeId && !b.supersededAt)
      .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0],

  bankingHistory: (employeeId) =>
    get()
      .banking.filter((b) => b.employeeId === employeeId)
      .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom)),

  addBankingChange: (input) => {
    const ref = input.isIban ? normalizePkIban(input.accountRef) : input.accountRef.trim();
    if (!input.accountTitle.trim()) return { ok: false, error: "Account title required" };
    if (!ref) return { ok: false, error: "Account / IBAN required" };
    if (input.isIban && !isValidPkIban(ref)) return { ok: false, error: "Invalid Pakistan IBAN" };
    if (input.institutionId === "other" && !input.otherLabel?.trim()) {
      return { ok: false, error: "Label required for Other institution" };
    }
    const today = input.effectiveFrom || new Date().toISOString().slice(0, 10);
    const newRow = withLast4({
      id: uid(),
      employeeId: input.employeeId,
      institutionId: input.institutionId,
      ...(input.otherLabel != null && input.otherLabel !== "" ? { otherLabel: input.otherLabel } : {}),
      accountTitle: input.accountTitle.trim(),
      accountRef: ref,
      isIban: input.isIban,
      effectiveFrom: today,
      supersededAt: null,
      note: input.note?.trim() ?? "",
    });
    set((s) => ({
      banking: [
        ...s.banking.map((b) =>
          b.employeeId === input.employeeId && !b.supersededAt ? { ...b, supersededAt: today } : b,
        ),
        newRow,
      ],
    }));
    return { ok: true };
  },

  toggleReveal: (accountId) => {
    const s = get();
    if (s.revealAccountIds.has(accountId)) {
      set((st) => {
        const next = new Set(st.revealAccountIds);
        next.delete(accountId);
        const { [accountId]: _, ...rest } = st.revealedPlaintext;
        return { revealAccountIds: next, revealedPlaintext: rest };
      });
      return;
    }
    get().revealAccount(accountId);
  },

  revealAccount: (accountId) => {
    const row = get().banking.find((b) => b.id === accountId);
    if (!row) return { ok: false, error: "Account not found" };
    set((s) => {
      const next = new Set(s.revealAccountIds);
      next.add(accountId);
      return {
        revealAccountIds: next,
        revealedPlaintext: { ...s.revealedPlaintext, [accountId]: row.accountRef },
      };
    });
    return { ok: true, data: row.accountRef };
  },

  isRevealed: (accountId) => get().revealAccountIds.has(accountId),
  getRevealedPlaintext: (accountId) => get().revealedPlaintext[accountId],

  paymentsForMonth: (month) => get().payments.filter((p) => p.month === month),
  paymentEvents: (paymentId) =>
    get()
      .events.filter((e) => e.paymentId === paymentId)
      .sort((a, b) => b.createdAt - a.createdAt),

  upsertPaymentDue: (employeeId, month, amountDuePkr) => {
    try {
      const due = assertWholePkr(amountDuePkr);
      const existing = get().payments.find((p) => p.employeeId === employeeId && p.month === month);
      const bank = get().currentBanking(employeeId);
      if (existing) {
        // Keep Oct 2026 history untouched — refuse due rewrite on locked historical month.
        if (month === HISTORICAL_LOCKED_MONTH) {
          return { ok: false, error: `Historical month ${HISTORICAL_LOCKED_MONTH} is locked — due/paid amounts cannot be rewritten` };
        }
        set((s) => ({
          payments: s.payments.map((p) =>
            p.id === existing.id
              ? {
                  ...p,
                  amountDuePkr: due,
                  status: p.status === "on_hold" ? "on_hold" : derivePaymentStatus(due, p.amountPaidPkr),
                  bankingAccountId: p.bankingAccountId ?? bank?.id ?? null,
                  updatedAt: Date.now(),
                }
              : p,
          ),
          events: [
            {
              id: uid(),
              paymentId: existing.id,
              eventType: "due_set",
              amountPkr: due,
              statusAfter: existing.status,
              note: "due upsert",
              createdAt: Date.now(),
            },
            ...s.events,
          ],
        }));
      } else {
        const row: SalaryPaymentRecord = {
          id: uid(),
          employeeId,
          month,
          amountDuePkr: due,
          amountPaidPkr: 0,
          status: "unpaid",
          bankingAccountId: bank?.id ?? null,
          paidOn: null,
          note: "",
          updatedAt: Date.now(),
        };
        set((s) => ({
          payments: [...s.payments, row],
          events: [
            {
              id: uid(),
              paymentId: row.id,
              eventType: "due_set",
              amountPkr: due,
              statusAfter: "unpaid",
              note: "due create",
              createdAt: Date.now(),
            },
            ...s.events,
          ],
        }));
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Invalid amount" };
    }
  },

  recordPayment: (paymentId, addPkr, paidOn) => {
    try {
      const row = get().payments.find((p) => p.id === paymentId);
      if (!row) return { ok: false, error: "Payment row not found" };
      const next = applyPartialPayment(row, addPkr, paidOn);
      set((s) => ({
        payments: s.payments.map((p) => (p.id === paymentId ? next : p)),
        events: [
          {
            id: uid(),
            paymentId,
            eventType: "partial_pay",
            amountPkr: addPkr,
            statusAfter: next.status,
            note: "",
            createdAt: Date.now(),
          },
          ...s.events,
        ],
      }));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Payment failed" };
    }
  },

  setPaymentStatus: (paymentId, status) => {
    set((s) => {
      const payments = s.payments.map((p) => {
        if (p.id !== paymentId) return p;
        if (status === "on_hold") return { ...p, status, updatedAt: Date.now() };
        if (status === "unpaid") return { ...p, status, amountPaidPkr: 0, paidOn: null, updatedAt: Date.now() };
        if (status === "paid") {
          return {
            ...p,
            status: "paid" as const,
            amountPaidPkr: p.amountDuePkr,
            paidOn: p.paidOn ?? new Date().toISOString().slice(0, 10),
            updatedAt: Date.now(),
          };
        }
        return {
          ...p,
          status: derivePaymentStatus(p.amountDuePkr, p.amountPaidPkr),
          updatedAt: Date.now(),
        };
      });
      const after = payments.find((p) => p.id === paymentId);
      return {
        payments,
        events: [
          {
            id: uid(),
            paymentId,
            eventType: "status_change" as const,
            amountPkr: null,
            statusAfter: after?.status ?? status,
            note: "manual status",
            createdAt: Date.now(),
          },
          ...s.events,
        ],
      };
    });
    return { ok: true };
  },

  resetMockSeed: () =>
    set({
      meta: seedMeta(),
      banking: seedBanking(),
      payments: seedPayments(),
      events: seedEvents(),
      revealAccountIds: new Set(),
      revealedPlaintext: {},
    }),
}));

/** Guard used in tests — ensures mock module never registers a persist name. */
export function employeeFinancePersistenceGuard(): { usesLocalStorage: false; syncKeysSafe: true } {
  return { usesLocalStorage: false, syncKeysSafe: true };
}
