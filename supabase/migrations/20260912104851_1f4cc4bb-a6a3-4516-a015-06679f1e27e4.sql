CREATE TABLE public.saved_cards (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'duffel',
  provider_card_id text NOT NULL,
  brand text,
  last4 text,
  exp_month integer,
  exp_year integer,
  cardholder_name text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider, provider_card_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_cards TO authenticated;
GRANT ALL ON public.saved_cards TO service_role;

ALTER TABLE public.saved_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own saved cards" ON public.saved_cards
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER saved_cards_updated_at BEFORE UPDATE ON public.saved_cards
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS method text,
  ADD COLUMN IF NOT EXISTS card_brand text,
  ADD COLUMN IF NOT EXISTS card_last4 text,
  ADD COLUMN IF NOT EXISTS three_ds_status text,
  ADD COLUMN IF NOT EXISTS failure_note text;

CREATE UNIQUE INDEX IF NOT EXISTS payments_user_idempotency_key
  ON public.payments (user_id, idempotency_key);