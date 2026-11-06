# Driver Drug Test Records — operator checklist

**Status:** awaiting separate production apply approval.  
**Do not** apply, enable the flag, merge, or deploy without explicit approval.

## Files

| Path | Role |
|------|------|
| `20261106140100_driver_drug_tests_secure.sql` | Events table + FORCE RLS + admin RPCs + audit |
| Prefer apply **after** `20261106140000_driver_rate_cards_secure.sql` (shared audit helper) |
| This README | Operator gate |

## Target

**Driver Compliance** Supabase only (`okzcwctsgurumnnzuxgg` / `VITE_SUPABASE_*`).  
**Not** Admin Lovable Cloud / PR #8 banking.

## Rules enforced in app

- Short names: Federal Drug (CCF) / Medical Review (MRO)
- Records only — no PDF upload
- Pairing key: driver + specimen + reason + collection context
- Specimen IDs are text (leading zeros preserved)
- Matched ≠ Negative / clearance / approval
- Never mutates Other Documents / medical / duty
- Not stored in `tracker_sections` or AppData localStorage

## Flag

`VITE_DRIVER_DRUG_TESTS_SECURE=1` — keep off until migration applied.
