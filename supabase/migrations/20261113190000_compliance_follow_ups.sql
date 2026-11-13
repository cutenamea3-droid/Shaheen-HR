-- =============================================================================
-- DRIVER Compliance — Follow-Up Tracker (typed table, optional graduation)
-- =============================================================================
-- STATUS: REVIEW-ONLY — AWAITING SEPARATE PRODUCTION APPLY APPROVAL
-- DO NOT run against production without explicit human approval for THIS file.
--
-- Until applied, the app stores follow-ups durably in tracker_sections jsonb
-- under id = 'compliance_follow_ups' (same cloud path as Records). That path is
-- the active source of truth. This migration is for a future typed table +
-- optional RPC layer — not required for Batch 3 UI.
--
-- TARGET PROJECT (Driver Compliance ONLY):
--   Client: src/integrations/supabase/client.ts  (VITE_SUPABASE_*)
--   Documented Driver project id: okzcwctsgurumnnzuxgg
--
-- NOT Admin Lovable Cloud. Does not touch Attendance / Personal / Dispatch.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.compliance_follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id text NOT NULL DEFAULT '',
  driver_name text NOT NULL DEFAULT '',
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'done', 'snoozed')),
  due_date text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'applied', 'plan', 'alert')),
  section_id text NOT NULL DEFAULT '',
  doc_type text NOT NULL DEFAULT '',
  linked_row_id text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS compliance_follow_ups_status_due_idx
  ON public.compliance_follow_ups (status, due_date)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS compliance_follow_ups_driver_idx
  ON public.compliance_follow_ups (driver_id)
  WHERE deleted_at IS NULL;

ALTER TABLE public.compliance_follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_follow_ups FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.compliance_follow_ups FROM PUBLIC;
REVOKE ALL ON public.compliance_follow_ups FROM anon, authenticated;
GRANT ALL ON public.compliance_follow_ups TO service_role;

-- Deny direct table access; RPCs (future) should use SECURITY DEFINER + portal ACL.
DROP POLICY IF EXISTS compliance_follow_ups_deny_all ON public.compliance_follow_ups;
CREATE POLICY compliance_follow_ups_deny_all ON public.compliance_follow_ups
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

COMMENT ON TABLE public.compliance_follow_ups IS
  'REVIEW-ONLY Batch 3 follow-ups table. App currently uses tracker_sections compliance_follow_ups jsonb until this is applied + wired.';
