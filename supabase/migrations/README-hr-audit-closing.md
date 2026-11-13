# HR Audit / Month Closing / Reminders (Batch 11B)

**Status:** Review-only. Not applied to Production.

## Browser keys (default)

| Key | Purpose |
|-----|---------|
| `hr-month-closing-v1` | Month close / reopen |
| `hr-reminders-v1` | My HR Today reminders |
| `hr-perf-followups-v1` | Performance follow-ups + HR statements |
| `hr-audit-history-v1` | Operator audit trail |

These must **never** be added to `HR_SYNC_KEYS` / `app_state`. Banking/salary stay out.

## Hard rules

- Closing ≠ Paid
- Formal PDFs use forest green / gold; portal UI stays navy / orange
- No invented attendance or performance facts
- Gate any future cloud SQL + flags behind Attendance sync (#19) verified + separate approval
