# Stabilization batches A–F

Each item: **implemented** | **needs testing** | **needs fixing** | **missing**  
Statuses relative to `main` at plan authoring (2026-11-13). Update the Status column when a batch PR merges.

---

## Batch A — Attendance cloud sync & data protection (P0)

**Constraint:** If an Attendance cloud-sync worker/PR is already active, **do not** open a competing fix. Verify and document only.

| ID | Item | Status | Acceptance |
|----|------|--------|------------|
| A1 | Empty/seed wipe guards (`hr-sync-protect`) | implemented | Unit tests in `hr-sync-protect.test.ts` stay green |
| A2 | Live symptom: “Local session — cloud sync paused…” | **needs fixing** | After Supabase Admin sign-in, banner is SyncBadge; `startSync` runs with uid |
| A3 | Local-only path cannot be default daily workflow | needs fixing | Login prefers cloud Auth; localOnly only as explicit offline fallback with warning |
| A4 | Unsynced flag + hydrate ordering | needs testing | Edit → refresh before sync completes → local retained; then push succeeds |
| A5 | Multi-device LWW / version | missing | Documented risk; optional later: honor `updated_at`/version |

**Done when:** Daily Admin users on Production never remain in paused-sync local session unintentionally; dual-browser smoke passes (see `next-pr.md`).

---

## Batch B — Driver durable HR fields (P0/P1)

| ID | Item | Status | Acceptance |
|----|------|--------|------------|
| B1 | Hire date in AppData | implemented | Survives reload + cloud pull |
| B2 | Drug Test UI + admin nav | implemented | Route `/drug-tests` admin-only |
| B3 | Drug Test SQL apply (Driver project only) | missing (ops) | Human applies `20261106140100_driver_drug_tests_secure.sql` after backup |
| B4 | Enable `VITE_DRIVER_DRUG_TESTS_SECURE=1` | missing (ops) | Preview first; save/list/soft-delete work; ordinary user denied |
| B5 | Rate card SQL apply | missing (ops) | Human applies `20261106140000_driver_rate_cards_secure.sql` |
| B6 | Enable `VITE_DRIVER_RATE_CARD_SECURE=1` | missing (ops) | Rates survive reload; absent from `tracker_sections` |
| B7 | Leave flags off if SQL not applied | implemented | Default mock / saves disabled |

**Done when:** Admins can permanently store drug tests then rate cards on Driver Supabase with flags on; hire/docs unchanged.

---

## Batch C — AuthZ & confidential data (P1)

| ID | Item | Status | Acceptance |
|----|------|--------|------------|
| C1 | Dual clients / no shared DB | implemented | AGENTS.md + separate clients |
| C2 | Soft Admin local session | needs fixing | Tied to A2/A3; no silent cloud pause |
| C3 | Client-only AdminOnly | needs testing | Confirm RLS/RPC deny non-admins for rate/drug; document tracker_sections write scope |
| C4 | Banking reveal/ciphertext | missing on main | Only via PR #8 after approval |
| C5 | Password hashes in localStorage | needs fixing (later) | Prefer cloud Auth-only for Production daily use |

---

## Batch D — Env, backup, recovery (P1)

| ID | Item | Status | Acceptance |
|----|------|--------|------------|
| D1 | CF Production: `VITE_PREVIEW_ISOLATED` unset | needs testing | Operator checklist |
| D2 | In-app JSON backup Driver + Admin | implemented | Download buttons work |
| D3 | In-repo backup/DR runbook | missing → see `backup-recovery.md` | Runbook merged |
| D4 | Dual-cloud dump verified | needs testing | Human confirms Driver + Admin project backups |
| D5 | Restore drill | missing | Restore sample JSON in isolated preview without touching prod |

---

## Batch E — Gated product PRs (P2 — do not auto-merge)

| ID | Item | Status | Acceptance |
|----|------|--------|------------|
| E1 | PR #8 finance | missing on main / conflicts | Rebase; mock OK; secure only after Admin SQL + vault + flag |
| E2 | PR #16 Personal secure | missing on main | Personal project + migrations + `VITE_PERSONAL_*` Preview |
| E3 | PR #17 VU recovery | missing on main | After #16; does not block company ops |
| E4 | PR #11 | conflicts / superseded | Close or ignore once #16 chosen |

---

## Batch F — CI & regression (P1 cheap wins)

| ID | Item | Status | Acceptance |
|----|------|--------|------------|
| F1 | `bun run test` locally | implemented | Vitest suite |
| F2 | GitHub Actions on PR | missing | test + build on PR |
| F3 | `tsc --noEmit` script | missing | package.json script + CI step |
| F4 | localOnly / sync banner regression test | missing | Add with Batch A fix PR |
| F5 | Keep stabilization docs updated | needs testing | Each batch PR updates Status column |

---

## Suggested PR sequence (no merge without owner)

1. **Attendance sync fix** — existing worker only (Batch A).  
2. **Docs:** backup runbook + this plan (may already be merged).  
3. **CI workflow** (Batch F2/F3) — no prod risk.  
4. **Ops:** drug SQL → flag (B3–B4), then rate SQL → flag (B5–B6).  
5. **Auth hygiene** leftovers (C) if not included in A.  
6. **#8 / Personal** only with explicit approval (E).
