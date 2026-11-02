CREATE TABLE public.tracker_sections (
  id text PRIMARY KEY,
  data jsonb NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.tracker_sections TO service_role;
ALTER TABLE public.tracker_sections ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.tracker_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := clock_timestamp();
  IF TG_OP = 'UPDATE' THEN NEW.version := OLD.version + 1; END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER tracker_sections_touch
BEFORE INSERT OR UPDATE ON public.tracker_sections
FOR EACH ROW EXECUTE FUNCTION public.tracker_touch();