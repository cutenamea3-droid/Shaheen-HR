-- =============================================================================
-- ADMIN Lovable Cloud ONLY — Employee finance (banking + salary payments)
-- =============================================================================
-- STATUS: AWAITING SEPARATE PRODUCTION APPLY APPROVAL
-- DO NOT run against production / Lovable Cloud / Driver Supabase without
-- explicit human approval for THIS migration.
--
-- Backend: Admin project used by src/admin/integrations/supabase/client.ts
--          (NOT the Driver VITE_SUPABASE_* project).
--
-- Prerequisites before apply (operator checklist):
--   1. Confirm target is Admin Lovable Cloud (app_state host), not Driver.
--   2. Create encryption secret (preferred):
--        vault.create_secret('<long-random>', 'hr_banking_encryption_key');
--      OR set GUC for the database session role used by functions:
--        ALTER DATABASE postgres SET app.hr_banking_encryption_key = '<long-random>';
--   3. Backup Admin data; do not touch app_state / attendance JSON.
--   4. Apply this file once; verify RLS + RPC with HR owner account only.
--
-- Design:
--   - Additive tables only; never alters employees inside app_state jsonb.
--   - account / IBAN ciphertext never returned by SELECT policies or views.
--   - Reveal via audited SECURITY DEFINER RPC in private schema.
--   - HR owner email gate: hr.compliance@gmail.com (JWT email claim).
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS private;

-- ---------------------------------------------------------------------------
-- Helpers (private — not granted to anon/authenticated)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.hr_is_finance_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(lower(auth.jwt() ->> 'email') = 'hr.compliance@gmail.com', false);
$$;

REVOKE ALL ON FUNCTION private.hr_is_finance_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.hr_is_finance_admin() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.hr_banking_encryption_key()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = private
AS $$
DECLARE
  k text;
BEGIN
  BEGIN
    SELECT decrypted_secret INTO k
    FROM vault.decrypted_secrets
    WHERE name = 'hr_banking_encryption_key'
    LIMIT 1;
  EXCEPTION
    WHEN undefined_table THEN k := NULL;
    WHEN undefined_object THEN k := NULL;
    WHEN insufficient_privilege THEN k := NULL;
  END;

  IF k IS NULL OR btrim(k) = '' THEN
    k := nullif(current_setting('app.hr_banking_encryption_key', true), '');
  END IF;

  IF k IS NULL OR length(k) < 16 THEN
    RAISE EXCEPTION 'hr_banking_encryption_key not configured (vault secret or app.hr_banking_encryption_key GUC required)';
  END IF;
  RETURN k;
END;
$$;

REVOKE ALL ON FUNCTION private.hr_banking_encryption_key() FROM PUBLIC;

CREATE OR REPLACE FUNCTION private.hr_encrypt_account_ref(plaintext text)
RETURNS bytea
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public, extensions
AS $$
BEGIN
  IF plaintext IS NULL OR btrim(plaintext) = '' THEN
    RAISE EXCEPTION 'account reference required';
  END IF;
  RETURN pgp_sym_encrypt(plaintext, private.hr_banking_encryption_key());
END;
$$;

REVOKE ALL ON FUNCTION private.hr_encrypt_account_ref(text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION private.hr_decrypt_account_ref(ciphertext bytea)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public, extensions
AS $$
BEGIN
  RETURN pgp_sym_decrypt(ciphertext, private.hr_banking_encryption_key());
END;
$$;

REVOKE ALL ON FUNCTION private.hr_decrypt_account_ref(bytea) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- 1) Employment / joining metadata (keyed by attendance employee id — no dup roster)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hr_employee_roster (
  employee_id text PRIMARY KEY,
  joining_date date,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'leave')),
  deactivated_at date,
  reactivated_at date,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users (id)
);

COMMENT ON TABLE public.hr_employee_roster IS
  'Finance employment status + joining date. Does not store name/dept (those stay in attendance app_state).';

