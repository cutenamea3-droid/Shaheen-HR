-- Batch 2 — Admin-HR portal ACL for Lovable Admin Cloud
-- APPROVAL GATE: review-only. Apply ONLY on the Admin Lovable project — never Driver.
-- Until applied, Admin UI roles still use owner email + soft app_state.team directory.

CREATE TABLE IF NOT EXISTS public.hr_portal_accounts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  display_name text NOT NULL,
  role text NOT NULL DEFAULT 'standard' CHECK (role IN ('admin', 'standard')),
  active boolean NOT NULL DEFAULT true,
  -- Least privilege for future finance surfaces (PR #24); default off.
  finance boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hr_portal_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_portal_accounts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.hr_portal_accounts FROM PUBLIC;
REVOKE ALL ON public.hr_portal_accounts FROM anon;
GRANT SELECT ON public.hr_portal_accounts TO authenticated;
GRANT ALL ON public.hr_portal_accounts TO service_role;

CREATE OR REPLACE FUNCTION public.hr_portal_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.hr_portal_accounts
    WHERE user_id = auth.uid() AND role = 'admin' AND active
  )
$$;

CREATE OR REPLACE FUNCTION public.hr_portal_can_access()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.hr_portal_accounts
    WHERE user_id = auth.uid() AND active
  )
$$;

CREATE OR REPLACE FUNCTION public.hr_portal_has_finance()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.hr_portal_accounts
    WHERE user_id = auth.uid() AND active AND (role = 'admin' OR finance)
  )
$$;

REVOKE ALL ON FUNCTION public.hr_portal_is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hr_portal_can_access() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hr_portal_has_finance() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hr_portal_is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.hr_portal_can_access() TO authenticated;
GRANT EXECUTE ON FUNCTION public.hr_portal_has_finance() TO authenticated;

CREATE OR REPLACE FUNCTION public.hr_portal_set_access(
  p_user_id uuid,
  p_role text,
  p_active boolean,
  p_finance boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
BEGIN
  IF NOT public.hr_portal_is_admin() THEN
    RAISE EXCEPTION 'Admin-HR administrator access is required.';
  END IF;
  IF p_role NOT IN ('admin', 'standard') THEN
    RAISE EXCEPTION 'Unsupported Admin-HR role.';
  END IF;
  UPDATE public.hr_portal_accounts
  SET role = p_role, active = p_active, finance = p_finance, updated_at = now()
  WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Admin-HR account not found.';
  END IF;
END
$$;

REVOKE ALL ON FUNCTION public.hr_portal_set_access(uuid, text, boolean, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hr_portal_set_access(uuid, text, boolean, boolean) TO authenticated;

DROP POLICY IF EXISTS hr_portal_accounts_read ON public.hr_portal_accounts;
CREATE POLICY hr_portal_accounts_read
  ON public.hr_portal_accounts FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.hr_portal_is_admin());
