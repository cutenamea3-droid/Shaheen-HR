-- Dispatch Operations — isolated schema on the existing Driver Supabase project.
-- APPROVAL GATE: do not apply to Production without explicit owner approval.
-- Dispatchers are provisioned ONLY into dispatch_portal_accounts (never driver_portal_accounts),
-- so existing driver_portal_can_access() RLS already denies compliance tables.
-- This migration never grants dispatchers SELECT on tracker_sections, rate cards, drug tests,
-- or any Admin/Personal tables.

-- ---------------------------------------------------------------------------
-- 1) Dispatch portal ACL
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dispatch_portal_accounts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  display_name text NOT NULL,
  role text NOT NULL DEFAULT 'dispatcher' CHECK (role IN ('admin', 'dispatcher')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dispatch_portal_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_portal_accounts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.dispatch_portal_accounts FROM PUBLIC;
REVOKE ALL ON public.dispatch_portal_accounts FROM anon;
GRANT SELECT ON public.dispatch_portal_accounts TO authenticated;
GRANT ALL ON public.dispatch_portal_accounts TO service_role;

CREATE OR REPLACE FUNCTION public.dispatch_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.dispatch_portal_accounts
    WHERE user_id = auth.uid() AND role = 'admin' AND active
  )
$$;

CREATE OR REPLACE FUNCTION public.dispatch_can_access()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.dispatch_portal_accounts
    WHERE user_id = auth.uid() AND active
  )
$$;

REVOKE ALL ON FUNCTION public.dispatch_is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dispatch_can_access() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dispatch_is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_can_access() TO authenticated;

CREATE OR REPLACE FUNCTION public.dispatch_ensure_self(p_display_name text DEFAULT NULL)
RETURNS public.dispatch_portal_accounts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  uid uuid := auth.uid();
  mail text;
  row public.dispatch_portal_accounts;
  nm text;
  is_owner boolean;
  any_admin boolean;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT lower(u.email) INTO mail FROM auth.users u WHERE u.id = uid;
  IF mail IS NULL THEN
    RAISE EXCEPTION 'Auth user email is required.';
  END IF;

  SELECT * INTO row FROM public.dispatch_portal_accounts WHERE user_id = uid;
  IF FOUND THEN
    RETURN row;
  END IF;

  -- Never auto-provision someone who already holds a Driver Compliance portal seat
  -- unless they are the designated owner (bootstrap path).
  is_owner := mail = 'hr.compliance@gmail.com';
  IF EXISTS (SELECT 1 FROM public.driver_portal_accounts d WHERE d.user_id = uid)
     AND NOT is_owner THEN
    RAISE EXCEPTION 'Driver Compliance accounts cannot auto-join Dispatch. Ask a Dispatch admin to invite a dedicated dispatcher login.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.dispatch_portal_accounts WHERE role = 'admin' AND active
  ) INTO any_admin;

  nm := COALESCE(NULLIF(btrim(p_display_name), ''), split_part(mail, '@', 1));
  IF length(nm) < 1 OR length(nm) > 80 THEN
    RAISE EXCEPTION 'Display name must contain 1 to 80 characters.';
  END IF;

  IF NOT is_owner AND any_admin THEN
    RAISE EXCEPTION 'No Dispatch account. Ask a Dispatch administrator for an invite.';
  END IF;

  INSERT INTO public.dispatch_portal_accounts (user_id, email, display_name, role, active)
  VALUES (uid, mail, nm, CASE WHEN is_owner OR NOT any_admin THEN 'admin' ELSE 'dispatcher' END, true)
  RETURNING * INTO row;

  RETURN row;
END
$$;

