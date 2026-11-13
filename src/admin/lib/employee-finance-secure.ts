/**
 * Secure Admin-backend client for employee finance.
 * Talks only to dedicated tables/RPCs — never app_state / localStorage.
 *
 * Enabled only when VITE_HR_FINANCE_SECURE=1 AND migration has been applied.
 * Until then, callers should keep using mock mode.
 */

import { supabase } from "@/admin/integrations/supabase/client";
import type { BankingAccountMasked, EmployeeDirectoryMeta, EmploymentStatus, SalaryPaymentEvent, SalaryPaymentRecord, SalaryPaymentStatus } from "./employee-finance-types";
import type { AddBankingInput, FinanceResult } from "./employee-finance-api";
import { isValidPkIban, normalizePkIban } from "./pk-iban";

type RpcError = { message?: string } | null;

function errMsg(error: RpcError, fallback: string): string {
  return error?.message?.trim() || fallback;
}

function mapMasked(row: Record<string, unknown>): BankingAccountMasked {
  const other = row.other_label != null ? String(row.other_label) : undefined;
  return {
    id: String(row.id),
    employeeId: String(row.employee_id),
    institutionId: String(row.provider_id),
    ...(other != null && other !== "" ? { otherLabel: other } : {}),
    accountTitle: String(row.holder_name),
    accountLast4: String(row.account_last4),
    isIban: Boolean(row.is_iban),
    effectiveFrom: String(row.effective_from).slice(0, 10),
    supersededAt: row.superseded_at != null ? String(row.superseded_at).slice(0, 10) : null,
    note: String(row.note ?? ""),
  };
}

function mapPayment(row: Record<string, unknown>): SalaryPaymentRecord {
  return {
    id: String(row.id),
    employeeId: String(row.employee_id),
    month: String(row.month),
    amountDuePkr: Number(row.amount_due_pkr),
    amountPaidPkr: Number(row.amount_paid_pkr),
    status: String(row.status) as SalaryPaymentStatus,
    bankingAccountId: row.banking_account_id != null ? String(row.banking_account_id) : null,
    paidOn: row.paid_on != null ? String(row.paid_on).slice(0, 10) : null,
    note: String(row.note ?? ""),
    updatedAt: row.updated_at ? Date.parse(String(row.updated_at)) : Date.now(),
  };
}

function mapMeta(row: Record<string, unknown>): EmployeeDirectoryMeta {
  return {
    employeeId: String(row.employee_id),
    status: String(row.status) as EmploymentStatus,
    joiningDate: row.joining_date != null ? String(row.joining_date).slice(0, 10) : null,
    deactivatedAt: row.deactivated_at != null ? String(row.deactivated_at).slice(0, 10) : null,
    reactivatedAt: row.reactivated_at != null ? String(row.reactivated_at).slice(0, 10) : null,
  };
}

function mapEvent(row: Record<string, unknown>): SalaryPaymentEvent {
  return {
    id: String(row.id),
    paymentId: String(row.payment_id),
    eventType: String(row.event_type) as SalaryPaymentEvent["eventType"],
    amountPkr: row.amount_pkr == null ? null : Number(row.amount_pkr),
    statusAfter: row.status_after != null ? String(row.status_after) : null,
    note: String(row.note ?? ""),
    createdAt: row.created_at ? Date.parse(String(row.created_at)) : Date.now(),
  };
}

/** Probe whether secure RPCs exist (migration applied). */
export async function probeSecureFinanceAvailable(): Promise<boolean> {
  const { error } = await supabase.rpc("hr_list_banking_masked" as never, { p_employee_id: null } as never);
  if (!error) return true;
  const msg = (error.message || "").toLowerCase();
  if (msg.includes("could not find") || msg.includes("does not exist") || msg.includes("404")) return false;
  // Auth / key errors still mean the function exists
  return !msg.includes("schema cache");
}

export async function secureListRoster(): Promise<FinanceResult<EmployeeDirectoryMeta[]>> {
  const { data, error } = await supabase.from("hr_employee_roster" as never).select("*");
  if (error) return { ok: false, error: errMsg(error, "Failed to load roster") };
  return { ok: true, data: ((data as unknown[]) ?? []).map((r) => mapMeta(r as Record<string, unknown>)) };
}

export async function secureUpsertRoster(
  employeeId: string,
  status: EmploymentStatus,
  opts?: { confirmDeactivate?: boolean; joiningDate?: string | null },
): Promise<FinanceResult<EmployeeDirectoryMeta>> {
  const { data, error } = await supabase.rpc("hr_upsert_employee_roster" as never, {
    p_employee_id: employeeId,
    p_status: status,
    p_joining_date: opts?.joiningDate ?? null,
    p_confirm_deactivate: opts?.confirmDeactivate ?? false,
  } as never);
  if (error) return { ok: false, error: errMsg(error, "Roster update failed") };
  return { ok: true, data: mapMeta(data as Record<string, unknown>) };
}

