ALTER TABLE public.choice_feedback RENAME COLUMN card_id TO trip_card_id;
ALTER TABLE public.choice_feedback RENAME COLUMN line_type TO item_kind;
ALTER TABLE public.choice_feedback ADD COLUMN IF NOT EXISTS rejected_reference text;
ALTER TABLE public.choice_feedback ADD COLUMN IF NOT EXISTS chosen_reference text;
ALTER TABLE public.choice_feedback ALTER COLUMN recommended DROP NOT NULL;
ALTER TABLE public.choice_feedback ALTER COLUMN chosen DROP NOT NULL;