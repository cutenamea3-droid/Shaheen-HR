-- Batch 8 — Dispatch operational controls (review-only; do NOT apply to Production
-- without Yousaf’s explicit approval). Extends Batch 7 / 20261113170000 schema.
-- Adds: cancel/reschedule notes on loads, Senior Informed on issues, follow-ups table.
-- Does NOT invent docs, ETAs, HOS, availability, or notifications.

-- ---------------------------------------------------------------------------
-- 1) Load cancel / reschedule desk notes
-- ---------------------------------------------------------------------------
ALTER TABLE public.dispatch_loads
  ADD COLUMN IF NOT EXISTS cancel_reason text;

ALTER TABLE public.dispatch_loads
  ADD COLUMN IF NOT EXISTS reschedule_note text;

COMMENT ON COLUMN public.dispatch_loads.cancel_reason IS
  'Manual cancel reason required when status=cancelled. Desk record only.';
COMMENT ON COLUMN public.dispatch_loads.reschedule_note IS
  'Manual reschedule note. Never invent ETAs or GPS.';

-- ---------------------------------------------------------------------------
-- 2) Issues — Senior Informed (manual record only; no auto-notify)
-- ---------------------------------------------------------------------------
ALTER TABLE public.dispatch_issues
  ADD COLUMN IF NOT EXISTS senior_informed boolean NOT NULL DEFAULT false;

ALTER TABLE public.dispatch_issues
  ADD COLUMN IF NOT EXISTS senior_informed_at timestamptz;

ALTER TABLE public.dispatch_issues
  ADD COLUMN IF NOT EXISTS senior_informed_note text;

COMMENT ON COLUMN public.dispatch_issues.senior_informed IS
  'Manual desk checkbox that senior was informed. Never sends notifications.';

-- ---------------------------------------------------------------------------
-- 3) Follow-up reminders (desk list — not push/email)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dispatch_follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  load_id uuid REFERENCES public.dispatch_loads(id) ON DELETE SET NULL,
  title text NOT NULL,
  notes text,
  due_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'done', 'cancelled')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dispatch_follow_ups_title_len CHECK (char_length(btrim(title)) BETWEEN 1 AND 160)
);

CREATE INDEX IF NOT EXISTS dispatch_follow_ups_due_idx
  ON public.dispatch_follow_ups (due_at);
CREATE INDEX IF NOT EXISTS dispatch_follow_ups_status_idx
  ON public.dispatch_follow_ups (status);
CREATE INDEX IF NOT EXISTS dispatch_follow_ups_load_idx
  ON public.dispatch_follow_ups (load_id);

ALTER TABLE public.dispatch_follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_follow_ups FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.dispatch_follow_ups FROM PUBLIC;
REVOKE ALL ON public.dispatch_follow_ups FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.dispatch_follow_ups TO authenticated;
GRANT ALL ON public.dispatch_follow_ups TO service_role;

DROP POLICY IF EXISTS dispatch_follow_ups_select ON public.dispatch_follow_ups;
DROP POLICY IF EXISTS dispatch_follow_ups_insert ON public.dispatch_follow_ups;
DROP POLICY IF EXISTS dispatch_follow_ups_update ON public.dispatch_follow_ups;
CREATE POLICY dispatch_follow_ups_select ON public.dispatch_follow_ups
  FOR SELECT TO authenticated USING (public.dispatch_can_access());
CREATE POLICY dispatch_follow_ups_insert ON public.dispatch_follow_ups
  FOR INSERT TO authenticated WITH CHECK (public.dispatch_can_access());
CREATE POLICY dispatch_follow_ups_update ON public.dispatch_follow_ups
  FOR UPDATE TO authenticated
  USING (public.dispatch_can_access())
  WITH CHECK (public.dispatch_can_access());

DROP TRIGGER IF EXISTS dispatch_follow_ups_touch ON public.dispatch_follow_ups;
CREATE TRIGGER dispatch_follow_ups_touch
BEFORE UPDATE ON public.dispatch_follow_ups
FOR EACH ROW EXECUTE FUNCTION public.dispatch_touch_updated_at();

COMMENT ON TABLE public.dispatch_follow_ups IS
  'Desk follow-up reminders. Manual list only — not a notification system.';
