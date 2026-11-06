-- =============================================================================
-- DRIVER Compliance — Drug Test event register (sensitive)
-- =============================================================================
-- STATUS: AWAITING SEPARATE PRODUCTION APPLY APPROVAL
-- DO NOT run against production without explicit human approval for THIS file.
--
-- TARGET PROJECT (Driver Compliance ONLY):
--   Client: src/integrations/supabase/client.ts  (VITE_SUPABASE_*)
--   Documented Driver project id: okzcwctsgurumnnzuxgg
--   Apply AFTER 20261106140000_driver_rate_cards_secure.sql (shares audit helper)
--     OR ensure private.driver_sensitive_audit + audit table already exist.
--
-- NOT Admin Lovable Cloud (src/admin/… / *.lovable.cloud / PR #8 banking).
--
-- Design / changes (vs earlier draft):
--   - Events must NOT live in tracker_sections jsonb / AppData localStorage.
--   - Admin-only via SECURITY DEFINER RPCs + driver_portal_is_admin().
--   - testing_event_id groups FD+MR for ONE collection/testing event
--     (multi Random / Follow-up stay independent via distinct ids).
--   - Safeguards: testing_event_id cannot span drivers; one active testing
--     event has at most one Federal Drug and one Medical Review (partial unique
--     index + RPC assert). Soft-deleted rows do not count.
--   - Soft-delete only (deleted_at) — recoverable; no permanent hard DELETE.
--   - Corrections (update) audited with before/after detail.
--   - Incomplete rows remain editable.
--   - VOLATILITY: driver_drug_test_list is VOLATILE (not STABLE) because it
--     writes an audit row. STABLE+write is incorrect.
--   - Additive only — does not alter medical, docs, hire, or Other Documents.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS public.driver_drug_test_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id text NOT NULL,
  -- Groups FD + MR for one individual testing event (not just driver/reason/specimen).
  testing_event_id uuid NOT NULL DEFAULT gen_random_uuid(),
  kind text CHECK (kind IS NULL OR kind IN ('federal_drug', 'medical_review')),
  specimen_id text,
  reason text,
  collection_context text,
  event_date text,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Soft-delete (recoverable). Hard DELETE of history is not used by RPCs.
  deleted_at timestamptz,
  deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Idempotent column adds if an older draft of this table already exists.
ALTER TABLE public.driver_drug_test_events
  ADD COLUMN IF NOT EXISTS testing_event_id uuid;
ALTER TABLE public.driver_drug_test_events
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.driver_drug_test_events
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

UPDATE public.driver_drug_test_events
SET testing_event_id = coalesce(testing_event_id, id, gen_random_uuid())
WHERE testing_event_id IS NULL;

ALTER TABLE public.driver_drug_test_events
  ALTER COLUMN testing_event_id SET DEFAULT gen_random_uuid();
ALTER TABLE public.driver_drug_test_events
  ALTER COLUMN testing_event_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS driver_drug_test_events_driver_idx
  ON public.driver_drug_test_events (driver_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS driver_drug_test_events_testing_event_idx
  ON public.driver_drug_test_events (driver_id, testing_event_id)
  WHERE deleted_at IS NULL;

-- At most one active FD and one active MR per testing_event_id.
-- Soft-deleted rows excluded so restore/replace history remains possible after soft-delete.
DROP INDEX IF EXISTS driver_drug_test_events_one_kind_per_testing_event;
CREATE UNIQUE INDEX driver_drug_test_events_one_kind_per_testing_event
  ON public.driver_drug_test_events (testing_event_id, kind)
  WHERE deleted_at IS NULL AND kind IS NOT NULL;

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
VOLATILE
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

-- Enforce: testing_event_id is single-driver; no duplicate active FD/MR on one event.
CREATE OR REPLACE FUNCTION private.driver_drug_test_assert_group(
  p_driver_id text,
  p_testing_event_id uuid,
  p_kind text,
  p_exclude_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.driver_drug_test_events e
    WHERE e.testing_event_id = p_testing_event_id
      AND e.deleted_at IS NULL
      AND e.driver_id IS DISTINCT FROM p_driver_id
      AND (p_exclude_id IS NULL OR e.id IS DISTINCT FROM p_exclude_id)
  ) THEN
    RAISE EXCEPTION 'testing_event_id cannot group records from different drivers';
  END IF;

  IF p_kind IS NOT NULL AND btrim(p_kind) <> '' AND EXISTS (
    SELECT 1
    FROM public.driver_drug_test_events e
    WHERE e.testing_event_id = p_testing_event_id
      AND e.deleted_at IS NULL
      AND e.kind = p_kind
      AND (p_exclude_id IS NULL OR e.id IS DISTINCT FROM p_exclude_id)
  ) THEN
    RAISE EXCEPTION 'Active testing event already has a % record', p_kind;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION private.driver_drug_test_assert_group(text, uuid, text, uuid) FROM PUBLIC;

-- VOLATILE: performs audit INSERT. Must NOT be STABLE.
CREATE OR REPLACE FUNCTION public.driver_drug_test_list(p_driver_id text)
RETURNS SETOF public.driver_drug_test_events
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.driver_portal_is_admin() THEN
    RAISE EXCEPTION 'Admin Driver Compliance account required for drug test records.';
  END IF;
  PERFORM private.driver_sensitive_audit('drug_test_list', p_driver_id, 'active_only');
  RETURN QUERY
  SELECT *
  FROM public.driver_drug_test_events e
  WHERE e.driver_id = p_driver_id
    AND e.deleted_at IS NULL
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
  p_notes text,
  p_testing_event_id uuid DEFAULT NULL
)
RETURNS SETOF public.driver_drug_test_events
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  new_id uuid;
  group_id uuid := coalesce(p_testing_event_id, gen_random_uuid());
  clean_kind text := nullif(btrim(coalesce(p_kind, '')), '');
  clean_driver text := btrim(p_driver_id);
BEGIN
  IF auth.uid() IS NULL OR NOT public.driver_portal_is_admin() THEN
    RAISE EXCEPTION 'Admin Driver Compliance account required for drug test records.';
  END IF;
  IF p_driver_id IS NULL OR clean_driver = '' THEN
    RAISE EXCEPTION 'driver_id required';
  END IF;

  PERFORM private.driver_drug_test_assert_group(clean_driver, group_id, clean_kind, NULL);

  INSERT INTO public.driver_drug_test_events (
    driver_id, testing_event_id, kind, specimen_id, reason, collection_context,
    event_date, notes, created_by
  ) VALUES (
    clean_driver,
    group_id,
    clean_kind,
    -- text: preserve leading zeros; never cast to numeric
    nullif(p_specimen_id, ''),
    nullif(p_reason, ''),
    nullif(p_collection_context, ''),
    nullif(p_event_date, ''),
    coalesce(p_notes, ''),
    auth.uid()
  )
  RETURNING id INTO new_id;

  PERFORM private.driver_sensitive_audit(
    'drug_test_add',
    p_driver_id,
    jsonb_build_object('id', new_id, 'testing_event_id', group_id)::text
  );

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
  p_notes text DEFAULT NULL,
  p_testing_event_id uuid DEFAULT NULL
)
RETURNS SETOF public.driver_drug_test_events
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  did text;
  prev jsonb;
  next_kind text;
  next_te uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.driver_portal_is_admin() THEN
    RAISE EXCEPTION 'Admin Driver Compliance account required for drug test records.';
  END IF;

  SELECT to_jsonb(e), e.driver_id,
         CASE WHEN p_kind IS NULL THEN e.kind ELSE nullif(btrim(coalesce(p_kind, '')), '') END,
         coalesce(p_testing_event_id, e.testing_event_id)
    INTO prev, did, next_kind, next_te
  FROM public.driver_drug_test_events e
  WHERE e.id = p_id AND e.deleted_at IS NULL;

  IF did IS NULL THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  PERFORM private.driver_drug_test_assert_group(did, next_te, next_kind, p_id);

  UPDATE public.driver_drug_test_events e
  SET
    kind = CASE WHEN p_kind IS NULL THEN e.kind ELSE nullif(btrim(coalesce(p_kind, '')), '') END,
    specimen_id = CASE WHEN p_specimen_id IS NULL THEN e.specimen_id ELSE nullif(p_specimen_id, '') END,
    reason = CASE WHEN p_reason IS NULL THEN e.reason ELSE nullif(p_reason, '') END,
    collection_context = CASE
      WHEN p_collection_context IS NULL THEN e.collection_context
      ELSE nullif(p_collection_context, '')
    END,
    event_date = CASE WHEN p_event_date IS NULL THEN e.event_date ELSE nullif(p_event_date, '') END,
    notes = CASE WHEN p_notes IS NULL THEN e.notes ELSE coalesce(p_notes, '') END,
    testing_event_id = coalesce(p_testing_event_id, e.testing_event_id),
    updated_at = now()
  WHERE e.id = p_id
    AND e.deleted_at IS NULL;

  PERFORM private.driver_sensitive_audit(
    'drug_test_update',
    did,
    jsonb_build_object('id', p_id, 'before', prev, 'correction', true)::text
  );
  RETURN QUERY SELECT * FROM public.driver_drug_test_events WHERE id = p_id;