CREATE OR REPLACE FUNCTION public.dispatch_set_access(
  p_user_id uuid,
  p_role text,
  p_active boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  target public.dispatch_portal_accounts%ROWTYPE;
BEGIN
  IF NOT public.dispatch_is_admin() THEN
    RAISE EXCEPTION 'Dispatch administrator access is required.';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('dispatch_portal_access'));
  IF p_role NOT IN ('admin', 'dispatcher') THEN
    RAISE EXCEPTION 'Unsupported Dispatch role.';
  END IF;

  SELECT * INTO target
  FROM public.dispatch_portal_accounts
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dispatch account not found.';
  END IF;
  IF p_user_id = auth.uid() AND (p_role <> 'admin' OR NOT p_active) THEN
    RAISE EXCEPTION 'You cannot remove your own Dispatch administrator access.';
  END IF;
  IF target.role = 'admin' AND target.active AND (p_role <> 'admin' OR NOT p_active)
     AND (SELECT count(*) FROM public.dispatch_portal_accounts WHERE role = 'admin' AND active) <= 1 THEN
    RAISE EXCEPTION 'At least one active Dispatch administrator must remain.';
  END IF;

  UPDATE public.dispatch_portal_accounts
  SET role = p_role, active = p_active, updated_at = now()
  WHERE user_id = p_user_id;
END
$$;

