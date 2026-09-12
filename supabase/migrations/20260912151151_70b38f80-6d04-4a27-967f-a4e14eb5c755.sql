ALTER TABLE public.calendar_connections
  ADD COLUMN IF NOT EXISTS read_enabled boolean NOT NULL DEFAULT false;

CREATE TABLE public.calendar_trip_hints (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  event_id text NOT NULL,
  title text NOT NULL,
  location text NOT NULL,
  city text NOT NULL,
  iata text,
  starts_at timestamp with time zone NOT NULL,
  ends_at timestamp with time zone NOT NULL,
  dismissed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider, event_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_trip_hints TO authenticated;
GRANT ALL ON public.calendar_trip_hints TO service_role;

ALTER TABLE public.calendar_trip_hints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own calendar trip hints"
  ON public.calendar_trip_hints FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER set_calendar_trip_hints_updated_at
  BEFORE UPDATE ON public.calendar_trip_hints
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();