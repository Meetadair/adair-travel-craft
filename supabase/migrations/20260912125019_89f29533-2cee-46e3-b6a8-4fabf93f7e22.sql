CREATE TABLE public.planning_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  schengen_clear_min integer NOT NULL DEFAULT 45,
  non_schengen_clear_min integer NOT NULL DEFAULT 75,
  safety_margin_min integer NOT NULL DEFAULT 30,
  business_extra_margin_min integer NOT NULL DEFAULT 20,
  transfer_base_min integer NOT NULL DEFAULT 12,
  transfer_min_per_km numeric NOT NULL DEFAULT 1.6,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.planning_rules TO authenticated;
GRANT ALL ON public.planning_rules TO service_role;

ALTER TABLE public.planning_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in travellers can read planning rules"
  ON public.planning_rules FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can change planning rules"
  ON public.planning_rules FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER planning_rules_updated_at
  BEFORE UPDATE ON public.planning_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.planning_rules (name) VALUES ('default');