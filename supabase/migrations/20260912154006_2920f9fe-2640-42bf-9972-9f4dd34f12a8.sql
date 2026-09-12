CREATE TABLE public.loyalty_memberships (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('airline', 'hotel', 'car')),
  programme_code text NOT NULL,
  programme_label text NOT NULL,
  airline_iata text,
  member_number_encrypted text NOT NULL,
  member_number_last4 text NOT NULL,
  tier text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_memberships TO authenticated;
GRANT ALL ON public.loyalty_memberships TO service_role;

ALTER TABLE public.loyalty_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Travellers manage their own loyalty memberships"
  ON public.loyalty_memberships FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX loyalty_memberships_user_idx ON public.loyalty_memberships (user_id, category);

CREATE TRIGGER loyalty_memberships_updated_at
  BEFORE UPDATE ON public.loyalty_memberships
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();