-- ---------------------------------------------------------------------------
-- 2) Banking accounts (append-only history; ciphertext never selected by clients)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hr_banking_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id text NOT NULL,
  provider_id text NOT NULL,
  other_label text,
  holder_name text NOT NULL,
  is_iban boolean NOT NULL DEFAULT true,
  account_ref_ciphertext bytea NOT NULL,
  account_last4 text NOT NULL CHECK (account_last4 ~ '^[0-9A-Za-z]{2,8}$'),
  effective_from date NOT NULL DEFAULT (CURRENT_DATE),
  superseded_at date,
  note text NOT NULL DEFAULT '',
  created_by uuid REFERENCES auth.users (id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hr_banking_accounts_employee_idx
  ON public.hr_banking_accounts (employee_id, effective_from DESC);

COMMENT ON COLUMN public.hr_banking_accounts.account_ref_ciphertext IS
  'pgp_sym_encrypt of IBAN or wallet/account number. Never expose via RLS SELECT to clients.';

-- ---------------------------------------------------------------------------
-- 3) Monthly salary payments (PKR integers) + event history for partials
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hr_salary_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id text NOT NULL,
  month char(7) NOT NULL CHECK (month ~ '^[0-9]{4}-[0-9]{2}$'),
  amount_due_pkr integer NOT NULL CHECK (amount_due_pkr >= 0),
  amount_paid_pkr integer NOT NULL DEFAULT 0 CHECK (amount_paid_pkr >= 0),
  status text NOT NULL DEFAULT 'unpaid'
    CHECK (status IN ('unpaid', 'partial', 'paid', 'on_hold')),
  banking_account_id uuid REFERENCES public.hr_banking_accounts (id),
  paid_on date,
  note text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users (id),
  UNIQUE (employee_id, month),
  CHECK (amount_paid_pkr <= amount_due_pkr)
);

CREATE TABLE IF NOT EXISTS public.hr_salary_payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.hr_salary_payments (id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('due_set', 'partial_pay', 'status_change', 'note')),
  amount_pkr integer,
  status_after text,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id)
);

CREATE INDEX IF NOT EXISTS hr_salary_payment_events_payment_idx
  ON public.hr_salary_payment_events (payment_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 4) Audit log (reveal / mutate)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hr_finance_audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  actor uuid REFERENCES auth.users (id),
  actor_email text,
  action text NOT NULL,
  employee_id text,
  entity_id text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- ---------------------------------------------------------------------------
-- Masked view (security_invoker so RLS on base table still applies)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.hr_banking_accounts_masked
WITH (security_invoker = true)
AS
SELECT
  id,
  employee_id,
  provider_id,
  other_label,
  holder_name,
  is_iban,
  account_last4,
  effective_from,
  superseded_at,
  note,
  created_by,
  created_at
FROM public.hr_banking_accounts;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.hr_employee_roster ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_banking_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_salary_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_salary_payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_finance_audit_log ENABLE ROW LEVEL SECURITY;

-- Even table owners / security definer must opt out explicitly (set on RPCs below).
ALTER TABLE public.hr_employee_roster FORCE ROW LEVEL SECURITY;
ALTER TABLE public.hr_banking_accounts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.hr_salary_payments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.hr_salary_payment_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.hr_finance_audit_log FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.hr_employee_roster FROM anon, authenticated;
REVOKE ALL ON public.hr_banking_accounts FROM anon, authenticated;
REVOKE ALL ON public.hr_salary_payments FROM anon, authenticated;
REVOKE ALL ON public.hr_salary_payment_events FROM anon, authenticated;
REVOKE ALL ON public.hr_finance_audit_log FROM anon, authenticated;
REVOKE ALL ON public.hr_banking_accounts_masked FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON public.hr_employee_roster TO authenticated;
-- Direct SELECT on banking base table is NOT granted — clients use masked view + RPCs.
GRANT SELECT ON public.hr_banking_accounts_masked TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.hr_salary_payments TO authenticated;
GRANT SELECT, INSERT ON public.hr_salary_payment_events TO authenticated;
GRANT SELECT, INSERT ON public.hr_finance_audit_log TO authenticated;

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