END;
$$;

-- Soft-delete only (recoverable). No hard DELETE of history via this RPC.
CREATE OR REPLACE FUNCTION public.driver_drug_test_delete(p_id uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
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

  UPDATE public.driver_drug_test_events
  SET deleted_at = now(), deleted_by = auth.uid(), updated_at = now()
  WHERE id = p_id
    AND deleted_at IS NULL
  RETURNING driver_id INTO did;

  IF did IS NOT NULL THEN
    PERFORM private.driver_sensitive_audit('drug_test_soft_delete', did, p_id::text);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.driver_drug_test_restore(p_id uuid)
RETURNS SETOF public.driver_drug_test_events
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  did text;
  te uuid;
  k text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.driver_portal_is_admin() THEN
    RAISE EXCEPTION 'Admin Driver Compliance account required for drug test records.';
  END IF;

  SELECT e.driver_id, e.testing_event_id, e.kind
    INTO did, te, k
  FROM public.driver_drug_test_events e
  WHERE e.id = p_id AND e.deleted_at IS NOT NULL;

  IF did IS NULL THEN
    RAISE EXCEPTION 'Soft-deleted event not found';
  END IF;

  -- Refuse restore that would create cross-driver or duplicate active FD/MR.
  PERFORM private.driver_drug_test_assert_group(did, te, k, p_id);

  UPDATE public.driver_drug_test_events
  SET deleted_at = NULL, deleted_by = NULL, updated_at = now()
  WHERE id = p_id
    AND deleted_at IS NOT NULL;

  PERFORM private.driver_sensitive_audit('drug_test_restore', did, p_id::text);
  RETURN QUERY SELECT * FROM public.driver_drug_test_events WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.driver_drug_test_list(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.driver_drug_test_add(text, text, text, text, text, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.driver_drug_test_update(uuid, text, text, text, text, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.driver_drug_test_delete(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.driver_drug_test_restore(uuid) FROM PUBLIC;

-- Drop prior 7-arg add / 7-arg update signatures if present from earlier draft.
DROP FUNCTION IF EXISTS public.driver_drug_test_add(text, text, text, text, text, text, text);
DROP FUNCTION IF EXISTS public.driver_drug_test_update(uuid, text, text, text, text, text, text);

GRANT EXECUTE ON FUNCTION public.driver_drug_test_list(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.driver_drug_test_add(text, text, text, text, text, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.driver_drug_test_update(uuid, text, text, text, text, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.driver_drug_test_delete(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.driver_drug_test_restore(uuid) TO authenticated;
