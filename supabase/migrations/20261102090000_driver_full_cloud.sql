-- Driver Compliance — full cloud schema for project okzcwctsgurumnnzuxgg
-- Idempotent. Safe to paste into Supabase SQL Editor (service role / dashboard).
-- Does NOT require the owner Auth user to exist yet (seeds when present).
-- Records (extra docs / owners / mechanics) live as rows in tracker_sections
-- with ids: rec_drivers, rec_owners, rec_mechanics.

-- ---------------------------------------------------------------------------
-- 1) tracker_sections — one JSON blob per compliance / records section id
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tracker_sections (
  id text PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tracker_sections ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.tracker_sections TO authenticated;
GRANT ALL ON public.tracker_sections TO service_role;

-- ---------------------------------------------------------------------------
-- 2) driver_portal_accounts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.driver_portal_accounts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  display_name text NOT NULL,
  role text NOT NULL DEFAULT 'standard' CHECK (role IN ('admin', 'standard')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.driver_portal_accounts ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.driver_portal_accounts TO authenticated;
GRANT ALL ON public.driver_portal_accounts TO service_role;

-- Soft-seed owner if Auth user already exists (no hard fail on fresh projects).
INSERT INTO public.driver_portal_accounts (user_id, email, display_name, role, active)
SELECT id, lower(email), 'HR owner', 'admin', true
FROM auth.users
WHERE lower(email) = 'hr.compliance@gmail.com'
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.driver_portal_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.driver_portal_accounts
    WHERE user_id = auth.uid() AND role = 'admin' AND active
  )
$$;

CREATE OR REPLACE FUNCTION public.driver_portal_can_access()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.driver_portal_accounts
    WHERE user_id = auth.uid() AND active
  )
$$;

REVOKE ALL ON FUNCTION public.driver_portal_is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.driver_portal_can_access() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.driver_portal_is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.driver_portal_can_access() TO authenticated;

CREATE OR REPLACE FUNCTION public.driver_portal_update_profile(p_display_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  new_name text := btrim(p_display_name);
BEGIN
  IF auth.uid() IS NULL OR NOT public.driver_portal_can_access() THEN
    RAISE EXCEPTION 'An active Driver Compliance account is required.';
  END IF;
  IF length(new_name) < 1 OR length(new_name) > 80 THEN
    RAISE EXCEPTION 'Display name must contain 1 to 80 characters.';
  END IF;

  UPDATE public.driver_portal_accounts
  SET display_name = new_name
  WHERE user_id = auth.uid();

  RETURN new_name;
END
$$;

CREATE OR REPLACE FUNCTION public.driver_portal_set_access(
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
  target public.driver_portal_accounts%ROWTYPE;
BEGIN
  IF NOT public.driver_portal_is_admin() THEN
    RAISE EXCEPTION 'Administrator access is required.';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('driver_portal_access'));
  IF p_role NOT IN ('admin', 'standard') THEN
    RAISE EXCEPTION 'Unsupported account role.';
  END IF;

  SELECT * INTO target
  FROM public.driver_portal_accounts
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account not found.';
  END IF;
  IF p_user_id = auth.uid() AND (p_role <> 'admin' OR NOT p_active) THEN
    RAISE EXCEPTION 'You cannot remove your own administrator access.';
  END IF;
  IF target.role = 'admin' AND target.active AND (p_role <> 'admin' OR NOT p_active)
     AND (SELECT count(*) FROM public.driver_portal_accounts WHERE role = 'admin' AND active) <= 1 THEN
    RAISE EXCEPTION 'At least one active administrator must remain.';
  END IF;

  UPDATE public.driver_portal_accounts
  SET role = p_role, active = p_active
  WHERE user_id = p_user_id;
END
$$;

REVOKE ALL ON FUNCTION public.driver_portal_update_profile(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.driver_portal_set_access(uuid, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.driver_portal_update_profile(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.driver_portal_set_access(uuid, text, boolean) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) driver_portal_activity
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.driver_portal_activity (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name text NOT NULL,
  action text NOT NULL,
  section_id text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.driver_portal_activity ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.driver_portal_activity TO authenticated;
GRANT ALL ON public.driver_portal_activity TO service_role;

-- ---------------------------------------------------------------------------
-- 4) Policies (drop+recreate known names for idempotency)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('tracker_sections', 'driver_portal_accounts', 'driver_portal_activity')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END
$$;

CREATE POLICY driver_portal_accounts_read
  ON public.driver_portal_accounts FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.driver_portal_is_admin());

CREATE POLICY driver_portal_activity_admin_read
  ON public.driver_portal_activity FOR SELECT TO authenticated
  USING (public.driver_portal_is_admin());

CREATE POLICY driver_portal_activity_insert_self
  ON public.driver_portal_activity FOR INSERT TO authenticated
  WITH CHECK (
    public.driver_portal_can_access()
    AND (actor_id IS NULL OR actor_id = auth.uid())
  );

CREATE POLICY driver_portal_sections_select
  ON public.tracker_sections FOR SELECT TO authenticated
  USING (public.driver_portal_can_access());

CREATE POLICY driver_portal_sections_insert
  ON public.tracker_sections FOR INSERT TO authenticated
  WITH CHECK (public.driver_portal_can_access());

CREATE POLICY driver_portal_sections_update
  ON public.tracker_sections FOR UPDATE TO authenticated
  USING (public.driver_portal_can_access())
  WITH CHECK (public.driver_portal_can_access());

-- ---------------------------------------------------------------------------
-- 5) Audit trigger on tracker_sections (compliance + records)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.driver_portal_log_section_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  changed_section_id text;
  change_action text;
  display_name text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.data IS NOT DISTINCT FROM NEW.data THEN
      RETURN NEW;
    END IF;
  END IF;

  changed_section_id := NEW.id;
  change_action := CASE TG_OP
    WHEN 'INSERT' THEN 'Added compliance section data'
    WHEN 'UPDATE' THEN 'Updated compliance section data'
    ELSE 'Updated compliance section data'
  END;

  SELECT a.display_name INTO display_name
  FROM public.driver_portal_accounts AS a
  WHERE a.user_id = auth.uid();

  INSERT INTO public.driver_portal_activity (actor_id, actor_name, action, section_id)
  VALUES (auth.uid(), COALESCE(display_name, 'Unknown user'), change_action, changed_section_id);
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS driver_portal_section_audit ON public.tracker_sections;
CREATE TRIGGER driver_portal_section_audit
AFTER INSERT OR UPDATE ON public.tracker_sections
FOR EACH ROW EXECUTE FUNCTION public.driver_portal_log_section_change();
