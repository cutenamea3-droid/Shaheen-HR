# Backup & recovery runbook (company data)

**Scope:** Driver Compliance + Admin & Attendance only. Personal (if later merged) uses a third backend — never mix restores.  
**Agents:** Do not run Production dumps or change Supabase/Cloudflare from automation unless the owner explicitly approves in that session.

---

## What to back up

### A. Must-have

1. **Driver Supabase** (project used by `VITE_SUPABASE_*` / `.env.production`)
   - `tracker_sections` (all rows)
   - `driver_portal_accounts`, `driver_portal_activity` (and rate/drug tables **after** those migrations are applied)
   - Auth users list (emails/roles) for sign-in recovery
2. **Admin Lovable Cloud** (Admin client host — **not** the Driver project)
   - `app_state` (all `user_id` rows)
   - Auth users for Admin
3. **In-app JSON (point-in-time)**
   - Driver: Download backup → `shaheen-tracker-backup-*.json`
   - Admin: Settings → Download backup → envelope `app: "hr-attendance"`
4. **Payroll CSV** archives after each closed period (`Shaheen_Payroll_Summary_*.csv`)

### B. Before risky ops

- Before enabling secure flags, applying migrations, or clearing browser data: download both JSON backups.
- If Admin shows **“Local session — cloud sync paused”**: download Admin JSON **before** signing out or clearing site data — cloud may be stale/missing those edits.

### C. Never do

- Do not restore Driver JSON into Admin (or vice versa).
- Do not create `app_state` on the Driver project to “fix” missing HR tables.
- Do not treat `src/data/seed.json` / `src/admin/data/seed.json` as live company data.
- Do not force-push / rewrite Lovable-connected history (`AGENTS.md`).

---

## Restore (human)

### Admin JSON
1. Prefer isolated preview (`scripts/preview-isolated.sh`) for dry-run.
2. Settings → Restore → file with `app === "hr-attendance"` and `employees`/`depts` arrays.
3. Confirm counts; only then consider Production restore + Supabase sign-in so `startSync` can push **if** cloud should be updated (owner decision).

### Driver JSON
1. Use in-app restore/import in Driver shell.
2. Confirm section row counts and one known driver.
3. Sign in so cloud upsert can reconcile (owner decision; LWW risk if another browser has newer data).

### Cloud PITR / dump
- Use each project’s own backup/PITR. Restore Driver and Admin independently.

---

## Smoke checklist after restore or sync fix

- [ ] Admin: Supabase sign-in → **no** “Local session — cloud sync paused” banner  
- [ ] Admin: edit attendance → sync status synced/error (not silent pause)  
- [ ] Driver: sign-in → section edit survives refresh  
- [ ] Both JSON backups downloadable  
- [ ] `VITE_PREVIEW_ISOLATED` unset on Cloudflare Production  
