ALTER TABLE public.preferences
  ADD COLUMN IF NOT EXISTS dealbreakers jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS extra_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS accessibility_note text,
  ADD COLUMN IF NOT EXISTS avoid_note text;