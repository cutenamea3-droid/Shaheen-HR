-- Bootstrap: first signed-in owner (or empty accounts table) can create their portal row.
-- Paste into SQL Editor after 20261102090000_driver_full_cloud.sql if accounts is still empty.

CREATE OR REPLACE FUNCTION public.driver_portal_ensure_self(p_display_name text DEFAULT 'HR owner')
RETURNS public.driver_portal_accounts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  uid uuid := auth.uid();
  mail text;
  nm text := nullif(btrim(p_display_name), '');
  existing public.driver_portal_accounts%ROWTYPE;
  admin_count int;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT * INTO existing FROM public.driver_portal_accounts WHERE user_id = uid;
  IF FOUND THEN
    RETURN existing;
  END IF;

  SELECT lower(email) INTO mail FROM auth.users WHERE id = uid;
  IF mail IS NULL THEN
    RAISE EXCEPTION 'Auth user email not found.';
  END IF;
  IF nm IS NULL OR length(nm) > 80 THEN
    nm := 'HR owner';
  END IF;

  SELECT count(*) INTO admin_count FROM public.driver_portal_accounts WHERE role = 'admin' AND active;

  INSERT INTO public.driver_portal_accounts (user_id, email, display_name, role, active)
  VALUES (
    uid,
    mail,
    nm,
    CASE
      WHEN mail = 'hr.compliance@gmail.com' THEN 'admin'
      WHEN admin_count = 0 THEN 'admin'
      ELSE 'standard'
    END,
    true
  )
  RETURNING * INTO existing;

  RETURN existing;
END
$$;

REVOKE ALL ON FUNCTION public.driver_portal_ensure_self(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.driver_portal_ensure_self(text) TO authenticated;
