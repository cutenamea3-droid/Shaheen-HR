# Driver Drug Test Records — operator checklist

**Status:** awaiting separate production apply approval.  
**Do not** apply, enable the flag, merge, or deploy without explicit approval.

## Files

| Path | Role |
|------|------|
| `20261106140100_driver_drug_tests_secure.sql` | Events + soft-delete + testing_event_id + VOLATILE list + audit |
| Prefer apply **after** `20261106140000_driver_rate_cards_secure.sql` (shared audit helper) |
| This README | Operator gate |

## Target

**Driver Compliance** Supabase only (`okzcwctsgurumnnzuxgg` / `VITE_SUPABASE_*`).  
**Not** Admin Lovable Cloud / PR #8 banking.

## Changes in this migration (vs earlier draft)

1. **`driver_drug_test_list` is VOLATILE** (not STABLE) — it writes audit rows; STABLE+write is invalid.
2. **Soft-delete only** (`deleted_at` / `driver_drug_test_restore`) — no hard DELETE of history via RPC.
3. **`testing_event_id`** groups FD+MR for one individual testing event; multi Random/Follow-up stay independent.
4. **Updates audited** with before/correction detail; incomplete rows remain editable.
5. **Safeguards:** `testing_event_id` cannot span drivers; one active testing event ≤1 FD and ≤1 MR (partial unique index + `private.driver_drug_test_assert_group`). Soft-deleted rows do not count.

## Rules enforced in app

- Short names: Federal Drug (CCF) / Medical Review (MRO)
- Records only — no PDF upload
- Pairing prefers `testing_event_id`; fallback specimen+reason+collection when ids allow
- Specimen IDs are text (leading zeros preserved)
- Matched ≠ Negative / clearance / approval
- Never mutates Other Documents / medical / duty / Hire
- Not stored in `tracker_sections` or AppData localStorage

## Flag

`VITE_DRIVER_DRUG_TESTS_SECURE=1` — enable on Cloudflare Pages (Preview/Production) **after** SQL is applied, then redeploy. App disables saving when the flag is off (no mock/localStorage as a real save). Do not commit the flag into `.env.production` from this checklist.
