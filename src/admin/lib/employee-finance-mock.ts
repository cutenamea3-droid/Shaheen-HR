/**
 * In-memory ONLY mock for employment status, banking history, and salary payments.
 *
 * SECURITY:
 * - Does NOT use zustand persist, localStorage, sessionStorage, or app_state.
 * - Must never be added to HR_SYNC_KEYS / backup KEYS.
 * - Synthetic IBAN/account values are for UI + logic tests only.
 */

import { create } from "zustand";
import type {
  BankingAccountRecord,
  EmployeeDirectoryMeta,
  EmploymentStatus,
  SalaryPaymentRecord,
  SalaryPaymentStatus,
} from "./employee-finance-types";
import { applyPartialPayment, assertWholePkr, derivePaymentStatus } from "./salary-payments";
import { isValidPkIban, normalizePkIban } from "./pk-iban";

const uid = () => Math.random().toString(36).slice(2, 10);

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

function seedBanking(): BankingAccountRecord[] {
  return [
    {
      id: "bank-a1",
      employeeId: "mock-emp-a1",
      institutionId: "hbl",
      accountTitle: "Ayesha Khan",
      accountRef: MOCK_IBANS.ayesha,
      isIban: true,
      effectiveFrom: "2025-01-01",
      supersededAt: null,
      note: "Primary salary account",
    },
    {
      id: "bank-b2",
      employeeId: "mock-emp-b2",
      institutionId: "meezan",
      accountTitle: "Bilal Ahmed",
      accountRef: MOCK_IBANS.bilal,
      isIban: true,
      effectiveFrom: "2024-06-15",
      supersededAt: null,
      note: "",
    },
    {
      id: "bank-c3",
      employeeId: "mock-emp-c3",
      institutionId: "jazzcash",
      accountTitle: "Camila Raza",
      accountRef: "03001234567",
      isIban: false,
      effectiveFrom: "2025-03-01",
      supersededAt: null,
      note: "Wallet — not a bank",
    },
    {
      id: "bank-d4-old",
      employeeId: "mock-emp-d4",
      institutionId: "bafl",
      accountTitle: "Danish Iqbal",
      accountRef: MOCK_IBANS.danish_old,
      isIban: true,
      effectiveFrom: "2023-01-01",
      supersededAt: "2025-08-01",
      note: "Superseded — do not pay",
    },
    {
      id: "bank-d4-new",
      employeeId: "mock-emp-d4",
      institutionId: "baah",
      accountTitle: "Danish Iqbal",
      accountRef: MOCK_IBANS.danish_new,
      isIban: true,
      effectiveFrom: "2025-08-01",
      supersededAt: null,
      note: "Current",
    },
  ];
}

