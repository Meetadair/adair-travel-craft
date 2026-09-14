-- Business trips are a different traveller in the same body.
--
-- The same person who wants a boutique hotel by the beach in July wants a
-- chain next to the client's office in November, on the company invoice, in a
-- different cabin. One set of preferences cannot say both.
--
-- The model is an overlay, not a second profile: the base preferences remain
-- the person, and business_prefs holds only what changes when they travel for
-- work. Empty overlay means business trips use the base — nobody is forced to
-- fill in a second questionnaire.

ALTER TABLE public.preferences
  ADD COLUMN IF NOT EXISTS business_prefs jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.preferences.business_prefs IS
  'Overrides applied when a trip is for work. Keys mirror the base preference fields; absent keys fall through to the base.';
