# Batch 2 — Module isolation SQL (review-only)

**Do not apply to Production without Yousaf’s explicit approval.**

## Files

| Artifact | Project | Purpose |
|----------|---------|---------|
| `20261113180000_batch2_module_isolation.sql` | Driver Supabase (`okzcwctsgurumnnzuxgg`) | `dispatch_portal_accounts` ACL + ensure/set_access RPCs |
| `../functions/create-dispatch-user/` | Driver project edge fn | Admin-only invite (service role server-side) |
| `../../admin-supabase/migrations/20261113180000_hr_portal_accounts.sql` | **Admin Lovable Cloud** | Real Admin-HR ACL (replaces soft `app_state.team`) |

## Order / conflicts

- Idempotent with PR #25 Dispatch ACL section (`CREATE IF NOT EXISTS` / `CREATE OR REPLACE`).
- PR #25 still owns full `dispatch_loads` / ops tables — Batch 2 does **not** ship ops schema.
- Do **not** merge/apply Personal SQL from #16 here.

## Preview steps (after approval)

1. Backup Driver project.
2. Apply `20261113180000_batch2_module_isolation.sql` on Preview first.
3. Deploy `create-dispatch-user` with `SUPABASE_URL`, anon/publishable, `SUPABASE_SERVICE_ROLE_KEY`.
4. Sign in at `/dispatch` as owner → bootstrap admin seat.
5. Invite a **dedicated** dispatcher email (not a Compliance standard seat).
6. Deny smoke: dispatcher JWT cannot `SELECT` `tracker_sections` / rate / drug tables.
