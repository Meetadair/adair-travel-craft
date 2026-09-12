CREATE TABLE public.providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  provider text NOT NULL,
  label text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  priority integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category, provider)
);

GRANT SELECT ON public.providers TO authenticated;
GRANT ALL ON public.providers TO service_role;

ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users read provider switches"
  ON public.providers FOR SELECT TO authenticated USING (true);

CREATE TRIGGER providers_updated_at
  BEFORE UPDATE ON public.providers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.providers (category, provider, label, enabled, priority) VALUES
  ('rides', 'uber', 'Uber', true, 10),
  ('rides', 'bolt', 'Bolt', true, 20),
  ('restaurants', 'thefork', 'TheFork', true, 10),
  ('restaurants', 'opentable', 'OpenTable', true, 20);

INSERT INTO public.pricing_rules (plan, line_type, markup_bps, discount_bps, change_fee_minor, currency)
SELECT p.plan, v.line_type, v.markup_bps,
       COALESCE(MAX(f.discount_bps), 0), 0, 'EUR'
FROM (SELECT DISTINCT plan FROM public.pricing_rules) p
CROSS JOIN (VALUES ('ride', 1000), ('restaurant', 0)) AS v(line_type, markup_bps)
LEFT JOIN public.pricing_rules f ON f.plan = p.plan AND f.line_type = 'flight'
GROUP BY p.plan, v.line_type, v.markup_bps;