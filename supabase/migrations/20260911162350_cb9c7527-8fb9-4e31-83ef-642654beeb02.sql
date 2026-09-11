CREATE TABLE public.insurance_rates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL DEFAULT 'standard',
  currency text NOT NULL DEFAULT 'EUR',
  base_daily_minor integer NOT NULL DEFAULT 450,
  minimum_minor integer NOT NULL DEFAULT 1200,
  active boolean NOT NULL DEFAULT true,
  effective_from timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.insurance_rates TO authenticated;
GRANT ALL ON public.insurance_rates TO service_role;

ALTER TABLE public.insurance_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users read insurance rates"
  ON public.insurance_rates FOR SELECT TO authenticated USING (true);

CREATE TRIGGER insurance_rates_updated_at
  BEFORE UPDATE ON public.insurance_rates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.insurance_rates (name, currency, base_daily_minor, minimum_minor, active)
VALUES ('standard', 'EUR', 450, 1200, true);