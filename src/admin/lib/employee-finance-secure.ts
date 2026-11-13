/**
 * Secure Admin-backend client for employee banking / roster.
 * Talks only to dedicated tables/RPCs — never app_state / localStorage.
 *
 * Enabled only when VITE_HR_FINANCE_SECURE=1 AND migration has been applied.
 * Batch 5: banking + roster only. Salary payment RPCs left to Batch 6.
 */

import { supabase } from "@/admin/integrations/supabase/client";
import type { BankingAccountMasked, EmployeeDirectoryMeta, EmploymentStatus } from "./employee-finance-types";
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

function mapMeta(row: Record<string, unknown>): EmployeeDirectoryMeta {
  return {
    employeeId: String(row.employee_id),
    status: String(row.status) as EmploymentStatus,
    joiningDate: row.joining_date != null ? String(row.joining_date).slice(0, 10) : null,
    designation: row.designation != null ? String(row.designation) : null,
    deactivatedAt: row.deactivated_at != null ? String(row.deactivated_at).slice(0, 10) : null,
    reactivatedAt: row.reactivated_at != null ? String(row.reactivated_at).slice(0, 10) : null,
  };
}

/** Probe whether secure RPCs exist (migration applied). */
export async function probeSecureFinanceAvailable(): Promise<boolean> {
  const { error } = await supabase.rpc("hr_list_banking_masked" as never, { p_employee_id: null } as never);
  if (!error) return true;
  const msg = (error.message || "").toLowerCase();
  if (msg.includes("could not find") || msg.includes("does not exist") || msg.includes("404")) return false;
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
