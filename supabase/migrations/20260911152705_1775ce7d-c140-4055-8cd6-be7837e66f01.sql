CREATE TABLE public.hotel_requests_missed (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name_requested text NOT NULL,
  destination_iata text,
  checkin_date date,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.hotel_requests_missed TO service_role;

ALTER TABLE public.hotel_requests_missed ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hotel_requests_missed_no_direct_access"
  ON public.hotel_requests_missed FOR SELECT TO authenticated USING (false);

CREATE INDEX hotel_requests_missed_created_at_idx ON public.hotel_requests_missed (created_at DESC);