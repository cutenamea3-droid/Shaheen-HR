# Driver Rate Cards — operator checklist

**Status:** awaiting separate production apply approval.  
**Do not** apply this migration, enable the flag, merge, or deploy without explicit approval.

## Files

| Path | Role |
|------|------|
| `20261106140000_driver_rate_cards_secure.sql` | Table + FORCE RLS + scrub blanks + admin RPCs + audit |
| This README | Operator gate |

## Target vs Admin

| | Driver Compliance | Admin & Attendance |
|--|-------------------|--------------------|
| Client | `src/integrations/supabase/client.ts` | `src/admin/integrations/supabase/client.ts` |
| Host | `VITE_SUPABASE_*` / project `okzcwctsgurumnnzuxgg` | `*.lovable.cloud` |
| This migration | **YES** | **NO** |
| PR #8 banking | No | Separate |

## Changes in this migration (vs earlier draft)

1. **`driver_rate_card_get` is VOLATILE** (not STABLE) — authorized reads write audit; STABLE+write is invalid.
2. Upsert audit includes before/after rates detail.
3. Blank rates scrubbed (`private.driver_rate_scrub_rates`) — blank ≠ 0.

## Before apply

1. Confirm SQL Editor is the **Driver** project (not Admin Lovable).
2. Confirm `driver_portal_is_admin()` exists.
3. Backup Driver data; leave `tracker_sections` compliance rows alone for rates.
4. Apply once; verify RLS + RPC.

## After apply

1. Admin (`hr.compliance@gmail.com`) — upsert/get succeed; audit rows appear on **get** and upsert.
2. Standard portal user — RPCs raise admin-required; table SELECT denied.
3. Confirm rates **absent** from `tracker_sections` jsonb.
4. Only then consider `VITE_DRIVER_RATE_CARD_SECURE=1` (separate approval).

## App defaults

Without the flag: mock session memory only. Rate Card UI is admin-gated.
