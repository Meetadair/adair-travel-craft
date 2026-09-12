CREATE TABLE public.travel_companions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL,
  given_name_encrypted text NOT NULL,
  family_name_encrypted text NOT NULL,
  born_on_encrypted text,
  passport_number_encrypted text,
  passport_last4 text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.travel_companions TO authenticated;
GRANT ALL ON public.travel_companions TO service_role;

ALTER TABLE public.travel_companions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own companions" ON public.travel_companions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER travel_companions_updated_at
  BEFORE UPDATE ON public.travel_companions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.learned_overrides (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  subject text NOT NULL,
  action text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, subject)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.learned_overrides TO authenticated;
GRANT ALL ON public.learned_overrides TO service_role;

ALTER TABLE public.learned_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own learned overrides" ON public.learned_overrides
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.trip_changes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  method text NOT NULL,
  before jsonb NOT NULL DEFAULT '{}'::jsonb,
  after jsonb NOT NULL DEFAULT '{}'::jsonb,
  difference_minor integer NOT NULL DEFAULT 0,
  fee_minor integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  status text NOT NULL DEFAULT 'quoted',
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_changes TO authenticated;
GRANT ALL ON public.trip_changes TO service_role;

ALTER TABLE public.trip_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own trip changes" ON public.trip_changes
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE TRIGGER trip_changes_updated_at
  BEFORE UPDATE ON public.trip_changes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.trip_items
  ADD COLUMN IF NOT EXISTS ancillaries jsonb NOT NULL DEFAULT '[]'::jsonb;