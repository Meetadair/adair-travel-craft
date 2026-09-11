CREATE TABLE public.trip_reminders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  kind text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trip_id, kind)
);

GRANT ALL ON public.trip_reminders TO service_role;

ALTER TABLE public.trip_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trip_reminders_no_direct_access"
  ON public.trip_reminders FOR SELECT TO authenticated USING (false);

CREATE INDEX trip_reminders_trip_idx ON public.trip_reminders (trip_id);