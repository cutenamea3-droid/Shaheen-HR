-- Batch 2 — Auth / module isolation (Driver Supabase project)
-- APPROVAL GATE: review-only. Do NOT apply to Production without explicit owner approval.
--
-- Scope:
-- 1) Dispatch ACL table + RPCs (shell isolation). Full Dispatch ops tables remain on PR #25.
-- 2) Document least-privilege: drug/rate already FORCE RLS admin-only when those migrations applied.
--
-- Dispatchers are NEVER inserted into driver_portal_accounts by these RPCs, so existing
-- driver_portal_can_access() policies continue to deny Compliance / rate / drug tables.

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

REVOKE ALL ON FUNCTION public.dispatch_ensure_self(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dispatch_set_access(uuid, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dispatch_ensure_self(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_set_access(uuid, text, boolean) TO authenticated;

DROP POLICY IF EXISTS dispatch_portal_accounts_read ON public.dispatch_portal_accounts;
CREATE POLICY dispatch_portal_accounts_read
  ON public.dispatch_portal_accounts FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.dispatch_is_admin());

-- ---------------------------------------------------------------------------
-- 2) Explicit deny helpers (API denial documentation for tests)
-- ---------------------------------------------------------------------------
-- Compliance seats must not read dispatch ACL unless they also hold a Dispatch seat
-- (owner may hold both). Standard Compliance users are denied by the policy above.
-- Drug/rate least privilege remains in 20261106140000 / 20261106140100 (admin-only RPCs).
