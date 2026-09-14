-- The last gap in "one place stores a person": a residential address.
--
-- Airlines don't need it, but card issuers' AVS checks do, and it is exactly
-- the kind of field a traveller expects to type once and never again. Kept
-- on travel_companions alongside everything else about the person rather
-- than a new table, for the same reason the profile fields landed there.
ALTER TABLE public.travel_companions
  ADD COLUMN IF NOT EXISTS address_line1 text,
  ADD COLUMN IF NOT EXISTS address_line2 text,
  ADD COLUMN IF NOT EXISTS address_city text,
  ADD COLUMN IF NOT EXISTS address_postcode text,
  ADD COLUMN IF NOT EXISTS address_country text;

COMMENT ON COLUMN public.travel_companions.address_line1 IS
  'Residential address, mainly for the account holder''s own row — used for card AVS checks, not sent to airlines.';