DO $$
BEGIN
  -- roster
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'hr_employee_roster' AND policyname = 'hr_roster_admin_all') THEN
    CREATE POLICY hr_roster_admin_all ON public.hr_employee_roster
      FOR ALL TO authenticated
      USING (private.hr_is_finance_admin())
      WITH CHECK (private.hr_is_finance_admin());
  END IF;

  -- banking base: no client policies (service_role / security definer only).
  -- Optional: deny-all for authenticated explicitly via lack of GRANT + no policy.

  -- masked view uses invoker + base RLS: allow admin SELECT via security barrier policy on base for admin only through definer RPCs.
  -- We add a SELECT policy for finance admin on base table but column grants still hide ciphertext if we revoke column... 
  -- Safer: grant SELECT on base only to service_role; admin reads via masked view which we recreate as SECURITY DEFINER view instead.

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'hr_salary_payments' AND policyname = 'hr_pay_admin_all') THEN
    CREATE POLICY hr_pay_admin_all ON public.hr_salary_payments
      FOR ALL TO authenticated
      USING (private.hr_is_finance_admin())
      WITH CHECK (private.hr_is_finance_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'hr_salary_payment_events' AND policyname = 'hr_pay_events_admin') THEN
    CREATE POLICY hr_pay_events_admin ON public.hr_salary_payment_events
      FOR ALL TO authenticated
      USING (private.hr_is_finance_admin())
      WITH CHECK (private.hr_is_finance_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'hr_finance_audit_log' AND policyname = 'hr_audit_admin_select') THEN
    CREATE POLICY hr_audit_admin_select ON public.hr_finance_audit_log
      FOR SELECT TO authenticated
      USING (private.hr_is_finance_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'hr_finance_audit_log' AND policyname = 'hr_audit_admin_insert') THEN
    CREATE POLICY hr_audit_admin_insert ON public.hr_finance_audit_log
      FOR INSERT TO authenticated
      WITH CHECK (private.hr_is_finance_admin());
  END IF;
END
$$;

-- Replace masked view with security definer wrapper so ciphertext column is never reachable by authenticated.
DROP VIEW IF EXISTS public.hr_banking_accounts_masked;
CREATE OR REPLACE VIEW public.hr_banking_accounts_masked AS
SELECT
  id,
  employee_id,
  provider_id,
  other_label,
  holder_name,
  is_iban,
  account_last4,
  effective_from,
  superseded_at,
  note,
  created_by,
  created_at
FROM public.hr_banking_accounts;

