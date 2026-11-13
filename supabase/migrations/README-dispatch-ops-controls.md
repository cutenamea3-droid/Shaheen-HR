# Dispatch Batch 8 — operational controls (review-only)

**Do not apply to Production without owner approval.**

## File
`20261113190000_dispatch_ops_controls.sql`

## Depends on
- `20261113170000_dispatch_operations.sql` (Batch 7 / PR #25 ops core)
- `dispatch_can_access()` + `dispatch_touch_updated_at()` from that migration

## Adds
| Change | Purpose |
|--------|---------|
| `dispatch_loads.cancel_reason` | Manual cancel reason |
| `dispatch_loads.reschedule_note` | Manual reschedule note (no invented ETAs) |
| `dispatch_issues.senior_informed*` | Manual Senior Informed record (no auto-notify) |
| `dispatch_follow_ups` | Desk follow-up reminders (not push/email) |

## Not included
- Document file storage / invented BOL/POD content
- HOS, GPS, ETA, availability, notifications
- Compliance / Admin / Personal tables

## Apply order (Preview first)
1. Backup Preview project
2. Apply `20261113170000_dispatch_operations.sql` if not already
3. Apply this file
4. Smoke: cancel load with reason; mark Senior Informed; create follow-up; deny Compliance read
