-- Our own tips, and the places people actually go to.
--
-- Two mismatches made the admin panel lie about what it could save. The kind
-- dropdown offers café, bar, wine bar, cocktail bar, rooftop and club; the table
-- accepted only hotel, restaurant and sight, so choosing any of the others threw
-- a constraint error after the form said it was saving. And the Getaway page
-- reads places with review_status in ('approved','editorial') while the check
-- constraint allowed only pending, approved and rejected — 'editorial' could
-- never exist, so that half of the filter matched nothing.
--
-- 'editorial' now means what it always should have: written by us, from our own
-- trip, rather than submitted by a creator and reviewed. That is the difference
-- the card needs in order to say "from our own trip" honestly.

ALTER TABLE public.getaway_places DROP CONSTRAINT IF EXISTS getaway_places_kind_check;
ALTER TABLE public.getaway_places ADD CONSTRAINT getaway_places_kind_check
  CHECK (kind IN ('hotel', 'restaurant', 'cafe', 'bar', 'wine_bar', 'cocktail_bar',
                  'rooftop', 'club', 'sight'));

ALTER TABLE public.getaway_places DROP CONSTRAINT IF EXISTS getaway_places_review_status_check;
ALTER TABLE public.getaway_places ADD CONSTRAINT getaway_places_review_status_check
  CHECK (review_status IN ('pending', 'approved', 'rejected', 'editorial'));

COMMENT ON COLUMN public.getaway_places.review_status IS
  'editorial = our own tip, written by the team; approved/pending/rejected = a creator submission and where it stands.';
COMMENT ON COLUMN public.getaway_places.visited_on IS
  'When we were actually there. What turns a listing into a recommendation.';
