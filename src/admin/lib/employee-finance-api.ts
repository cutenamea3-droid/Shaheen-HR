/**
 * Shared contract for mock + secure employee finance backends.
 * Implementations must never touch hr-attendance-v1 / app_state / HR_SYNC_KEYS.
 *
 * Batch 5: profiles + bank UI. Batch 6: salary payment register methods.
 */
import type {
  BankingAccountMasked,
  EmployeeDirectoryMeta,
  EmploymentStatus,
  SalaryPaymentEvent,
  SalaryPaymentRecord,
  SalaryPaymentStatus,
} from "./employee-finance-types";

export type FinanceResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

export type AddBankingInput = {
  employeeId: string;
  institutionId: string;
  otherLabel?: string;
  accountTitle: string;
  accountRef: string;
  isIban: boolean;
  effectiveFrom: string;
  note?: string;
};

export interface EmployeeFinanceApi {
  readonly mode: "mock" | "secure";
  readonly persistenceBlocked: boolean;

  ensureMeta: (employeeId: string) => Promise<void> | void;
  getMeta: (employeeId: string) => EmployeeDirectoryMeta | undefined;
  listMeta: () => Record<string, EmployeeDirectoryMeta>;
  setStatus: (
    employeeId: string,
    status: EmploymentStatus,
    opts?: { confirmDeactivate?: boolean; joiningDate?: string | null },
  ) => Promise<FinanceResult> | FinanceResult;
  setJoiningDate: (employeeId: string, joiningDate: string) => Promise<FinanceResult> | FinanceResult;
  setDesignation: (employeeId: string, designation: string) => Promise<FinanceResult> | FinanceResult;

  currentBanking: (employeeId: string) => BankingAccountMasked | undefined;
  bankingHistory: (employeeId: string) => BankingAccountMasked[];
  refreshBanking: (employeeId?: string) => Promise<FinanceResult> | FinanceResult;
  addBankingChange: (input: AddBankingInput) => Promise<FinanceResult> | FinanceResult;
  revealAccount: (accountId: string) => Promise<FinanceResult<string>>;
  isRevealed: (accountId: string) => boolean;
  hideAccount: (accountId: string) => void;

  paymentsForMonth: (month: string) => SalaryPaymentRecord[];
  paymentEvents: (paymentId: string) => SalaryPaymentEvent[];
  refreshPayments: (month: string) => Promise<FinanceResult> | FinanceResult;
  upsertPaymentDue: (employeeId: string, month: string, amountDuePkr: number) => Promise<FinanceResult> | FinanceResult;
  recordPayment: (paymentId: string, addPkr: number, paidOn: string) => Promise<FinanceResult> | FinanceResult;
  setPaymentStatus: (paymentId: string, status: SalaryPaymentStatus) => Promise<FinanceResult> | FinanceResult;
}
