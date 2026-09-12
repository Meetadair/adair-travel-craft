-- 1. Creator accounts
CREATE TABLE public.creators (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  handle text NOT NULL UNIQUE,
  short_code text NOT NULL UNIQUE,
  bio text,
  avatar_url text,
  platforms jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'applied' CHECK (status IN ('applied','approved','paused','rejected')),
  payout_iban_encrypted text,
  payout_iban_last4 text,
  payout_entity text,
  payout_vat_status text,
  licence_accepted_at timestamp with time zone,
  applied_at timestamp with time zone NOT NULL DEFAULT now(),
  approved_at timestamp with time zone,
  approved_by uuid REFERENCES auth.users(id),
  review_note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.creators TO authenticated;
GRANT ALL ON public.creators TO service_role;
ALTER TABLE public.creators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creators see their own profile" ON public.creators
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "Anyone signed in can apply" ON public.creators
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND status = 'applied');
CREATE POLICY "Creators edit their own profile" ON public.creators
  FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE TRIGGER creators_updated_at BEFORE UPDATE ON public.creators
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Only an admin may change a creator's standing; everything else stays editable.
CREATE OR REPLACE FUNCTION public.guard_creator_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin(auth.uid()) THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
       OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
       OR NEW.short_code IS DISTINCT FROM OLD.short_code THEN
      RAISE EXCEPTION 'not allowed to change creator standing';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER creators_guard_status BEFORE UPDATE ON public.creators
  FOR EACH ROW EXECUTE FUNCTION public.guard_creator_status();

-- Helper: is this creator row mine? Used by the ledger policies.
CREATE OR REPLACE FUNCTION public.owns_creator(_creator_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.creators c WHERE c.id = _creator_id AND c.user_id = auth.uid())
$$;

-- 2. Commission: configuration, not code
CREATE TABLE public.creator_commission_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('line','subscription')),
  line_type text,
  plan text,
  -- Share of OUR margin, in basis points. We can only share what we earn.
  share_bps integer NOT NULL DEFAULT 0 CHECK (share_bps BETWEEN 0 AND 10000),
  flat_minor integer NOT NULL DEFAULT 0 CHECK (flat_minor >= 0),
  currency text NOT NULL DEFAULT 'EUR',
  earning_window_months integer NOT NULL DEFAULT 12,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.creator_commission_rules TO authenticated;
GRANT ALL ON public.creator_commission_rules TO service_role;
ALTER TABLE public.creator_commission_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users can read commission rules" ON public.creator_commission_rules
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins change commission rules" ON public.creator_commission_rules
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins add commission rules" ON public.creator_commission_rules
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER creator_commission_rules_updated_at BEFORE UPDATE ON public.creator_commission_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE UNIQUE INDEX creator_commission_rules_line_key
  ON public.creator_commission_rules (kind, coalesce(line_type, ''), coalesce(plan, ''));

INSERT INTO public.creator_commission_rules (kind, line_type, plan, share_bps, flat_minor) VALUES
  ('line', 'stay', NULL, 3000, 0),
  ('line', 'car', NULL, 3000, 0),
  ('line', 'flight', NULL, 2000, 0),
  ('line', 'extras', NULL, 2000, 0),
  ('subscription', NULL, 'select', 0, 1000),
  ('subscription', NULL, 'signature', 0, 2500);

-- 3. Attribution: 90 days to attribute, 12 months of earning after that
CREATE TABLE public.creator_attributions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  code text NOT NULL,
  attributed_at timestamp with time zone NOT NULL DEFAULT now(),
  attribution_expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '90 days'),
  earning_until timestamp with time zone NOT NULL DEFAULT (now() + interval '12 months'),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT ON public.creator_attributions TO authenticated;
GRANT ALL ON public.creator_attributions TO service_role;
ALTER TABLE public.creator_attributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins see attributions" ON public.creator_attributions
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE TABLE public.creator_clicks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id uuid NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'link',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT ON public.creator_clicks TO authenticated;
GRANT ALL ON public.creator_clicks TO service_role;
ALTER TABLE public.creator_clicks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins see clicks" ON public.creator_clicks
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE INDEX creator_clicks_creator_idx ON public.creator_clicks (creator_id, created_at DESC);

-- 4. Payouts and the earnings ledger
CREATE TABLE public.creator_payouts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id uuid NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  period_month date NOT NULL,
  amount_minor integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  status text NOT NULL DEFAULT 'due' CHECK (status IN ('due','paid')),
  reference text,
  paid_at timestamp with time zone,
  paid_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (creator_id, period_month)
);
GRANT SELECT ON public.creator_payouts TO authenticated;
GRANT ALL ON public.creator_payouts TO service_role;
ALTER TABLE public.creator_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Creators see their own payouts" ON public.creator_payouts
  FOR SELECT TO authenticated USING (public.owns_creator(creator_id) OR public.is_admin(auth.uid()));
CREATE TRIGGER creator_payouts_updated_at BEFORE UPDATE ON public.creator_payouts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.creator_earnings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id uuid NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  trip_id uuid REFERENCES public.trips(id) ON DELETE SET NULL,
  trip_item_id uuid REFERENCES public.trip_items(id) ON DELETE SET NULL,
  payout_id uuid REFERENCES public.creator_payouts(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'line' CHECK (kind IN ('line','subscription')),
  line_type text,
  -- Why it was earned: the customer came through their link, or they curated the place.
  basis text NOT NULL DEFAULT 'attributed' CHECK (basis IN ('attributed','recommended','subscription')),
  margin_minor integer NOT NULL DEFAULT 0,
  share_bps integer NOT NULL DEFAULT 0,
  amount_minor integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','reversed','paid')),
  confirmable_at timestamp with time zone,
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (creator_id, trip_item_id, basis)
);
GRANT SELECT ON public.creator_earnings TO authenticated;
GRANT ALL ON public.creator_earnings TO service_role;
ALTER TABLE public.creator_earnings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Creators see their own earnings" ON public.creator_earnings
  FOR SELECT TO authenticated USING (public.owns_creator(creator_id) OR public.is_admin(auth.uid()));
CREATE TRIGGER creator_earnings_updated_at BEFORE UPDATE ON public.creator_earnings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX creator_earnings_creator_idx ON public.creator_earnings (creator_id, created_at DESC);

-- 5. Creator-submitted places, held back until the editorial team approves
ALTER TABLE public.getaway_places
  ADD COLUMN submitted_by_creator_id uuid REFERENCES public.creators(id) ON DELETE SET NULL,
  ADD COLUMN review_status text NOT NULL DEFAULT 'approved'
    CHECK (review_status IN ('pending','approved','rejected')),
  ADD COLUMN review_note text,
  ADD COLUMN visited_on date,
  ADD COLUMN post_url text,
  ADD COLUMN photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN licence_accepted_at timestamp with time zone;