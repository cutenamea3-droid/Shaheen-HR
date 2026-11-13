# Exact next implementation PR

## Stop — Attendance sync ownership

If worker/PR for Admin cloud sync is in flight (historically `bc-345e8090-eb71-5094-a266-d2e7795ce858`), **do not** open another PR editing:

- `src/admin/AdminApp.tsx` (auth bootstrap / `localOnly`)
- `src/admin/lib/cloud-sync.ts`
- `src/admin/lib/hr-auth-local.ts`
- `src/admin/lib/hr-login.ts`

Rebase later work onto that fix.

---

## Highest-ROI first code PR (after A lands, or if A already merged)

**Suggested title:** `fix(admin): ensure Supabase session keeps attendance cloud sync active`

**Problem:** Banner “Local session — cloud sync paused until you sign in with Supabase.” means `localOnly === true` and `stopSync()` — daily edits never reach `app_state`.

**Goals:**
1. Production daily path always uses Supabase Auth session for Admin when network/Auth available.
2. Local password path either upgrades to cloud session or shows a blocking warning that data will not sync.
3. Regression test so the paused-sync banner cannot return unnoticed.

**Out of scope:** Driver rate/drug SQL, Personal, PR #8, CF Production secret changes, merging other PRs.

### Acceptance tests

1. **Cloud login:** Sign in with Admin Supabase user → SyncBadge visible; banner text absent.  
2. **Round-trip:** Change one attendance field → within ~10s status synced (or explicit error); second browser same user sees value after pull.  
3. **Refresh:** Reload while signed in → still cloud session; sync resumes; no stuck localOnly.  
4. **Protect unchanged:** Seed/empty local still must not wipe/push over meaningful cloud (`hr-sync-protect` tests green).  
5. **Preview isolated:** `VITE_PREVIEW_ISOLATED=1` still local-only by design.  
6. **Commands:** `bun run test` and `bun run build` pass.

### Parallel / next if A blocked

| PR | Why |
|----|-----|
| CI: vitest + build on PR (Batch F) | No prod risk; catches regressions |
| Docs-only backup drill updates | Already started in this plan folder |
| Ops checklist PR for drug-test flag enablement | Code ready; needs human SQL first |

---

## After A + backups

1. Owner applies Driver drug SQL → set `VITE_DRIVER_DRUG_TESTS_SECURE=1` on Preview → smoke → Production.  
2. Same for rate cards.  
3. Only then consider #8 / Personal with separate approvals.
