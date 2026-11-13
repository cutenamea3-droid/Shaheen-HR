# HR expenses migration — approval gate

**File:** `20261113160000_hr_expenses_management.sql`  
**Target:** Admin Lovable Cloud only (`src/admin/integrations/supabase/client.ts` host).  
**Never:** Driver Supabase / `okzcwctsgurumnnzuxgg`.

## Do not apply until

1. Attendance cloud sync (**PR #19**) is verified.
2. Separate production approval for Admin DB schema change.
3. Banking migration (`20261105180000_…`) reviewed separately (expenses has **no** bank ciphertext).

## What it creates

| Object | Purpose |
|--------|---------|
| `hr_expense_categories` | Built-in + custom categories |
| `hr_expenses` | Soft-deletable expense rows; scope one/multiple/all; whole PKR |
| `hr_expense_templates` | Recurring templates (app never auto-creates from these) |
| `hr_expense_budgets` | Optional monthly category caps |
| `hr_expense_audit_log` | Mutate audit |
| RLS FORCE | HR owner email only |

## App default

`VITE_HR_EXPENSES_SECURE` unset → browser-local `hr-expenses-v1` (not `app_state`).
