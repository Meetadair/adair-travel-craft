ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS traveller_given_name text,
  ADD COLUMN IF NOT EXISTS traveller_family_name text,
  ADD COLUMN IF NOT EXISTS traveller_email text,
  ADD COLUMN IF NOT EXISTS traveller_phone text,
  ADD COLUMN IF NOT EXISTS traveller_born_on date,
  ADD COLUMN IF NOT EXISTS traveller_gender text,
  ADD COLUMN IF NOT EXISTS traveller_title text;