CREATE OR REPLACE FUNCTION public.dispatch_update_profile(p_display_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  new_name text := btrim(p_display_name);
BEGIN
  IF auth.uid() IS NULL OR NOT public.dispatch_can_access() THEN
    RAISE EXCEPTION 'An active Dispatch account is required.';
  END IF;
  IF length(new_name) < 1 OR length(new_name) > 80 THEN
    RAISE EXCEPTION 'Display name must contain 1 to 80 characters.';
  END IF;

  UPDATE public.dispatch_portal_accounts
  SET display_name = new_name, updated_at = now()
  WHERE user_id = auth.uid();

  RETURN new_name;
END
$$;

REVOKE ALL ON FUNCTION public.dispatch_ensure_self(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dispatch_set_access(uuid, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dispatch_update_profile(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dispatch_ensure_self(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_set_access(uuid, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_update_profile(text) TO authenticated;

DROP POLICY IF EXISTS dispatch_portal_accounts_read ON public.dispatch_portal_accounts;
CREATE POLICY dispatch_portal_accounts_read
  ON public.dispatch_portal_accounts FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.dispatch_is_admin());

-- Soft-seed owner when Auth user exists.
INSERT INTO public.dispatch_portal_accounts (user_id, email, display_name, role, active)
SELECT id, lower(email), 'Dispatch owner', 'admin', true
FROM auth.users
WHERE lower(email) = 'hr.compliance@gmail.com'
ON CONFLICT (user_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2) Dispatch-owned roster (NOT compliance drivers — no PII from Driver module)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dispatch_roster_drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL,
  unit_number text,
  phone text,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dispatch_roster_name_len CHECK (char_length(btrim(display_name)) BETWEEN 1 AND 120)
);

ALTER TABLE public.dispatch_roster_drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_roster_drivers FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.dispatch_roster_drivers FROM PUBLIC;
REVOKE ALL ON public.dispatch_roster_drivers FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.dispatch_roster_drivers TO authenticated;
GRANT ALL ON public.dispatch_roster_drivers TO service_role;

DROP POLICY IF EXISTS dispatch_roster_select ON public.dispatch_roster_drivers;
DROP POLICY IF EXISTS dispatch_roster_insert ON public.dispatch_roster_drivers;
DROP POLICY IF EXISTS dispatch_roster_update ON public.dispatch_roster_drivers;
CREATE POLICY dispatch_roster_select ON public.dispatch_roster_drivers
  FOR SELECT TO authenticated USING (public.dispatch_can_access());
CREATE POLICY dispatch_roster_insert ON public.dispatch_roster_drivers
  FOR INSERT TO authenticated WITH CHECK (public.dispatch_can_access());
CREATE POLICY dispatch_roster_update ON public.dispatch_roster_drivers
  FOR UPDATE TO authenticated
  USING (public.dispatch_can_access())
  WITH CHECK (public.dispatch_can_access());

-- ---------------------------------------------------------------------------
-- 3) Loads + multi-stop
-- Status model: Delivered ≠ Closed. Exceptions live in dispatch_exceptions.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dispatch_loads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  load_number text NOT NULL,
  customer_name text,
  commodity text,
  equipment text,
  notes text,
  status text NOT NULL DEFAULT 'planned'
    CHECK (status IN (
      'draft', 'planned', 'assigned', 'in_transit', 'at_pickup', 'loaded',
      'at_delivery', 'delivered', 'closed', 'cancelled'
    )),
  exception_open boolean NOT NULL DEFAULT false,
  bol_status text NOT NULL DEFAULT 'missing'
    CHECK (bol_status IN ('missing', 'pending', 'received', 'verified', 'exception')),
  pod_status text NOT NULL DEFAULT 'missing'
    CHECK (pod_status IN ('missing', 'pending', 'received', 'verified', 'exception')),
  assigned_driver_id uuid REFERENCES public.dispatch_roster_drivers(id) ON DELETE SET NULL,
  assigned_driver_name text,
  external_ref_label text,
  external_ref_url text,
  planned_pickup_at timestamptz,
  actual_pickup_at timestamptz,
  planned_delivery_at timestamptz,
  actual_delivery_at timestamptz,
  last_manual_location text,
  last_manual_location_at timestamptz,
  last_manual_location_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  stale_after_minutes integer NOT NULL DEFAULT 180,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dispatch_loads_number_len CHECK (char_length(btrim(load_number)) BETWEEN 1 AND 64)
);

CREATE UNIQUE INDEX IF NOT EXISTS dispatch_loads_number_uidx
  ON public.dispatch_loads (lower(load_number));
CREATE INDEX IF NOT EXISTS dispatch_loads_status_idx ON public.dispatch_loads (status);
CREATE INDEX IF NOT EXISTS dispatch_loads_driver_idx ON public.dispatch_loads (assigned_driver_id);
CREATE INDEX IF NOT EXISTS dispatch_loads_updated_idx ON public.dispatch_loads (updated_at DESC);

ALTER TABLE public.dispatch_loads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_loads FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.dispatch_loads FROM PUBLIC;
REVOKE ALL ON public.dispatch_loads FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.dispatch_loads TO authenticated;
GRANT ALL ON public.dispatch_loads TO service_role;

DROP POLICY IF EXISTS dispatch_loads_select ON public.dispatch_loads;
DROP POLICY IF EXISTS dispatch_loads_insert ON public.dispatch_loads;
DROP POLICY IF EXISTS dispatch_loads_update ON public.dispatch_loads;
CREATE POLICY dispatch_loads_select ON public.dispatch_loads
  FOR SELECT TO authenticated USING (public.dispatch_can_access());
CREATE POLICY dispatch_loads_insert ON public.dispatch_loads
  FOR INSERT TO authenticated WITH CHECK (public.dispatch_can_access());
CREATE POLICY dispatch_loads_update ON public.dispatch_loads
  FOR UPDATE TO authenticated
  USING (public.dispatch_can_access())
  WITH CHECK (public.dispatch_can_access());

CREATE TABLE IF NOT EXISTS public.dispatch_load_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  load_id uuid NOT NULL REFERENCES public.dispatch_loads(id) ON DELETE CASCADE,
  sequence integer NOT NULL CHECK (sequence >= 1),
  stop_type text NOT NULL CHECK (stop_type IN ('pickup', 'delivery', 'other')),
  name text,
  address text,
  city text,
  state text,
  postal_code text,
  planned_at timestamptz,
  actual_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (load_id, sequence)
);

CREATE INDEX IF NOT EXISTS dispatch_load_stops_load_idx ON public.dispatch_load_stops (load_id);

ALTER TABLE public.dispatch_load_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_load_stops FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.dispatch_load_stops FROM PUBLIC;
REVOKE ALL ON public.dispatch_load_stops FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dispatch_load_stops TO authenticated;
GRANT ALL ON public.dispatch_load_stops TO service_role;

DROP POLICY IF EXISTS dispatch_stops_select ON public.dispatch_load_stops;
DROP POLICY IF EXISTS dispatch_stops_insert ON public.dispatch_load_stops;
DROP POLICY IF EXISTS dispatch_stops_update ON public.dispatch_load_stops;
DROP POLICY IF EXISTS dispatch_stops_delete ON public.dispatch_load_stops;
CREATE POLICY dispatch_stops_select ON public.dispatch_load_stops
  FOR SELECT TO authenticated USING (public.dispatch_can_access());
CREATE POLICY dispatch_stops_insert ON public.dispatch_load_stops
  FOR INSERT TO authenticated WITH CHECK (public.dispatch_can_access());
CREATE POLICY dispatch_stops_update ON public.dispatch_load_stops
  FOR UPDATE TO authenticated
  USING (public.dispatch_can_access())
  WITH CHECK (public.dispatch_can_access());
CREATE POLICY dispatch_stops_delete ON public.dispatch_load_stops
  FOR DELETE TO authenticated USING (public.dispatch_can_access());

-- ---------------------------------------------------------------------------
-- 4) Check-calls, exceptions, issues, shift handovers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dispatch_check_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  load_id uuid NOT NULL REFERENCES public.dispatch_loads(id) ON DELETE CASCADE,
  called_at timestamptz NOT NULL DEFAULT now(),
  manual_location text,
  notes text NOT NULL DEFAULT '',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dispatch_check_calls_load_idx ON public.dispatch_check_calls (load_id, called_at DESC);

