-- Batch 9 — Dispatch closeout (review-only; do NOT apply to Production
-- without Yousaf’s explicit approval). Extends Batch 7/8 schema.
-- Adds: closeout/reopen + payment_status on loads, accessorials, communications.
-- HARD: Delivered ≠ Closed ≠ Paid. No invented rates/free-time.
-- Never auto-writes Admin expenses/payroll. No external notifications.

-- ---------------------------------------------------------------------------
-- 1) Load closeout / reopen / payment (payment independent of closed)
-- ---------------------------------------------------------------------------
ALTER TABLE public.dispatch_loads
  ADD COLUMN IF NOT EXISTS closeout_note text;

ALTER TABLE public.dispatch_loads
  ADD COLUMN IF NOT EXISTS closed_at timestamptz;

ALTER TABLE public.dispatch_loads
  ADD COLUMN IF NOT EXISTS reopen_reason text;

ALTER TABLE public.dispatch_loads
  ADD COLUMN IF NOT EXISTS reopened_at timestamptz;

ALTER TABLE public.dispatch_loads
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'dispatch_loads_payment_status_check'
  ) THEN
    ALTER TABLE public.dispatch_loads
      ADD CONSTRAINT dispatch_loads_payment_status_check
      CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'not_applicable'));
  END IF;
END $$;

COMMENT ON COLUMN public.dispatch_loads.closeout_note IS
  'Manual closeout note required when status=closed. Delivered ≠ Closed.';
COMMENT ON COLUMN public.dispatch_loads.payment_status IS
  'Payment tracking independent of status. Closing never marks paid; paying never closes.';
COMMENT ON COLUMN public.dispatch_loads.reopen_reason IS
  'Manual reason when reopening closed → delivered.';

-- ---------------------------------------------------------------------------
-- 2) Detention / accessorials (manual amounts — no rate/free-time invention)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dispatch_accessorials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  load_id uuid NOT NULL REFERENCES public.dispatch_loads(id) ON DELETE CASCADE,
  kind text NOT NULL
    CHECK (kind IN ('detention', 'layover', 'lumper', 'tonu', 'other')),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'approved', 'denied', 'paid', 'void')),
  description text NOT NULL,
  amount_manual numeric(12, 2),
  hours_manual numeric(8, 2),
  free_time_note text,
  currency text NOT NULL DEFAULT 'USD',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dispatch_accessorials_description_len CHECK (char_length(btrim(description)) BETWEEN 1 AND 500),
  CONSTRAINT dispatch_accessorials_amount_nonneg CHECK (amount_manual IS NULL OR amount_manual >= 0),
  CONSTRAINT dispatch_accessorials_hours_nonneg CHECK (hours_manual IS NULL OR hours_manual >= 0)
);

CREATE INDEX IF NOT EXISTS dispatch_accessorials_load_idx
  ON public.dispatch_accessorials (load_id);
CREATE INDEX IF NOT EXISTS dispatch_accessorials_status_idx
  ON public.dispatch_accessorials (status);

ALTER TABLE public.dispatch_accessorials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_accessorials FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.dispatch_accessorials FROM PUBLIC;
REVOKE ALL ON public.dispatch_accessorials FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.dispatch_accessorials TO authenticated;
GRANT ALL ON public.dispatch_accessorials TO service_role;

DROP POLICY IF EXISTS dispatch_accessorials_select ON public.dispatch_accessorials;
DROP POLICY IF EXISTS dispatch_accessorials_insert ON public.dispatch_accessorials;
DROP POLICY IF EXISTS dispatch_accessorials_update ON public.dispatch_accessorials;
CREATE POLICY dispatch_accessorials_select ON public.dispatch_accessorials
  FOR SELECT TO authenticated USING (public.dispatch_can_access());
CREATE POLICY dispatch_accessorials_insert ON public.dispatch_accessorials
  FOR INSERT TO authenticated WITH CHECK (public.dispatch_can_access());
CREATE POLICY dispatch_accessorials_update ON public.dispatch_accessorials
  FOR UPDATE TO authenticated
  USING (public.dispatch_can_access())
  WITH CHECK (public.dispatch_can_access());

DROP TRIGGER IF EXISTS dispatch_accessorials_touch ON public.dispatch_accessorials;
CREATE TRIGGER dispatch_accessorials_touch
BEFORE UPDATE ON public.dispatch_accessorials
FOR EACH ROW EXECUTE FUNCTION public.dispatch_touch_updated_at();

COMMENT ON TABLE public.dispatch_accessorials IS
  'Detention/accessorial claims. Manual amount/hours only — never invent rates/free-time; never auto HR expense/payroll.';

-- ---------------------------------------------------------------------------
-- 3) Communication & decision history (desk log — no external notify)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dispatch_communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  load_id uuid NOT NULL REFERENCES public.dispatch_loads(id) ON DELETE CASCADE,
  kind text NOT NULL
    CHECK (kind IN ('call', 'email_note', 'decision', 'note')),
  summary text NOT NULL,
  detail text,
  decided_action text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dispatch_communications_summary_len CHECK (char_length(btrim(summary)) BETWEEN 1 AND 240)
);

CREATE INDEX IF NOT EXISTS dispatch_communications_load_idx
  ON public.dispatch_communications (load_id);
CREATE INDEX IF NOT EXISTS dispatch_communications_created_idx
  ON public.dispatch_communications (created_at DESC);

ALTER TABLE public.dispatch_communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_communications FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.dispatch_communications FROM PUBLIC;
REVOKE ALL ON public.dispatch_communications FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.dispatch_communications TO authenticated;
GRANT ALL ON public.dispatch_communications TO service_role;

DROP POLICY IF EXISTS dispatch_communications_select ON public.dispatch_communications;
DROP POLICY IF EXISTS dispatch_communications_insert ON public.dispatch_communications;
DROP POLICY IF EXISTS dispatch_communications_update ON public.dispatch_communications;
CREATE POLICY dispatch_communications_select ON public.dispatch_communications
  FOR SELECT TO authenticated USING (public.dispatch_can_access());
CREATE POLICY dispatch_communications_insert ON public.dispatch_communications
  FOR INSERT TO authenticated WITH CHECK (public.dispatch_can_access());
CREATE POLICY dispatch_communications_update ON public.dispatch_communications
  FOR UPDATE TO authenticated
  USING (public.dispatch_can_access())
  WITH CHECK (public.dispatch_can_access());

COMMENT ON TABLE public.dispatch_communications IS
  'Communication & decision history. Desk log only — never sends email/SMS/push.';
