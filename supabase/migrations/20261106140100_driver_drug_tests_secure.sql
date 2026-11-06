-- =============================================================================
-- DRIVER Compliance — Drug Test event register (sensitive)
-- =============================================================================
-- STATUS: AWAITING SEPARATE PRODUCTION APPLY APPROVAL
-- DO NOT run against production without explicit human approval for THIS file.
--
-- Design:
--   - Events must NOT live in tracker_sections jsonb / AppData localStorage.
--   - Admin-only via SECURITY DEFINER RPCs + driver_portal_is_admin().
--   - Audited mutations. Specimen IDs stored as text (leading zeros preserved).
--   - Pairing is application-side only; Matched ≠ Negative / clearance.
--   - Additive only — does not alter medical, docs, or Other Documents.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS public.driver_drug_test_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id text NOT NULL,
  kind text CHECK (kind IS NULL OR kind IN ('federal_drug', 'medical_review')),
  specimen_id text,
  reason text,
  collection_context text,
  event_date text,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS driver_drug_test_events_driver_idx
  ON public.driver_drug_test_events (driver_id, created_at DESC);

ALTER TABLE public.driver_drug_test_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_drug_test_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.driver_drug_test_events FROM PUBLIC;
REVOKE ALL ON public.driver_drug_test_events FROM anon, authenticated;
GRANT ALL ON public.driver_drug_test_events TO service_role;

DROP POLICY IF EXISTS driver_drug_test_events_deny_all ON public.driver_drug_test_events;
CREATE POLICY driver_drug_test_events_deny_all ON public.driver_drug_test_events
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

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

CREATE OR REPLACE FUNCTION public.driver_drug_test_list(p_driver_id text)
RETURNS SETOF public.driver_drug_test_events
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.driver_portal_is_admin() THEN
    RAISE EXCEPTION 'Admin Driver Compliance account required for drug test records.';
  END IF;
  PERFORM private.driver_sensitive_audit('drug_test_list', p_driver_id, '');
  RETURN QUERY
  SELECT *
  FROM public.driver_drug_test_events e
  WHERE e.driver_id = p_driver_id
  ORDER BY e.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.driver_drug_test_add(
  p_driver_id text,
  p_kind text,
  p_specimen_id text,
  p_reason text,
  p_collection_context text,
  p_event_date text,
  p_notes text
)
RETURNS SETOF public.driver_drug_test_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  new_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.driver_portal_is_admin() THEN
    RAISE EXCEPTION 'Admin Driver Compliance account required for drug test records.';
  END IF;
  IF p_driver_id IS NULL OR btrim(p_driver_id) = '' THEN
    RAISE EXCEPTION 'driver_id required';
  END IF;

  INSERT INTO public.driver_drug_test_events (
    driver_id, kind, specimen_id, reason, collection_context, event_date, notes, created_by
  ) VALUES (
    btrim(p_driver_id),
    nullif(btrim(coalesce(p_kind, '')), ''),
    -- text: preserve leading zeros; never cast to numeric
    nullif(p_specimen_id, ''),
    nullif(p_reason, ''),
    nullif(p_collection_context, ''),
    nullif(p_event_date, ''),
    coalesce(p_notes, ''),
    auth.uid()
  )
  RETURNING id INTO new_id;

  PERFORM private.driver_sensitive_audit('drug_test_add', p_driver_id, new_id::text);

  RETURN QUERY SELECT * FROM public.driver_drug_test_events WHERE id = new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.driver_drug_test_update(
  p_id uuid,
  p_kind text DEFAULT NULL,
  p_specimen_id text DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_collection_context text DEFAULT NULL,
  p_event_date text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS SETOF public.driver_drug_test_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  did text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.driver_portal_is_admin() THEN
    RAISE EXCEPTION 'Admin Driver Compliance account required for drug test records.';
  END IF;

  UPDATE public.driver_drug_test_events e
  SET
    kind = COALESCE(nullif(btrim(coalesce(p_kind, '')), ''), e.kind),
    specimen_id = COALESCE(p_specimen_id, e.specimen_id),
    reason = COALESCE(p_reason, e.reason),
    collection_context = COALESCE(p_collection_context, e.collection_context),
    event_date = COALESCE(p_event_date, e.event_date),
    notes = COALESCE(p_notes, e.notes),
    updated_at = now()
  WHERE e.id = p_id
  RETURNING e.driver_id INTO did;

  IF did IS NULL THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  PERFORM private.driver_sensitive_audit('drug_test_update', did, p_id::text);
  RETURN QUERY SELECT * FROM public.driver_drug_test_events WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.driver_drug_test_delete(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  did text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.driver_portal_is_admin() THEN
    RAISE EXCEPTION 'Admin Driver Compliance account required for drug test records.';
  END IF;
  DELETE FROM public.driver_drug_test_events WHERE id = p_id RETURNING driver_id INTO did;
  IF did IS NOT NULL THEN
    PERFORM private.driver_sensitive_audit('drug_test_delete', did, p_id::text);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.driver_drug_test_list(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.driver_drug_test_add(text, text, text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.driver_drug_test_update(uuid, text, text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.driver_drug_test_delete(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.driver_drug_test_list(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.driver_drug_test_add(text, text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.driver_drug_test_update(uuid, text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.driver_drug_test_delete(uuid) TO authenticated;
