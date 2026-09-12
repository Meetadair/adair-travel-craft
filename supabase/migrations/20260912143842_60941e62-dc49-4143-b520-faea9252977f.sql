ALTER TABLE public.waitlist
  ADD COLUMN IF NOT EXISTS invited_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS invite_error text,
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

GRANT SELECT ON public.waitlist TO authenticated;

CREATE POLICY "Admins can read the waitlist"
  ON public.waitlist FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));