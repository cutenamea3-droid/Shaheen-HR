# Admin Attendance — backup & cloud sync guidance

**System:** Admin & Attendance (`/admin`) only — Lovable Cloud `app_state`, **not** Driver Supabase.  
**Audience:** Owner / operator. No Production SQL or secret changes in this doc.

---

## What is durable where

| Copy | Location | Durable across devices? |
|------|----------|-------------------------|
| Cloud SoT | Admin Lovable Cloud table `public.app_state` (row per Auth `user_id`) | Yes, after **Cloud Saved** |
| Browser cache | `localStorage` key `hr-attendance-v1` | This browser only |
| Pending flags | `hr-attendance-unsynced`, `hr-attendance-local-only` | This browser only |
| JSON backup file | Downloaded via **Backup** / Settings | Offline file you control |

Sync blob keys: `depts`, `employees`, `records`, `perf`, `tasks`, `settings`, `team`, `logs`.

---

## Status indicators (top bar)

| Label | Meaning |
|-------|---------|
| **Cloud Saved** | Last confirmed upsert to `app_state` succeeded |
| **Saving** | Push in flight |
| **Not Synced** | Local edits pending, connecting, or waiting on a conflict choice |
| **Connection Error** | Network/Auth/API failure — local kept; retry |
| **Sign In Required** | Local session / no Supabase JWT — cloud sync paused |

If this browser and cloud both have different meaningful attendance while pending, a conflict panel appears: download backup → **Keep this browser (upload)** or **Use cloud (replace this browser)**. Nothing overwrites until you choose.

---

## Recommended backup drill

1. Sign in to `/admin` with Supabase so the badge can reach **Cloud Saved** (not Sign In Required).
2. Click **Backup** (top bar) or Settings → **Download backup**. Keep the JSON offline.
3. Open the file: top-level `app` must be `"hr-attendance"`, `version` `1`, and `data` must include the eight keys above.
4. Optional restore drill on a **non-production** browser profile only: Restore → confirm dialog → wait for sync status. Restore **replaces** dashboard data by design.

Download a backup **before** resolving a conflict toward “Use cloud”, and before clearing site data.

---

## Do / don’t

| Do | Don’t |
|----|-------|
| Reconnect from the browser that has the latest offline edits when pending | Clear cookies/localStorage before Connect cloud sync |
| Use **Connect cloud sync** / Supabase password when you see Sign In Required | Treat Driver Supabase project as Attendance storage |
| Keep periodic JSON backups even when Cloud Saved | Assume unit tests prove live Production persistence |
| Confirm Cloudflare Production does **not** set `VITE_PREVIEW_ISOLATED=1` | Auto-merge conflicting local and cloud without choosing |

---

## Related code

- Client: `src/admin/integrations/supabase/client.ts` (hardcoded Admin Lovable host)
- Sync: `src/admin/lib/cloud-sync.ts`, protect: `src/admin/lib/hr-sync-protect.ts`
- Backup UI: `src/admin/components/hr/Settings.tsx` (`downloadBackup` / `restoreBackup`)
