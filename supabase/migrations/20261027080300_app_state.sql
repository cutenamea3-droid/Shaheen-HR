-- Admin & Attendance durable state (one JSON blob per authenticated user).
-- NOTE: Admin uses a SEPARATE Lovable Cloud backend
-- (src/admin/integrations/supabase/client.ts), not the Driver .env project.
-- Run this SQL in the Admin project's SQL editor if app_state / RLS are missing.

CREATE TABLE IF NOT EXISTS public.app_state (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_state ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.app_state TO authenticated;
GRANT ALL ON public.app_state TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'app_state' AND policyname = 'app_state_select_own'
  ) THEN
    CREATE POLICY app_state_select_own
      ON public.app_state FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'app_state' AND policyname = 'app_state_insert_own'
  ) THEN
    CREATE POLICY app_state_insert_own
      ON public.app_state FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'app_state' AND policyname = 'app_state_update_own'
  ) THEN
    CREATE POLICY app_state_update_own
      ON public.app_state FOR UPDATE TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;
