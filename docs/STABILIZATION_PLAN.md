# Shaheen HR — Stabilization Plan (tracked)

**Purpose:** Continue work in future Cursor sessions **without re-scanning** the whole repo.  
**Baseline:** `main` @ audit date 2026-11-13 (`61a3dfa` when plan was authored).  
**Rules:** Preserve Driver Compliance + Admin Attendance data sources. No Production SQL/secrets/merge/deploy without explicit owner approval. Do not merge unrelated open PRs.

Full narrative audit (Agent Store): ask coordinator for `docs/shaheen-final-stabilization-audit.md`.

---

## Health snapshot

| Signal | State |
|--------|--------|
| Daily Driver compliance editing | Working (cloud `tracker_sections`) |
| Daily Admin attendance | **AT RISK** if banner shows local session (sync paused) |
| Rate cards / drug tests durable | Not enabled (flags off; SQL await apply) |
| Banking / Personal | Not on `main` (open PRs) |
| CI | None in-repo |

### CRITICAL — do not ignore

**Symptom:** Admin UI shows **“Local session — cloud sync paused until you sign in with Supabase.”**  
**Code:** `src/admin/AdminApp.tsx` (`localOnly` → `stopSync()`; banner ~L431–435).  
**Effect:** Edits stay in `hr-attendance-v1` only; no `app_state` upsert.  
**Ownership:** Attendance cloud-sync worker may already be fixing this — **do not open a competing Attendance sync PR**. Rebase onto that work before touching Admin sync/auth bootstrap.

---

## Architecture invariants (never break)

1. Two systems: Driver (`src/`, routes `/`, `/drivers`, `/s/*`, …) and Admin (`src/admin/`, `/admin`).
2. Separate Supabase clients/backends — never share stores or DB clients (`AGENTS.md`).
3. Banking / rate / drug secure data must **not** enter `tracker_sections` or Admin `app_state` jsonb.
4. Feature flags default **off** until human applies matching SQL on the correct project.

---

## Data map (quick)

| System | Cloud SoT | Browser cache | Notes |
|--------|-----------|---------------|-------|
| Driver compliance | `tracker_sections` | `shaheen-driver-tracker-v1` | LWW upserts |
| Driver portal | `driver_portal_*` | `shaheen-driver-portal-*` | Local fallback if cloud fails |
| Rate / drug secure | Dedicated tables/RPCs | none (mock = memory) | Flags `VITE_DRIVER_*_SECURE` |
| Admin attendance | Lovable `app_state` | `hr-attendance-v1` | Protect module on main |
| Personal | N/A on main | N/A | PRs #11/#16/#17 |

Env flags (see `.env.example`): `VITE_PREVIEW_ISOLATED`, `VITE_DRIVER_RATE_CARD_SECURE`, `VITE_DRIVER_DRUG_TESTS_SECURE`. Never set preview-isolated on Cloudflare Production.

---

## Open PRs (stability-relevant)

| PR | Topic | Action |
|----|-------|--------|
| #8 | Banking / salary | Rebase after approval; keep mock until Admin SQL + vault |
| #11 | Personal prototype | Prefer #16; conflicts |
| #16 | Personal secure | Merge only after Personal project + secrets |
| #17 | VU Today | Study UX; low company-ops priority |

---

## Batches A–F (execute in order)

Detail + acceptance tests: [`docs/stabilization/batches.md`](./stabilization/batches.md)  
Backup drill: [`docs/stabilization/backup-recovery.md`](./stabilization/backup-recovery.md)  
First PR template: [`docs/stabilization/next-pr.md`](./stabilization/next-pr.md)

| Batch | Focus | Priority |
|-------|--------|----------|
| **A** | Attendance cloud re-attach + sync protect verification | P0 |
| **B** | Driver drug then rate durable enablement (human SQL) | P0/P1 |
| **C** | AuthZ / local-session hygiene | P1 |
| **D** | CF env confirm + backup/DR drills | P1 |
| **E** | Gated product PRs (#8, Personal) | P2 |
| **F** | CI + regression tests | P1 (cheap) |

Prefer reliability / data protection / daily use over decoration.

---

## Session bootstrap (future agents)

1. `git fetch origin main && git checkout main && git pull`
2. Read this file + `docs/stabilization/batches.md`
3. `gh pr list --state open` — do not merge unrelated PRs
4. If Batch A still open, check for existing Attendance sync PR/worker before coding
5. Work on `cursor/<name>-f369`; docs or small batches; push; open focused PR; **do not merge** unless owner asks
