# Driver Rate Cards — operator checklist

**Status:** awaiting separate production apply approval.  
**Do not** apply this migration, enable the flag, merge, or deploy without explicit approval.

## Files

| Path | Role |
|------|------|
| `20261106140000_driver_rate_cards_secure.sql` | Table + FORCE RLS deny-all + admin RPCs |
| This README | Operator gate |

## Target

**Driver Compliance** Supabase project only (`VITE_SUPABASE_*` / `src/integrations/supabase/client.ts`).  
**Not** Admin Attendance / `app_state` / PR #8 banking.

## Before apply

1. Confirm target project is Driver Compliance.
2. Confirm `driver_portal_is_admin()` already exists (from `20261102090000_driver_full_cloud.sql`).
3. Backup Driver data.
4. Do **not** touch `tracker_sections` live rows or Admin DB.

## After apply

1. Sign in as `hr.compliance@gmail.com` (admin) — rate card RPCs succeed.
2. Sign in as a **standard** portal user — RPCs raise admin-required; table SELECT denied.
3. Confirm rate values are **not** present in any `tracker_sections` jsonb.
4. Only then consider enabling `VITE_DRIVER_RATE_CARD_SECURE=1` on Cloudflare (separate approval).

## App defaults

- Without the flag: mock session memory only (rates not cloud-persisted).
- Rate Card UI is admin-gated in the driver file.
- Blank ≠ 0; decimals like `0.550` preserved as strings.
