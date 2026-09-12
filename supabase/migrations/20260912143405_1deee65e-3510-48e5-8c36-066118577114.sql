CREATE TABLE public.supplier_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider text NOT NULL DEFAULT 'supplier',
  event_id text NOT NULL,
  event_kind text NOT NULL,
  order_reference text,
  received_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (provider, event_id)
);

GRANT ALL ON public.supplier_events TO service_role;

ALTER TABLE public.supplier_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read supplier events"
  ON public.supplier_events FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));