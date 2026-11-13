-- REVIEW ONLY — do not apply without separate owner approval.
-- Admin Lovable Cloud only. Optional durable tables for month closing,
-- HR reminders, performance follow-ups, and audit history.
-- Default app path uses dedicated browser keys (not app_state / HR_SYNC_KEYS).
-- Closing ≠ Paid — these tables must never update salary payment status.

-- Placeholder schema for future secure enable (flag-gated). Not applied in Batch 11B.

-- Example (commented): 
-- create table if not exists public.hr_month_closing (
--   month text primary key,
--   status text not null check (status in ('open','closed')),
--   closed_at timestamptz,
--   closed_by text,
--   reopen_reason text,
--   reopened_at timestamptz,
--   reopened_by text
-- );
-- alter table public.hr_month_closing enable row level security;

select 1; -- no-op so the file is valid SQL for review tooling