-- Recreate as invoker-safe: grant select only through function
REVOKE ALL ON public.hr_banking_accounts_masked FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.hr_list_banking_masked(p_employee_id text DEFAULT NULL)
RETURNS SETOF public.hr_banking_accounts_masked
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
SET row_security = off
AS $$
BEGIN
  IF NOT private.hr_is_finance_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  RETURN QUERY
  SELECT v.*
  FROM public.hr_banking_accounts_masked v
  WHERE p_employee_id IS NULL OR v.employee_id = p_employee_id
  ORDER BY v.effective_from DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.hr_list_banking_masked(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hr_list_banking_masked(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Audit helper
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.hr_audit(
  p_action text,
  p_employee_id text,
  p_entity_id text,
  p_detail jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  INSERT INTO public.hr_finance_audit_log (actor, actor_email, action, employee_id, entity_id, detail)
  VALUES (auth.uid(), auth.jwt() ->> 'email', p_action, p_employee_id, p_entity_id, coalesce(p_detail, '{}'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION private.hr_audit(text, text, text, jsonb) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hr_upsert_employee_roster(
  p_employee_id text,
  p_status text,
  p_joining_date date DEFAULT NULL,
  p_confirm_deactivate boolean DEFAULT false
)
RETURNS public.hr_employee_roster
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
SET row_security = off
AS $$
DECLARE
  cur public.hr_employee_roster;
  out_row public.hr_employee_roster;
BEGIN
  IF NOT private.hr_is_finance_admin() THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF p_status NOT IN ('active', 'inactive', 'leave') THEN RAISE EXCEPTION 'invalid status'; END IF;

  SELECT * INTO cur FROM public.hr_employee_roster WHERE employee_id = p_employee_id;

  IF p_status = 'inactive' AND (cur IS NULL OR cur.status IS DISTINCT FROM 'inactive') AND NOT p_confirm_deactivate THEN
    RAISE EXCEPTION 'confirm deactivation required';
  END IF;

  INSERT INTO public.hr_employee_roster AS r (employee_id, status, joining_date, deactivated_at, reactivated_at, updated_at, updated_by)
  VALUES (
    p_employee_id,
    p_status,
    p_joining_date,
    CASE WHEN p_status = 'inactive' THEN CURRENT_DATE ELSE NULL END,
    CASE WHEN p_status = 'active' AND cur.status = 'inactive' THEN CURRENT_DATE ELSE NULL END,
    now(),
    auth.uid()
  )
  ON CONFLICT (employee_id) DO UPDATE SET
    status = EXCLUDED.status,
    joining_date = coalesce(EXCLUDED.joining_date, r.joining_date),
    deactivated_at = CASE
      WHEN EXCLUDED.status = 'inactive' AND r.status IS DISTINCT FROM 'inactive' THEN CURRENT_DATE
      ELSE r.deactivated_at
    END,
    reactivated_at = CASE
      WHEN EXCLUDED.status = 'active' AND r.status = 'inactive' THEN CURRENT_DATE
      ELSE r.reactivated_at
    END,
    updated_at = now(),
    updated_by = auth.uid()
  RETURNING * INTO out_row;

  PERFORM private.hr_audit('roster_upsert', p_employee_id, p_employee_id, jsonb_build_object('status', p_status));
  RETURN out_row;
END;
$$;

REVOKE ALL ON FUNCTION public.hr_upsert_employee_roster(text, text, date, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hr_upsert_employee_roster(text, text, date, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.hr_add_banking_account(
  p_employee_id text,
  p_provider_id text,
  p_holder_name text,
  p_account_ref text,
  p_is_iban boolean,
  p_effective_from date DEFAULT CURRENT_DATE,
  p_other_label text DEFAULT NULL,
  p_note text DEFAULT ''
)
RETURNS public.hr_banking_accounts_masked
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
SET row_security = off
AS $$
DECLARE
  ref_norm text;
  last4 text;
  new_id uuid;
  out_row public.hr_banking_accounts_masked;
BEGIN
  IF NOT private.hr_is_finance_admin() THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF p_holder_name IS NULL OR btrim(p_holder_name) = '' THEN RAISE EXCEPTION 'holder name required'; END IF;
  IF p_provider_id IS NULL OR btrim(p_provider_id) = '' THEN RAISE EXCEPTION 'provider required'; END IF;

  ref_norm := upper(regexp_replace(p_account_ref, '[\s-]', '', 'g'));
  IF ref_norm IS NULL OR ref_norm = '' THEN RAISE EXCEPTION 'account / IBAN required'; END IF;
  IF p_is_iban AND ref_norm !~ '^PK[0-9]{2}[A-Z]{4}[0-9]{16}$' THEN
    RAISE EXCEPTION 'invalid Pakistan IBAN format';
  END IF;

  last4 := right(ref_norm, 4);

  UPDATE public.hr_banking_accounts
  SET superseded_at = coalesce(p_effective_from, CURRENT_DATE)
  WHERE employee_id = p_employee_id AND superseded_at IS NULL;

  INSERT INTO public.hr_banking_accounts (
    employee_id, provider_id, other_label, holder_name, is_iban,
    account_ref_ciphertext, account_last4, effective_from, note, created_by
  ) VALUES (
    p_employee_id, p_provider_id, p_other_label, btrim(p_holder_name), p_is_iban,
    private.hr_encrypt_account_ref(ref_norm), last4, coalesce(p_effective_from, CURRENT_DATE),
    coalesce(p_note, ''), auth.uid()
  ) RETURNING id INTO new_id;

  PERFORM private.hr_audit(
    'banking_add',
    p_employee_id,
    new_id::text,
    jsonb_build_object('provider_id', p_provider_id, 'last4', last4, 'is_iban', p_is_iban)
  );

  SELECT * INTO out_row FROM public.hr_banking_accounts_masked WHERE id = new_id;
  RETURN out_row;
END;
$$;

REVOKE ALL ON FUNCTION public.hr_add_banking_account(text, text, text, text, boolean, date, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hr_add_banking_account(text, text, text, text, boolean, date, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.hr_reveal_banking_account(p_account_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
SET row_security = off
AS $$
DECLARE
  row public.hr_banking_accounts;
  plain text;
BEGIN
  IF NOT private.hr_is_finance_admin() THEN RAISE EXCEPTION 'not authorized'; END IF;
  SELECT * INTO row FROM public.hr_banking_accounts WHERE id = p_account_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;
  plain := private.hr_decrypt_account_ref(row.account_ref_ciphertext);
  PERFORM private.hr_audit(
    'banking_reveal',
    row.employee_id,
    p_account_id::text,
    jsonb_build_object('last4', row.account_last4)
  );
  RETURN plain;
END;
$$;

REVOKE ALL ON FUNCTION public.hr_reveal_banking_account(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hr_reveal_banking_account(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.hr_upsert_salary_due(
  p_employee_id text,
  p_month text,
  p_amount_due_pkr integer,
  p_banking_account_id uuid DEFAULT NULL
)
RETURNS public.hr_salary_payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
SET row_security = off
AS $$
DECLARE
  out_row public.hr_salary_payments;
  paid integer;
  st text;
BEGIN
  IF NOT private.hr_is_finance_admin() THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF p_amount_due_pkr IS NULL OR p_amount_due_pkr < 0 THEN RAISE EXCEPTION 'invalid due amount'; END IF;
  IF p_month !~ '^[0-9]{4}-[0-9]{2}$' THEN RAISE EXCEPTION 'invalid month'; END IF;

  SELECT amount_paid_pkr, status INTO paid, st
  FROM public.hr_salary_payments
  WHERE employee_id = p_employee_id AND month = p_month;

  paid := coalesce(paid, 0);
  IF st IS DISTINCT FROM 'on_hold' THEN
    IF paid <= 0 THEN st := 'unpaid';
    ELSIF paid < p_amount_due_pkr THEN st := 'partial';
    ELSE st := 'paid';
    END IF;
  END IF;

  INSERT INTO public.hr_salary_payments AS p (
    employee_id, month, amount_due_pkr, amount_paid_pkr, status, banking_account_id, updated_at, updated_by
  ) VALUES (
    p_employee_id, p_month, p_amount_due_pkr, paid, coalesce(st, 'unpaid'), p_banking_account_id, now(), auth.uid()
  )
  ON CONFLICT (employee_id, month) DO UPDATE SET
    amount_due_pkr = EXCLUDED.amount_due_pkr,
    status = CASE WHEN p.status = 'on_hold' THEN 'on_hold' ELSE EXCLUDED.status END,
    banking_account_id = coalesce(EXCLUDED.banking_account_id, p.banking_account_id),
    updated_at = now(),
    updated_by = auth.uid()
  RETURNING * INTO out_row;

  INSERT INTO public.hr_salary_payment_events (payment_id, event_type, amount_pkr, status_after, note, created_by)
  VALUES (out_row.id, 'due_set', p_amount_due_pkr, out_row.status, 'due upsert', auth.uid());

  PERFORM private.hr_audit('salary_due_upsert', p_employee_id, out_row.id::text,
    jsonb_build_object('month', p_month, 'due', p_amount_due_pkr, 'status', out_row.status));
  RETURN out_row;
END;
$$;

REVOKE ALL ON FUNCTION public.hr_upsert_salary_due(text, text, integer, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hr_upsert_salary_due(text, text, integer, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.hr_record_salary_payment(
  p_payment_id uuid,
  p_add_pkr integer,
  p_paid_on date DEFAULT CURRENT_DATE,
  p_note text DEFAULT ''
)
RETURNS public.hr_salary_payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
SET row_security = off
AS $$
DECLARE
  row public.hr_salary_payments;
  new_paid integer;
  st text;
BEGIN
  IF NOT private.hr_is_finance_admin() THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF p_add_pkr IS NULL OR p_add_pkr <= 0 THEN RAISE EXCEPTION 'payment amount must be positive whole PKR'; END IF;

  SELECT * INTO row FROM public.hr_salary_payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'payment not found'; END IF;
  IF row.status = 'on_hold' THEN RAISE EXCEPTION 'release hold before recording a payment'; END IF;

  new_paid := least(row.amount_due_pkr, row.amount_paid_pkr + p_add_pkr);
  IF new_paid <= 0 THEN st := 'unpaid';
  ELSIF new_paid < row.amount_due_pkr THEN st := 'partial';
  ELSE st := 'paid';
  END IF;

  UPDATE public.hr_salary_payments
  SET amount_paid_pkr = new_paid,
      status = st,
      paid_on = coalesce(p_paid_on, CURRENT_DATE),
      note = CASE WHEN p_note IS NULL OR p_note = '' THEN note ELSE p_note END,
      updated_at = now(),
      updated_by = auth.uid()
  WHERE id = p_payment_id
  RETURNING * INTO row;

  INSERT INTO public.hr_salary_payment_events (payment_id, event_type, amount_pkr, status_after, note, created_by)
  VALUES (p_payment_id, 'partial_pay', p_add_pkr, st, coalesce(p_note, ''), auth.uid());

  PERFORM private.hr_audit('salary_partial_pay', row.employee_id, p_payment_id::text,
    jsonb_build_object('add', p_add_pkr, 'paid_total', new_paid, 'status', st));
  RETURN row;
END;
$$;

REVOKE ALL ON FUNCTION public.hr_record_salary_payment(uuid, integer, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hr_record_salary_payment(uuid, integer, date, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.hr_set_salary_status(
  p_payment_id uuid,
  p_status text
)
RETURNS public.hr_salary_payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
SET row_security = off
AS $$
DECLARE
  row public.hr_salary_payments;
BEGIN
  IF NOT private.hr_is_finance_admin() THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF p_status NOT IN ('unpaid', 'partial', 'paid', 'on_hold') THEN RAISE EXCEPTION 'invalid status'; END IF;

  SELECT * INTO row FROM public.hr_salary_payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'payment not found'; END IF;

  IF p_status = 'unpaid' THEN
    UPDATE public.hr_salary_payments
    SET status = 'unpaid', amount_paid_pkr = 0, paid_on = NULL, updated_at = now(), updated_by = auth.uid()
    WHERE id = p_payment_id RETURNING * INTO row;
  ELSIF p_status = 'paid' THEN
    UPDATE public.hr_salary_payments
    SET status = 'paid', amount_paid_pkr = amount_due_pkr,
        paid_on = coalesce(paid_on, CURRENT_DATE), updated_at = now(), updated_by = auth.uid()
    WHERE id = p_payment_id RETURNING * INTO row;
  ELSIF p_status = 'on_hold' THEN
    UPDATE public.hr_salary_payments
    SET status = 'on_hold', updated_at = now(), updated_by = auth.uid()
    WHERE id = p_payment_id RETURNING * INTO row;
  ELSE
    -- partial: keep amounts
    UPDATE public.hr_salary_payments
    SET status = CASE
          WHEN amount_paid_pkr <= 0 THEN 'unpaid'
          WHEN amount_paid_pkr < amount_due_pkr THEN 'partial'
          ELSE 'paid'
        END,
        updated_at = now(), updated_by = auth.uid()
    WHERE id = p_payment_id RETURNING * INTO row;
  END IF;

  INSERT INTO public.hr_salary_payment_events (payment_id, event_type, status_after, note, created_by)
  VALUES (p_payment_id, 'status_change', row.status, 'manual status', auth.uid());

  PERFORM private.hr_audit('salary_status', row.employee_id, p_payment_id::text, jsonb_build_object('status', row.status));
  RETURN row;
END;
$$;

REVOKE ALL ON FUNCTION public.hr_set_salary_status(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hr_set_salary_status(uuid, text) TO authenticated;
