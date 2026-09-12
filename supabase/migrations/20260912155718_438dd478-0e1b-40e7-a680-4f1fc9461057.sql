CREATE TABLE public.loyalty_earning_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category IN ('airline','hotel','car')),
  programme_code text NOT NULL,
  matcher text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category, programme_code, matcher)
);

GRANT SELECT ON public.loyalty_earning_rules TO authenticated;
GRANT ALL ON public.loyalty_earning_rules TO service_role;

ALTER TABLE public.loyalty_earning_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can read loyalty earning rules"
  ON public.loyalty_earning_rules FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage loyalty earning rules"
  ON public.loyalty_earning_rules FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER loyalty_earning_rules_updated_at
  BEFORE UPDATE ON public.loyalty_earning_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.loyalty_memberships
  ALTER COLUMN member_number_encrypted DROP NOT NULL,
  ALTER COLUMN member_number_last4 DROP NOT NULL;

INSERT INTO public.loyalty_earning_rules (category, programme_code, matcher) VALUES
  ('airline','miles_more','LH'),('airline','miles_more','LO'),('airline','miles_more','OS'),('airline','miles_more','LX'),('airline','miles_more','SN'),('airline','miles_more','UA'),('airline','miles_more','TK'),('airline','miles_more','SK'),('airline','miles_more','A3'),
  ('airline','lot_miles','LO'),('airline','lot_miles','LH'),('airline','lot_miles','OS'),('airline','lot_miles','LX'),('airline','lot_miles','SN'),
  ('airline','flying_blue','AF'),('airline','flying_blue','KL'),('airline','flying_blue','DL'),('airline','flying_blue','AZ'),('airline','flying_blue','KE'),('airline','flying_blue','MU'),
  ('airline','executive_club','BA'),('airline','executive_club','IB'),('airline','executive_club','EI'),('airline','executive_club','AY'),('airline','executive_club','QR'),('airline','executive_club','AA'),('airline','executive_club','CX'),
  ('airline','iberia_plus','IB'),('airline','iberia_plus','BA'),('airline','iberia_plus','EI'),('airline','iberia_plus','AY'),('airline','iberia_plus','AA'),
  ('airline','aadvantage','AA'),('airline','aadvantage','BA'),('airline','aadvantage','IB'),('airline','aadvantage','AY'),('airline','aadvantage','QR'),('airline','aadvantage','JL'),
  ('airline','skymiles','DL'),('airline','skymiles','AF'),('airline','skymiles','KL'),('airline','skymiles','AZ'),('airline','skymiles','KE'),
  ('airline','mileageplus','UA'),('airline','mileageplus','LH'),('airline','mileageplus','LO'),('airline','mileageplus','OS'),('airline','mileageplus','LX'),('airline','mileageplus','SN'),('airline','mileageplus','TK'),('airline','mileageplus','SK'),
  ('airline','turkish_miles','TK'),('airline','turkish_miles','LH'),('airline','turkish_miles','LO'),('airline','turkish_miles','UA'),('airline','turkish_miles','LX'),('airline','turkish_miles','OS'),
  ('airline','eurobonus','SK'),('airline','eurobonus','LH'),('airline','eurobonus','LO'),('airline','eurobonus','UA'),('airline','eurobonus','TK'),
  ('airline','emirates_skywards','EK'),('airline','emirates_skywards','FZ'),
  ('airline','qatar_privilege','QR'),('airline','qatar_privilege','BA'),('airline','qatar_privilege','IB'),('airline','qatar_privilege','AA'),('airline','qatar_privilege','AY'),
  ('hotel','marriott_bonvoy','marriott'),('hotel','marriott_bonvoy','sheraton'),('hotel','marriott_bonvoy','westin'),('hotel','marriott_bonvoy','ritz-carlton'),('hotel','marriott_bonvoy','st. regis'),('hotel','marriott_bonvoy','w hotel'),('hotel','marriott_bonvoy','courtyard'),('hotel','marriott_bonvoy','moxy'),('hotel','marriott_bonvoy','le meridien'),('hotel','marriott_bonvoy','autograph'),('hotel','marriott_bonvoy','renaissance'),('hotel','marriott_bonvoy','aloft'),('hotel','marriott_bonvoy','ac hotel'),
  ('hotel','hilton_honors','hilton'),('hotel','hilton_honors','doubletree'),('hotel','hilton_honors','hampton'),('hotel','hilton_honors','conrad'),('hotel','hilton_honors','canopy'),('hotel','hilton_honors','waldorf'),('hotel','hilton_honors','curio'),('hotel','hilton_honors','embassy suites'),
  ('hotel','world_of_hyatt','hyatt'),('hotel','world_of_hyatt','andaz'),('hotel','world_of_hyatt','park hyatt'),('hotel','world_of_hyatt','thompson'),('hotel','world_of_hyatt','alila'),
  ('hotel','ihg_one','intercontinental'),('hotel','ihg_one','holiday inn'),('hotel','ihg_one','crowne plaza'),('hotel','ihg_one','kimpton'),('hotel','ihg_one','hotel indigo'),('hotel','ihg_one','staybridge'),('hotel','ihg_one','voco'),
  ('hotel','accor_all','accor'),('hotel','accor_all','sofitel'),('hotel','accor_all','novotel'),('hotel','accor_all','mercure'),('hotel','accor_all','ibis'),('hotel','accor_all','pullman'),('hotel','accor_all','mgallery'),('hotel','accor_all','raffles'),('hotel','accor_all','fairmont'),('hotel','accor_all','swissotel'),
  ('hotel','radisson_rewards','radisson'),('hotel','radisson_rewards','park inn'),('hotel','radisson_rewards','park plaza'),
  ('hotel','wyndham_rewards','wyndham'),('hotel','wyndham_rewards','ramada'),('hotel','wyndham_rewards','days inn'),('hotel','wyndham_rewards','tryp'),
  ('car','hertz_gold','hertz'),('car','hertz_gold','dollar'),('car','hertz_gold','thrifty'),
  ('car','avis_preferred','avis'),('car','avis_preferred','budget'),
  ('car','budget_fastbreak','budget'),('car','budget_fastbreak','avis'),
  ('car','sixt_card','sixt'),
  ('car','europcar_privilege','europcar'),('car','europcar_privilege','goldcar'),
  ('car','enterprise_plus','enterprise'),('car','enterprise_plus','national'),('car','enterprise_plus','alamo'),
  ('car','national_emerald','national'),('car','national_emerald','enterprise'),('car','national_emerald','alamo');