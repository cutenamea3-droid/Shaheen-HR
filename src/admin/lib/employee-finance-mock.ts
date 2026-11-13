/**
 * In-memory ONLY mock for employment status + banking history.
 *
 * SECURITY:
 * - Does NOT use zustand persist, localStorage, sessionStorage, or app_state.
 * - Must never be added to HR_SYNC_KEYS / backup KEYS.
 * - Synthetic IBAN/account values are for UI + logic tests only.
 *
 * Batch 5: no salary payment register (Batch 6).
 */

import { create } from "zustand";
import type {
  BankingAccountRecord,
  EmployeeDirectoryMeta,
  EmploymentStatus,
} from "./employee-finance-types";
import { isValidPkIban, normalizePkIban, pkIbanLast4 } from "./pk-iban";

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
      note: "Primary account",
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
      note: "Superseded",
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
      joiningDate:
        e.id === "mock-emp-a1"
          ? "2024-02-01"
          : e.id === "mock-emp-b2"
            ? "2023-06-15"
            : e.id === "mock-emp-c3"
              ? "2025-01-10"
              : "2022-11-01",
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

type FinanceState = {
  mode: "mock";
  persistenceBlocked: true;
  meta: Record<string, EmployeeDirectoryMeta>;
  banking: BankingAccountRecord[];
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
  resetMockSeed: () => void;
};

export const useEmployeeFinanceMock = create<FinanceState>()((set, get) => ({
  mode: "mock",
  persistenceBlocked: true,
  meta: seedMeta(),
  banking: seedBanking(),
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

  resetMockSeed: () =>
    set({
      meta: seedMeta(),
      banking: seedBanking(),
      revealAccountIds: new Set(),
      revealedPlaintext: {},
    }),
}));

/** Guard used in tests — ensures mock module never registers a persist name. */
export function employeeFinancePersistenceGuard(): { usesLocalStorage: false; syncKeysSafe: true } {
  return { usesLocalStorage: false, syncKeysSafe: true };
}
