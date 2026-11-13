# HR employee finance migration — approval gate

**File:** `20261105180000_hr_employee_finance_secure.sql`  
**Target:** Admin Lovable Cloud only (`src/admin/integrations/supabase/client.ts` host).  
**Never:** Driver Supabase project / `VITE_SUPABASE_*`.

## Do not apply until separate production approval

This migration is committed for review only. Applying it creates tables, RLS, vault/GUC encryption dependency, and RPCs on the **live Admin** database.

## What it creates (needs approval)

| Object | Purpose |
|--------|---------|
| `private` schema helpers | `hr_is_finance_admin`, encrypt/decrypt, audit |
| `hr_employee_roster` | Active/Inactive/Leave + joining_date (by attendance `employee_id`) |
| `hr_banking_accounts` | Holder, provider, IBAN/account **ciphertext**, last4, history |
| `hr_banking_accounts_masked` | View without ciphertext |
| `hr_salary_payments` | Monthly PKR due/paid/status |
| `hr_salary_payment_events` | Partial payment / status history |
| `hr_finance_audit_log` | Reveal + mutate audit trail |
| RPCs | upsert roster, add banking, reveal (audited), salary due/pay/status |
| RLS + FORCE RLS | HR owner email only; no `anon` access; no client GRANT on ciphertext table |

## Operator prerequisites

1. Encryption secret: vault `hr_banking_encryption_key` **or** GUC `app.hr_banking_encryption_key` (≥16 chars).
2. Confirm Admin project (not Driver).
3. Backup; leave `app_state` / attendance untouched.
4. Apply SQL once; smoke-test as `hr.compliance@gmail.com` only.
5. Enable app flag `VITE_HR_FINANCE_SECURE=1` only after apply succeeds.

## App default

Client stays on **mock** (`VITE_HR_FINANCE_SECURE` unset) so production UI never hits missing tables.

## Related gates

- Do **not** merge/enable until Attendance cloud sync (**PR #19**) is verified.
- Expenses schema is separate: `20261113160000_hr_expenses_management.sql` (no bank ciphertext).
- **Batch 5** ships Directory + bank UI only (flag off / mock). Salary payment register UI + expenses pages are **Batch 6**.
- Salary tables/RPCs in this SQL remain review-only shared schema; Batch 6 owns the pay-register surface.
