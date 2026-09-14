-- The people on a booking, including the person doing the booking.
--
-- travel_companions held everyone a traveller flies WITH, but nothing about
-- the traveller themselves: the profile knows a full name, a home airport and
-- a plan, and an airline needs a date of birth, a title and a phone number. So
-- the account holder retyped their own passport details on every booking,
-- while their wife's were remembered.
--
-- Rather than a second table with a second set of encryption plumbing, the
-- account holder becomes a row here with is_self set. One place stores a
-- person, whoever they are, and one set of rules protects them.

ALTER TABLE public.travel_companions
  -- The account holder's own record. Exactly one per user, enforced below.
  ADD COLUMN IF NOT EXISTS is_self boolean NOT NULL DEFAULT false,
  -- How the traveller refers to them, so the assistant can ask by name:
  -- "flying with Karina?" rather than "add a second passenger".
  ADD COLUMN IF NOT EXISTS relationship text
    CHECK (relationship IS NULL OR relationship IN
      ('self','spouse','partner','child','parent','sibling','colleague','friend','other')),
  ADD COLUMN IF NOT EXISTS title text
    CHECK (title IS NULL OR title IN ('mr','ms','mrs','dr','mx')),
  ADD COLUMN IF NOT EXISTS gender text
    CHECK (gender IS NULL OR gender IN ('m','f','x')),
  -- Contact details belong to the person, not to the booking form. Encrypted
  -- with the same key as the names above.
  ADD COLUMN IF NOT EXISTS phone_encrypted text,
  ADD COLUMN IF NOT EXISTS email_encrypted text,
  -- Not secret, and both are required by airlines alongside the number.
  ADD COLUMN IF NOT EXISTS passport_country text,
  ADD COLUMN IF NOT EXISTS passport_expiry date,
  -- Frequent flyer and hotel numbers live in the loyalty wallet already; this
  -- is only the flag that says whose wallet to use on a booking.
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- One self per person. A second would silently win or lose at random on every
-- booking, depending on row order.
CREATE UNIQUE INDEX IF NOT EXISTS travel_companions_one_self
  ON public.travel_companions (user_id) WHERE is_self;

COMMENT ON COLUMN public.travel_companions.is_self IS
  'The account holder''s own traveller record. At most one per user. Pre-fills the lead traveller on every booking so nobody retypes their own passport.';
COMMENT ON COLUMN public.travel_companions.relationship IS
  'Lets the assistant ask by name — "flying with Karina?" — instead of asking for a passenger count.';
