# Dispatch Batch 9 — closeout (review-only)

**Do not apply to Production without owner approval.**

## File
`20261113200000_dispatch_closeout.sql`

## Depends on
- `20261113170000_dispatch_operations.sql` (Batch 7)
- `20261113190000_dispatch_ops_controls.sql` (Batch 8)
- `dispatch_can_access()` + `dispatch_touch_updated_at()`

## Adds
| Change | Purpose |
|--------|---------|
| `dispatch_loads.closeout_note` / `closed_at` | Manual closeout (Delivered ≠ Closed) |
| `dispatch_loads.reopen_reason` / `reopened_at` | Reopen closed → delivered |
| `dispatch_loads.payment_status` | Paid independent of closed |
| `dispatch_accessorials` | Detention/accessorials — manual amount/hours only |
| `dispatch_communications` | Comm/decision log — no external notify |

## Not included
- Rate / free-time calculators
- Auto Admin expense / payroll posts from claims
- External email/SMS/push
- Compliance / Admin / Personal tables
- Batch 10 features

## Apply order (Preview first)
1. Backup Preview project
2. Apply Batch 7 + Batch 8 SQL if not already
3. Apply this file
4. Smoke: close delivered load; reopen; add detention with blank amount; log decision; confirm payment_status independent; deny Compliance read
