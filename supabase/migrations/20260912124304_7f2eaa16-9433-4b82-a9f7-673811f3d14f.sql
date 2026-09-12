CREATE TABLE public.payment_providers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider text NOT NULL UNIQUE,
  label text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  priority integer NOT NULL DEFAULT 100,
  settlement_model text NOT NULL DEFAULT 'supplier-of-record',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.payment_providers TO authenticated;
GRANT UPDATE ON public.payment_providers TO authenticated;
GRANT ALL ON public.payment_providers TO service_role;

ALTER TABLE public.payment_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can read payment providers"
  ON public.payment_providers FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can switch payment providers"
  ON public.payment_providers FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER payment_providers_updated_at
  BEFORE UPDATE ON public.payment_providers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.payment_providers (provider, label, enabled, priority, settlement_model)
VALUES
  ('duffel', 'Duffel Payments', true, 10, 'supplier-of-record'),
  ('stripe', 'Stripe', false, 20, 'merchant-of-record');

ALTER TABLE public.payments ADD COLUMN settlement_model text;