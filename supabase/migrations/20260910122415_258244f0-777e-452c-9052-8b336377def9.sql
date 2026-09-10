REVOKE ALL ON public.waitlist FROM anon, authenticated;
GRANT ALL ON public.waitlist TO service_role;
CREATE POLICY "waitlist_no_direct_access" ON public.waitlist FOR SELECT TO authenticated USING (false);