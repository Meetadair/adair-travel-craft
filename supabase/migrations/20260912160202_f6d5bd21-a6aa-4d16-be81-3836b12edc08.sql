ALTER TABLE public.getaway_destinations
  ADD COLUMN IF NOT EXISTS hero_image_url text,
  ADD COLUMN IF NOT EXISTS hero_image_fallback_url text,
  ADD COLUMN IF NOT EXISTS hero_image_email_url text,
  ADD COLUMN IF NOT EXISTS hero_image_credit text,
  ADD COLUMN IF NOT EXISTS hero_image_credit_url text,
  ADD COLUMN IF NOT EXISTS hero_image_source text;

ALTER TABLE public.getaway_destinations
  ADD CONSTRAINT getaway_destinations_hero_image_source_check
  CHECK (hero_image_source IS NULL OR hero_image_source IN ('own', 'unsplash'));

ALTER TABLE public.getaway_itinerary_days
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS image_fallback_url text,
  ADD COLUMN IF NOT EXISTS image_credit text,
  ADD COLUMN IF NOT EXISTS image_credit_url text,
  ADD COLUMN IF NOT EXISTS image_source text;

ALTER TABLE public.getaway_itinerary_days
  ADD CONSTRAINT getaway_itinerary_days_image_source_check
  CHECK (image_source IS NULL OR image_source IN ('own', 'unsplash'));