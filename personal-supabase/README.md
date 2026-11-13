# Personal Supabase (HR Personal only)

**Do not apply these migrations to Driver or Admin Supabase projects.**

## Why a separate folder?

Company Driver migrations live in `supabase/migrations/`. Admin uses `drizzle/`.  
Personal SQL is isolated here so `supabase db push` against the Driver project never picks it up by accident.

## Apply (needs explicit user approval)

1. Create a **new** Supabase project (or empty Personal project).
2. In the SQL editor (or CLI pointed at that project only), run  
   `migrations/20261109000000_personal_study_secure.sql`.
3. Create your owner Auth user (Dashboard → Authentication → Users), **or** temporarily enable email signup and set `VITE_PERSONAL_ALLOW_SIGNUP=1` for first bootstrap, then disable signup.
4. On Cloudflare Pages **Preview** Build env (not committed `.env.production`):
   - `VITE_PERSONAL_SUPABASE_URL`
   - `VITE_PERSONAL_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_PERSONAL_AUTH_SECURE=1`
5. Redeploy Preview, verify `/personal`, then consider Production.

## Feature flag

When `VITE_PERSONAL_AUTH_SECURE` is unset, the app keeps the local mock gate + `hr-personal-v1` and never calls Personal cloud APIs.
