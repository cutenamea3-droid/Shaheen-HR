# Driver Drug Test Records — operator checklist

**Status:** awaiting separate production apply approval.  
**Do not** apply, enable the flag, merge, or deploy without explicit approval.

## Files

| Path | Role |
|------|------|
| `20261106140100_driver_drug_tests_secure.sql` | Events table + audit + admin RPCs |
| This README | Operator gate |

## Target

**Driver Compliance** Supabase only — not Admin Attendance, not PR #8 banking.

## Rules enforced in app

- Short names: Federal Drug / Medical Review
- Records only — no PDF upload
- Pairing key: driver + specimen + reason + collection context
- Specimen IDs are text (leading zeros preserved)
- Matched ≠ Negative / clearance / approval
- Never mutates Other Documents / medical / duty
- Not stored in `tracker_sections` or AppData localStorage

## Flag

`VITE_DRIVER_DRUG_TESTS_SECURE=1` — keep off until migration applied.
