# Compliance Follow-Ups — operator checklist

**Status:** review-only — awaiting separate production apply approval.  
**Do not** apply this migration, merge, or deploy without explicit approval.

## Active durable path (Batch 3)

| Path | Role |
|------|------|
| `tracker_sections` row id `compliance_follow_ups` | **Current source of truth** (jsonb section blob, same cloud flush as Records) |
| Browser `localStorage` | Cache only — **never** SoT for follow-ups |

## Optional typed table (this folder)

| Path | Role |
|------|------|
| `20261113190000_compliance_follow_ups.sql` | Future typed table + FORCE RLS deny-all (RPC graduation later) |
| This README | Operator gate |

## Target vs Admin

| | Driver Compliance | Admin & Attendance |
|--|-------------------|--------------------|
| Client | `src/integrations/supabase/client.ts` | `src/admin/integrations/supabase/client.ts` |
| This migration | **YES (when approved)** | **NO** |

## Before apply

1. Confirm SQL Editor is the **Driver** project (not Admin Lovable).
2. Backup Driver data.
3. Confirm app still works with jsonb section if table apply is deferred.
4. Do **not** clear localStorage or wipe `tracker_sections`.

## After apply (future wiring)

1. Add SECURITY DEFINER list/upsert RPCs gated by `driver_portal_can_access()`.
2. Migrate jsonb rows → typed table once.
3. Only then point the client at the table/RPCs.