ALTER TABLE public.dispatch_check_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_check_calls FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.dispatch_check_calls FROM PUBLIC;
REVOKE ALL ON public.dispatch_check_calls FROM anon;
GRANT SELECT, INSERT ON public.dispatch_check_calls TO authenticated;
GRANT ALL ON public.dispatch_check_calls TO service_role;

DROP POLICY IF EXISTS dispatch_check_calls_select ON public.dispatch_check_calls;
DROP POLICY IF EXISTS dispatch_check_calls_insert ON public.dispatch_check_calls;
CREATE POLICY dispatch_check_calls_select ON public.dispatch_check_calls
  FOR SELECT TO authenticated USING (public.dispatch_can_access());
CREATE POLICY dispatch_check_calls_insert ON public.dispatch_check_calls
  FOR INSERT TO authenticated WITH CHECK (public.dispatch_can_access());

CREATE TABLE IF NOT EXISTS public.dispatch_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  load_id uuid NOT NULL REFERENCES public.dispatch_loads(id) ON DELETE CASCADE,
  kind text NOT NULL,
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'watching', 'resolved')),
  notes text,
  opened_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dispatch_exceptions_load_idx ON public.dispatch_exceptions (load_id);
CREATE INDEX IF NOT EXISTS dispatch_exceptions_status_idx ON public.dispatch_exceptions (status);

ALTER TABLE public.dispatch_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_exceptions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.dispatch_exceptions FROM PUBLIC;
REVOKE ALL ON public.dispatch_exceptions FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.dispatch_exceptions TO authenticated;
GRANT ALL ON public.dispatch_exceptions TO service_role;

DROP POLICY IF EXISTS dispatch_exceptions_select ON public.dispatch_exceptions;
DROP POLICY IF EXISTS dispatch_exceptions_insert ON public.dispatch_exceptions;
DROP POLICY IF EXISTS dispatch_exceptions_update ON public.dispatch_exceptions;
CREATE POLICY dispatch_exceptions_select ON public.dispatch_exceptions
  FOR SELECT TO authenticated USING (public.dispatch_can_access());
CREATE POLICY dispatch_exceptions_insert ON public.dispatch_exceptions
  FOR INSERT TO authenticated WITH CHECK (public.dispatch_can_access());
CREATE POLICY dispatch_exceptions_update ON public.dispatch_exceptions
  FOR UPDATE TO authenticated
  USING (public.dispatch_can_access())
  WITH CHECK (public.dispatch_can_access());

CREATE TABLE IF NOT EXISTS public.dispatch_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  load_id uuid REFERENCES public.dispatch_loads(id) ON DELETE SET NULL,
  title text NOT NULL,
  detail text,
  escalation_level text NOT NULL DEFAULT 'ops'
    CHECK (escalation_level IN ('ops', 'supervisor', 'manager', 'critical')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'escalated', 'resolved')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dispatch_issues_title_len CHECK (char_length(btrim(title)) BETWEEN 1 AND 160)
);

CREATE INDEX IF NOT EXISTS dispatch_issues_status_idx ON public.dispatch_issues (status);
CREATE INDEX IF NOT EXISTS dispatch_issues_load_idx ON public.dispatch_issues (load_id);

ALTER TABLE public.dispatch_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_issues FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.dispatch_issues FROM PUBLIC;
REVOKE ALL ON public.dispatch_issues FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.dispatch_issues TO authenticated;
GRANT ALL ON public.dispatch_issues TO service_role;

