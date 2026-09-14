ALTER TABLE public.preferences
  ADD COLUMN IF NOT EXISTS location_consent text NOT NULL DEFAULT 'not_asked';

ALTER TABLE public.preferences
  DROP CONSTRAINT IF EXISTS preferences_location_consent_check;

ALTER TABLE public.preferences
  ADD CONSTRAINT preferences_location_consent_check
  CHECK (location_consent IN ('granted', 'denied', 'not_asked'));