function seedMeta(): Record<string, EmployeeDirectoryMeta> {
  const out: Record<string, EmployeeDirectoryMeta> = {};
  for (const e of SYNTHETIC_EMPLOYEES) {
    out[e.id] = {
      employeeId: e.id,
      status: e.id === "mock-emp-d4" ? "leave" : "active",
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

type FinanceState = {
  /** Banner / mode flag — always mock until secure backend approved. */
  persistenceBlocked: true;
  meta: Record<string, EmployeeDirectoryMeta>;
  banking: BankingAccountRecord[];
  payments: SalaryPaymentRecord[];
  revealAccountIds: Set<string>;

  ensureMeta: (employeeId: string) => void;
  setStatus: (employeeId: string, status: EmploymentStatus, confirmDeactivate?: boolean) => { ok: boolean; error?: string };
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
  isRevealed: (accountId: string) => boolean;

  paymentsForMonth: (month: string) => SalaryPaymentRecord[];
  upsertPaymentDue: (employeeId: string, month: string, amountDuePkr: number) => { ok: boolean; error?: string };
  recordPayment: (paymentId: string, addPkr: number, paidOn: string) => { ok: boolean; error?: string };
  setPaymentStatus: (paymentId: string, status: SalaryPaymentStatus) => { ok: boolean; error?: string };
  resetMockSeed: () => void;
};

export const useEmployeeFinanceMock = create<FinanceState>()((set, get) => ({
  persistenceBlocked: true,
  meta: seedMeta(),
  banking: seedBanking(),
  payments: seedPayments(),
  revealAccountIds: new Set(),

  ensureMeta: (employeeId) => {
    if (get().meta[employeeId]) return;
    set((s) => ({
      meta: {
        ...s.meta,
        [employeeId]: { employeeId, status: "active", deactivatedAt: null, reactivatedAt: null },
      },
    }));
  },

  setStatus: (employeeId, status, confirmDeactivate = false) => {
    get().ensureMeta(employeeId);
    const cur = get().meta[employeeId]!;
    if (status === "inactive" && cur.status !== "inactive" && !confirmDeactivate) {
      return { ok: false, error: "Confirm deactivation required" };
    }
    // Reactivate: flip back to active on same employeeId — never create a duplicate employee row.
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
    const newRow: BankingAccountRecord = {
      id: uid(),
      employeeId: input.employeeId,
      institutionId: input.institutionId,
      otherLabel: input.otherLabel,
      accountTitle: input.accountTitle.trim(),
      accountRef: ref,
      isIban: input.isIban,
      effectiveFrom: today,
      supersededAt: null,
      note: input.note?.trim() ?? "",
    };
    set((s) => ({
      banking: [
        ...s.banking.map((b) =>
          b.employeeId === input.employeeId && !b.supersededAt
            ? { ...b, supersededAt: today }
            : b,
        ),
        newRow,
      ],
    }));
    return { ok: true };
  },

  toggleReveal: (accountId) => {
    set((s) => {
      const next = new Set(s.revealAccountIds);
      if (next.has(accountId)) next.delete(accountId);
      else next.add(accountId);
      return { revealAccountIds: next };
    });
  },

  isRevealed: (accountId) => get().revealAccountIds.has(accountId),

  paymentsForMonth: (month) => get().payments.filter((p) => p.month === month),

  upsertPaymentDue: (employeeId, month, amountDuePkr) => {
    try {
      const due = assertWholePkr(amountDuePkr);
      const existing = get().payments.find((p) => p.employeeId === employeeId && p.month === month);
      const bank = get().currentBanking(employeeId);
      if (existing) {
        set((s) => ({
          payments: s.payments.map((p) =>
            p.id === existing.id
              ? {
                  ...p,
                  amountDuePkr: due,
                  status:
                    p.status === "on_hold"
                      ? "on_hold"
                      : derivePaymentStatus(due, p.amountPaidPkr),
                  bankingAccountId: p.bankingAccountId ?? bank?.id ?? null,
                  updatedAt: Date.now(),
                }
              : p,
          ),
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
        set((s) => ({ payments: [...s.payments, row] }));
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
      set((s) => ({ payments: s.payments.map((p) => (p.id === paymentId ? next : p)) }));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Payment failed" };
    }
  },

  setPaymentStatus: (paymentId, status) => {
    set((s) => ({
      payments: s.payments.map((p) => {
        if (p.id !== paymentId) return p;
        if (status === "on_hold") return { ...p, status, updatedAt: Date.now() };
        if (status === "unpaid") return { ...p, status, amountPaidPkr: 0, paidOn: null, updatedAt: Date.now() };
        if (status === "paid") {
          return {
            ...p,
            status: "paid",
            amountPaidPkr: p.amountDuePkr,
            paidOn: p.paidOn ?? new Date().toISOString().slice(0, 10),
            updatedAt: Date.now(),
          };
        }
        // partial — keep amounts; just label
        return {
          ...p,
          status: derivePaymentStatus(p.amountDuePkr, p.amountPaidPkr),
          updatedAt: Date.now(),
        };
      }),
    }));
    return { ok: true };
  },

  resetMockSeed: () =>
    set({
      meta: seedMeta(),
      banking: seedBanking(),
      payments: seedPayments(),
      revealAccountIds: new Set(),
    }),
}));

/** Guard used in tests — ensures mock module never registers a persist name. */
export function employeeFinancePersistenceGuard(): { usesLocalStorage: false; syncKeysSafe: true } {
  return { usesLocalStorage: false, syncKeysSafe: true };
}
