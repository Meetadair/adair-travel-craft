CREATE TABLE public.global_stay_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_key text NOT NULL UNIQUE,
  label text NOT NULL,
  hint text,
  terms text[] NOT NULL DEFAULT '{}',
  allowed_types text[] NOT NULL DEFAULT '{}',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.global_stay_rules TO authenticated;
GRANT ALL ON public.global_stay_rules TO service_role;

ALTER TABLE public.global_stay_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in travellers can read the global stay rules"
  ON public.global_stay_rules FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage the global stay rules"
  ON public.global_stay_rules FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER global_stay_rules_updated_at BEFORE UPDATE ON public.global_stay_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.global_stay_rules (rule_key, label, hint, terms, allowed_types) VALUES
  ('no_hostel', 'Exclude hostels', 'Any property described as a hostel is never offered.', ARRAY['hostel','hostal','backpacker'], '{}'),
  ('no_shared_bathroom', 'Exclude shared-bathroom rooms', 'Rooms without a private bathroom are never offered.', ARRAY['shared bathroom','shared bath','communal bathroom','bathroom down the hall'], '{}'),
  ('no_dormitory', 'Exclude dormitories', 'Dorms, bunk rooms and shared rooms are never offered.', ARRAY['dormitory','dorm bed','dorm room','bunk bed','shared room','mixed dorm'], '{}'),
  ('no_smoking_rooms', 'Exclude smoking rooms', 'Only non-smoking rooms are offered.', ARRAY['smoking room','smoking permitted','smoking allowed'], '{}'),
  ('standard_floor', 'Only hotel, apartment, villa or resort standard', 'Property types below this standard are never offered.', '{}', ARRAY['hotel','aparthotel','apartment','apartments','serviced apartment','villa','resort','residence']);
