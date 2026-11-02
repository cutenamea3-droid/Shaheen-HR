-- Driver Compliance section blobs (one row per tracker section id).
-- Applied to the Driver Compliance Supabase project (VITE_SUPABASE_* / .env).

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

-- Baseline policies (replaced by driver_portal_accounts migration when that is applied).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tracker_sections' AND policyname = 'tracker_sections_authenticated_select'
  ) THEN
    CREATE POLICY tracker_sections_authenticated_select
      ON public.tracker_sections FOR SELECT TO authenticated
      USING (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tracker_sections' AND policyname = 'tracker_sections_authenticated_insert'
  ) THEN
    CREATE POLICY tracker_sections_authenticated_insert
      ON public.tracker_sections FOR INSERT TO authenticated
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tracker_sections' AND policyname = 'tracker_sections_authenticated_update'
  ) THEN
    CREATE POLICY tracker_sections_authenticated_update
      ON public.tracker_sections FOR UPDATE TO authenticated
      USING (auth.uid() IS NOT NULL)
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END
$$;
