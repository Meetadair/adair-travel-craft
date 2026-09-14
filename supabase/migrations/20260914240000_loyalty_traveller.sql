-- A loyalty card belongs to whoever holds it, not just the account holder.
--
-- loyalty_memberships was a flat, account-wide list: every saved frequent-
-- flyer or hotel number was credited to the lead traveller only (see
-- createFlightOrder in duffel-book.server.ts), so a spouse's or child's own
-- membership number could be saved in the wallet but was never actually sent
-- to the airline for them. The traveller_profiles migration already
-- anticipated this ("Frequent flyer and hotel numbers live in the loyalty
-- wallet already; this is only the flag that says whose wallet to use on a
-- booking.") — this finishes that link.
--
-- NULL stays the account holder, so every existing row keeps its current
-- meaning with no backfill needed.
ALTER TABLE public.loyalty_memberships
  ADD COLUMN IF NOT EXISTS traveller_id uuid REFERENCES public.travel_companions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS loyalty_memberships_traveller_idx
  ON public.loyalty_memberships (traveller_id);

COMMENT ON COLUMN public.loyalty_memberships.traveller_id IS
  'Whose card this is. NULL means the account holder. Set to a travel_companions row so a family member''s own number is credited to them, not the lead traveller, at booking.';