export async function secureListBanking(employeeId?: string): Promise<FinanceResult<BankingAccountMasked[]>> {
  const { data, error } = await supabase.rpc("hr_list_banking_masked" as never, {
    p_employee_id: employeeId ?? null,
  } as never);
  if (error) return { ok: false, error: errMsg(error, "Failed to list banking") };
  return { ok: true, data: ((data as unknown[]) ?? []).map((r) => mapMasked(r as Record<string, unknown>)) };
}

export async function secureAddBanking(input: AddBankingInput): Promise<FinanceResult<BankingAccountMasked>> {
  const ref = input.isIban ? normalizePkIban(input.accountRef) : input.accountRef.trim();
  if (input.isIban && !isValidPkIban(ref)) return { ok: false, error: "Invalid Pakistan IBAN" };
  const { data, error } = await supabase.rpc("hr_add_banking_account" as never, {
    p_employee_id: input.employeeId,
    p_provider_id: input.institutionId,
    p_holder_name: input.accountTitle,
    p_account_ref: ref,
    p_is_iban: input.isIban,
    p_effective_from: input.effectiveFrom,
    p_other_label: input.otherLabel ?? null,
    p_note: input.note ?? "",
  } as never);
  if (error) return { ok: false, error: errMsg(error, "Banking save failed") };
  return { ok: true, data: mapMasked(data as Record<string, unknown>) };
}

export async function secureRevealBanking(accountId: string): Promise<FinanceResult<string>> {
  const { data, error } = await supabase.rpc("hr_reveal_banking_account" as never, {
    p_account_id: accountId,
  } as never);
  if (error) return { ok: false, error: errMsg(error, "Reveal failed") };
  return { ok: true, data: String(data) };
}

export async function secureListPayments(month: string): Promise<FinanceResult<SalaryPaymentRecord[]>> {
  const { data, error } = await supabase
    .from("hr_salary_payments" as never)
    .select("*")
    .eq("month" as never, month as never);
  if (error) return { ok: false, error: errMsg(error, "Failed to load payments") };
  return { ok: true, data: ((data as unknown[]) ?? []).map((r) => mapPayment(r as Record<string, unknown>)) };
}

export async function secureListPaymentEvents(paymentId: string): Promise<FinanceResult<SalaryPaymentEvent[]>> {
  const { data, error } = await supabase
    .from("hr_salary_payment_events" as never)
    .select("*")
    .eq("payment_id" as never, paymentId as never)
    .order("created_at" as never, { ascending: false } as never);
  if (error) return { ok: false, error: errMsg(error, "Failed to load payment history") };
  return { ok: true, data: ((data as unknown[]) ?? []).map((r) => mapEvent(r as Record<string, unknown>)) };
}

export async function secureUpsertDue(
  employeeId: string,
  month: string,
  amountDuePkr: number,
  bankingAccountId?: string | null,
): Promise<FinanceResult<SalaryPaymentRecord>> {
  const { data, error } = await supabase.rpc("hr_upsert_salary_due" as never, {
    p_employee_id: employeeId,
    p_month: month,
    p_amount_due_pkr: amountDuePkr,
    p_banking_account_id: bankingAccountId ?? null,
  } as never);
  if (error) return { ok: false, error: errMsg(error, "Due upsert failed") };
  return { ok: true, data: mapPayment(data as Record<string, unknown>) };
}

export async function secureRecordPayment(
  paymentId: string,
  addPkr: number,
  paidOn: string,
  note = "",
): Promise<FinanceResult<SalaryPaymentRecord>> {
  const { data, error } = await supabase.rpc("hr_record_salary_payment" as never, {
    p_payment_id: paymentId,
    p_add_pkr: addPkr,
    p_paid_on: paidOn,
    p_note: note,
  } as never);
  if (error) return { ok: false, error: errMsg(error, "Payment record failed") };
  return { ok: true, data: mapPayment(data as Record<string, unknown>) };
}

export async function secureSetPaymentStatus(
  paymentId: string,
  status: SalaryPaymentStatus,
): Promise<FinanceResult<SalaryPaymentRecord>> {
  const { data, error } = await supabase.rpc("hr_set_salary_status" as never, {
    p_payment_id: paymentId,
    p_status: status,
  } as never);
  if (error) return { ok: false, error: errMsg(error, "Status update failed") };
  return { ok: true, data: mapPayment(data as Record<string, unknown>) };
}
