CREATE TABLE public.traveller_place_memory (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  place text NOT NULL,
  item_kind text NOT NULL CHECK (item_kind IN ('hotel','restaurant','car_supplier','airline','neighbourhood')),
  item_ref text,
  item_name text NOT NULL,
  times_chosen integer NOT NULL DEFAULT 1,
  last_chosen_at timestamp with time zone NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'booked' CHECK (source IN ('booked','stated','swapped_to')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, place, item_kind, item_name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.traveller_place_memory TO authenticated;
GRANT ALL ON public.traveller_place_memory TO service_role;

ALTER TABLE public.traveller_place_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own place memory only"
  ON public.traveller_place_memory FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER traveller_place_memory_updated_at
  BEFORE UPDATE ON public.traveller_place_memory
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.traveller_patterns (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pattern_kind text NOT NULL,
  value text NOT NULL,
  confidence numeric NOT NULL DEFAULT 0,
  evidence_count integer NOT NULL DEFAULT 0,
  first_seen timestamp with time zone NOT NULL DEFAULT now(),
  last_seen timestamp with time zone NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested','confirmed','rejected')),
  asked_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, pattern_kind, value)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.traveller_patterns TO authenticated;
GRANT ALL ON public.traveller_patterns TO service_role;

ALTER TABLE public.traveller_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own patterns only"
  ON public.traveller_patterns FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER traveller_patterns_updated_at
  BEFORE UPDATE ON public.traveller_patterns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();