-- Routes: multi-stop journeys, browsable by reason to go.
--
-- The itineraries table was built for one destination. A route runs between
-- several, sometimes across borders, so the geography moves onto the day and
-- the route itself gains the things a browsable index needs: a slug, the
-- countries it crosses, the themes it belongs to, and a hero image.
--
-- No hotel is stored here. Where a traveller sleeps comes from a live search
-- when they plan the route, so a listing can never promise a property that is
-- full, closed or no longer in our supply.

ALTER TABLE public.getaway_itineraries
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS countries text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS themes text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS stops_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS season text,
  ADD COLUMN IF NOT EXISTS hero_image_url text,
  ADD COLUMN IF NOT EXISTS hero_image_credit text,
  ADD COLUMN IF NOT EXISTS hero_image_credit_url text,
  -- A route can start somewhere we do not carry as a destination, so the
  -- anchor destination becomes optional rather than required.
  ALTER COLUMN destination_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS getaway_itineraries_slug_key
  ON public.getaway_itineraries (slug)
  WHERE slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS getaway_itineraries_active_featured_idx
  ON public.getaway_itineraries (active, featured);

-- Each day now knows where it is, so the existing multi-city map can draw the
-- route without a second lookup.
ALTER TABLE public.getaway_itinerary_days
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  -- Set on the day the traveller moves on; null when they stay put.
  ADD COLUMN IF NOT EXISTS travel_note text,
  ADD COLUMN IF NOT EXISTS drive_minutes integer;

CREATE INDEX IF NOT EXISTS getaway_itinerary_days_order_idx
  ON public.getaway_itinerary_days (itinerary_id, day_number);
