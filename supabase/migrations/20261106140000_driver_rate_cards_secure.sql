-- =============================================================================
-- DRIVER Compliance — Rate Cards (sensitive pay rates)
-- =============================================================================
-- STATUS: AWAITING SEPARATE PRODUCTION APPLY APPROVAL
-- DO NOT run against production / Admin Lovable Cloud without explicit approval.
--
-- TARGET PROJECT (Driver Compliance ONLY):
--   Client: src/integrations/supabase/client.ts  (VITE_SUPABASE_*)
--   Schema sibling of: 20261102090000_driver_full_cloud.sql
--   Documented Driver project id: okzcwctsgurumnnzuxgg
--
-- NOT THIS PROJECT (Admin & Attendance Lovable Cloud):
--   Client: src/admin/integrations/supabase/client.ts
--   Host pattern: *.lovable.cloud  /  app_state attendance JSON
--   PR #8 banking migrations must NOT be mixed with this file.
--
-- Prerequisites:
--   1. Confirm SQL Editor / CLI is connected to Driver project (not Admin).
--   2. public.driver_portal_is_admin() already exists (full cloud migration).
--   3. Backup Driver DB. Do not touch tracker_sections live rows for rates.
--
-- Design:
--   - Rate cards must NOT live in tracker_sections jsonb (broadly readable).
--   - Admin-only via SECURITY DEFINER RPCs + driver_portal_is_admin().
--   - FORCE RLS + deny-all policies; no table GRANT to authenticated.
--   - Audited upserts into driver_sensitive_audit_log (created here if missing).
--   - Blank rates omitted from jsonb — never invent 0.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS private;

-- Shared audit table (also used by drug-test migration; idempotent).
CREATE TABLE IF NOT EXISTS public.driver_sensitive_audit_log (
  id bigserial PRIMARY KEY,
  actor_id uuid,
  actor_email text,
  action text NOT NULL,
  driver_id text,
  detail text NOT NULL DEFAULT '',
  occurred_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.driver_sensitive_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_sensitive_audit_log FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.driver_sensitive_audit_log FROM PUBLIC;
REVOKE ALL ON public.driver_sensitive_audit_log FROM anon, authenticated;
GRANT ALL ON public.driver_sensitive_audit_log TO service_role;

DROP POLICY IF EXISTS driver_sensitive_audit_deny_all ON public.driver_sensitive_audit_log;
CREATE POLICY driver_sensitive_audit_deny_all ON public.driver_sensitive_audit_log
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION private.driver_sensitive_audit(
  p_action text,
  p_driver_id text,
  p_detail text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
BEGIN
  INSERT INTO public.driver_sensitive_audit_log (actor_id, actor_email, action, driver_id, detail)
  VALUES (
    auth.uid(),
    coalesce(auth.jwt() ->> 'email', ''),
    p_action,
    p_driver_id,
    coalesce(p_detail, '')
  );
END;
$$;

REVOKE ALL ON FUNCTION private.driver_sensitive_audit(text, text, text) FROM PUBLIC;

-- Strip blank string values so blank ≠ 0 and keys are absent.
CREATE OR REPLACE FUNCTION private.driver_rate_scrub_rates(p_rates jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT coalesce(
    (
      SELECT jsonb_object_agg(e.key, to_jsonb(e.value))
      FROM jsonb_each_text(coalesce(p_rates, '{}'::jsonb)) AS e
      WHERE e.value IS NOT NULL AND btrim(e.value) <> ''
    ),
    '{}'::jsonb
  );
$$;

REVOKE ALL ON FUNCTION private.driver_rate_scrub_rates(jsonb) FROM PUBLIC;

CREATE TABLE IF NOT EXISTS public.driver_rate_cards (
  driver_id text PRIMARY KEY,
  -- Decimal strings as jsonb, e.g. { "percentage": "0.550" }. Blank keys omitted.
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
REVOKE ALL ON public.driver_rate_cards FROM PUBLIC;
REVOKE ALL ON public.driver_rate_cards FROM anon, authenticated;
GRANT ALL ON public.driver_rate_cards TO service_role;

DROP POLICY IF EXISTS driver_rate_cards_deny_all ON public.driver_rate_cards;
CREATE POLICY driver_rate_cards_deny_all ON public.driver_rate_cards
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

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
  PERFORM private.driver_sensitive_audit('rate_card_view', p_driver_id, '');
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
  clean_rates jsonb := private.driver_rate_scrub_rates(p_rates);
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
    clean_rates,
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

  PERFORM private.driver_sensitive_audit('rate_card_upsert', btrim(p_driver_id), '');

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
