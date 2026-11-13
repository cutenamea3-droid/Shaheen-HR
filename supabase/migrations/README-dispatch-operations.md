# Dispatch Operations SQL — approval gate

**Do not apply to Production without explicit owner approval.**

| Item | Value |
|------|--------|
| Migration | `20261113170000_dispatch_operations.sql` |
| Target | Existing Driver Supabase project (isolated `dispatch_*` tables + RLS) |
| Edge function | `supabase/functions/create-dispatch-user` |
| Auth storage (client) | `shaheen-dispatch-auth-v1` |

## What this creates

- `dispatch_portal_accounts` with roles `admin` \| `dispatcher`
- `dispatch_roster_drivers` (Dispatch-owned roster — not Compliance drivers)
- `dispatch_loads`, `dispatch_load_stops`
- `dispatch_check_calls`, `dispatch_exceptions`, `dispatch_issues`, `dispatch_shift_handovers`
- Helpers: `dispatch_can_access`, `dispatch_is_admin`, `dispatch_ensure_self`, `dispatch_set_access`

## Isolation guarantees

- Dispatchers are **not** inserted into `driver_portal_accounts`.
- Existing `driver_portal_can_access()` policies continue to deny Compliance tables.
- Invite function refuses emails that already hold a Driver Compliance seat.
- No grants to rate cards, drug tests, banking, Admin, or Personal data.

## Apply (Preview / staging first)

1. Owner approves SQL + edge function deploy.
2. Run migration in Supabase SQL editor (or CLI) on the chosen project.
3. Deploy `create-dispatch-user` with service role available to the function.
4. Sign in as `hr.compliance@gmail.com` (or first admin) on `/dispatch` to bootstrap.
5. Invite dedicated dispatcher emails; revoke via Team → Revoke.
