-- =============================================================================
-- DRIVER Compliance — Rate Cards (sensitive pay rates)
-- =============================================================================
-- STATUS: AWAITING SEPARATE PRODUCTION APPLY APPROVAL
-- DO NOT run against production / Lovable Cloud / Driver Supabase without
-- explicit human approval for THIS migration.
--
-- Backend: Driver project used by src/integrations/supabase/client.ts
--          (NOT the Admin Attendance project).
--
-- Design:
--   - Rate cards must NOT live in tracker_sections jsonb (broadly readable).
--   - Admin-only SELECT/UPSERT via SECURITY DEFINER RPCs + driver_portal_is_admin().
--   - Standard portal accounts cannot read rate rows.
--   - Additive only; does not alter tracker_sections, medical, docs, or attendance.
--   - Blank rates stay NULL/absent — never invent 0.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.driver_rate_cards (
  driver_id text PRIMARY KEY,
  -- Optional decimal strings as jsonb object { "loadedCpm": "0.550", ... }.
  -- Omit keys or use empty string for blank (blank ≠ 0).
  rates jsonb NOT NULL DEFAULT '{}'::jsonb,
  pay_method text
    CHECK (pay_method IS NULL OR pay_method IN (
      'per_mile', 'percentage', 'hourly', 'salary', 'combination', 'other'
    )),
  pay_method_note text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.driver_rate_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_rate_cards FORCE ROW LEVEL SECURITY;

-- No direct table grants to authenticated — access only via RPCs below.
REVOKE ALL ON public.driver_rate_cards FROM PUBLIC;
REVOKE ALL ON public.driver_rate_cards FROM anon, authenticated;
GRANT ALL ON public.driver_rate_cards TO service_role;

-- Deny-all policies (belt + suspenders); RPCs use SECURITY DEFINER.
DROP POLICY IF EXISTS driver_rate_cards_deny_all ON public.driver_rate_cards;
CREATE POLICY driver_rate_cards_deny_all ON public.driver_rate_cards
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- 2) RPCs — admin only
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.driver_rate_card_get(p_driver_id text)
RETURNS TABLE (
  driver_id text,
  rates jsonb,
  pay_method text,
  pay_method_note text,
  updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.driver_portal_is_admin() THEN
    RAISE EXCEPTION 'Admin Driver Compliance account required for rate cards.';
  END IF;
  RETURN QUERY
  SELECT r.driver_id, r.rates, r.pay_method, r.pay_method_note, r.updated_at
  FROM public.driver_rate_cards r
  WHERE r.driver_id = p_driver_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.driver_rate_card_upsert(
  p_driver_id text,
  p_rates jsonb,
  p_pay_method text,
  p_pay_method_note text
)
RETURNS TABLE (
  driver_id text,
  rates jsonb,
  pay_method text,
  pay_method_note text,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  clean_method text := nullif(btrim(coalesce(p_pay_method, '')), '');
  clean_note text := coalesce(p_pay_method_note, '');
BEGIN
  IF auth.uid() IS NULL OR NOT public.driver_portal_is_admin() THEN
    RAISE EXCEPTION 'Admin Driver Compliance account required for rate cards.';
  END IF;
  IF p_driver_id IS NULL OR btrim(p_driver_id) = '' THEN
    RAISE EXCEPTION 'driver_id required';
  END IF;
  IF clean_method IS NOT NULL AND clean_method NOT IN (
    'per_mile', 'percentage', 'hourly', 'salary', 'combination', 'other'
  ) THEN
    RAISE EXCEPTION 'Invalid pay_method';
  END IF;

  INSERT INTO public.driver_rate_cards AS t (
    driver_id, rates, pay_method, pay_method_note, updated_at, updated_by
  ) VALUES (
    btrim(p_driver_id),
    coalesce(p_rates, '{}'::jsonb),
    clean_method,
    clean_note,
    now(),
    auth.uid()
  )
  ON CONFLICT (driver_id) DO UPDATE SET
    rates = excluded.rates,
    pay_method = excluded.pay_method,
    pay_method_note = excluded.pay_method_note,
    updated_at = now(),
    updated_by = auth.uid();

  RETURN QUERY
  SELECT r.driver_id, r.rates, r.pay_method, r.pay_method_note, r.updated_at
  FROM public.driver_rate_cards r
  WHERE r.driver_id = btrim(p_driver_id);
END;
$$;

REVOKE ALL ON FUNCTION public.driver_rate_card_get(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.driver_rate_card_upsert(text, jsonb, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.driver_rate_card_get(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.driver_rate_card_upsert(text, jsonb, text, text) TO authenticated;