DROP POLICY IF EXISTS dispatch_issues_select ON public.dispatch_issues;
DROP POLICY IF EXISTS dispatch_issues_insert ON public.dispatch_issues;
DROP POLICY IF EXISTS dispatch_issues_update ON public.dispatch_issues;
CREATE POLICY dispatch_issues_select ON public.dispatch_issues
  FOR SELECT TO authenticated USING (public.dispatch_can_access());
CREATE POLICY dispatch_issues_insert ON public.dispatch_issues
  FOR INSERT TO authenticated WITH CHECK (public.dispatch_can_access());
CREATE POLICY dispatch_issues_update ON public.dispatch_issues
  FOR UPDATE TO authenticated
  USING (public.dispatch_can_access())
  WITH CHECK (public.dispatch_can_access());

CREATE TABLE IF NOT EXISTS public.dispatch_shift_handovers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_date date NOT NULL,
  from_dispatcher text NOT NULL,
  to_dispatcher text,
  summary text NOT NULL DEFAULT '',
  open_load_ids uuid[] NOT NULL DEFAULT '{}',
  watch_items text NOT NULL DEFAULT '',
  next_day_priorities text NOT NULL DEFAULT '',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dispatch_handovers_date_idx
  ON public.dispatch_shift_handovers (shift_date DESC);

ALTER TABLE public.dispatch_shift_handovers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_shift_handovers FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.dispatch_shift_handovers FROM PUBLIC;
REVOKE ALL ON public.dispatch_shift_handovers FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.dispatch_shift_handovers TO authenticated;
GRANT ALL ON public.dispatch_shift_handovers TO service_role;

DROP POLICY IF EXISTS dispatch_handovers_select ON public.dispatch_shift_handovers;
DROP POLICY IF EXISTS dispatch_handovers_insert ON public.dispatch_shift_handovers;
DROP POLICY IF EXISTS dispatch_handovers_update ON public.dispatch_shift_handovers;
CREATE POLICY dispatch_handovers_select ON public.dispatch_shift_handovers
  FOR SELECT TO authenticated USING (public.dispatch_can_access());
CREATE POLICY dispatch_handovers_insert ON public.dispatch_shift_handovers
  FOR INSERT TO authenticated WITH CHECK (public.dispatch_can_access());
CREATE POLICY dispatch_handovers_update ON public.dispatch_shift_handovers
  FOR UPDATE TO authenticated
  USING (public.dispatch_can_access())
  WITH CHECK (public.dispatch_can_access());

-- ---------------------------------------------------------------------------
-- 5) updated_at helper
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dispatch_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS dispatch_loads_touch ON public.dispatch_loads;
CREATE TRIGGER dispatch_loads_touch
BEFORE UPDATE ON public.dispatch_loads
FOR EACH ROW EXECUTE FUNCTION public.dispatch_touch_updated_at();

DROP TRIGGER IF EXISTS dispatch_roster_touch ON public.dispatch_roster_drivers;
CREATE TRIGGER dispatch_roster_touch
BEFORE UPDATE ON public.dispatch_roster_drivers
FOR EACH ROW EXECUTE FUNCTION public.dispatch_touch_updated_at();

DROP TRIGGER IF EXISTS dispatch_exceptions_touch ON public.dispatch_exceptions;
CREATE TRIGGER dispatch_exceptions_touch
BEFORE UPDATE ON public.dispatch_exceptions
FOR EACH ROW EXECUTE FUNCTION public.dispatch_touch_updated_at();

DROP TRIGGER IF EXISTS dispatch_issues_touch ON public.dispatch_issues;
CREATE TRIGGER dispatch_issues_touch
BEFORE UPDATE ON public.dispatch_issues
FOR EACH ROW EXECUTE FUNCTION public.dispatch_touch_updated_at();

DROP TRIGGER IF EXISTS dispatch_handovers_touch ON public.dispatch_shift_handovers;
CREATE TRIGGER dispatch_handovers_touch
BEFORE UPDATE ON public.dispatch_shift_handovers
FOR EACH ROW EXECUTE FUNCTION public.dispatch_touch_updated_at();

DROP TRIGGER IF EXISTS dispatch_stops_touch ON public.dispatch_load_stops;
CREATE TRIGGER dispatch_stops_touch
BEFORE UPDATE ON public.dispatch_load_stops
FOR EACH ROW EXECUTE FUNCTION public.dispatch_touch_updated_at();
