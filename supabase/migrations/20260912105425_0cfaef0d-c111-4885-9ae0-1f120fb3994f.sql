ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _user_id AND p.is_admin)
$$;

-- Stops a signed-in user from granting themselves admin through their own profile row.
CREATE OR REPLACE FUNCTION public.guard_is_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin
     AND auth.uid() IS NOT NULL
     AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not allowed to change is_admin';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard_is_admin ON public.profiles;
CREATE TRIGGER profiles_guard_is_admin
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_is_admin();

CREATE TABLE IF NOT EXISTS public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id text,
  name text NOT NULL,
  props jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read events" ON public.events
FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "Users log own events" ON public.events
FOR INSERT TO authenticated WITH CHECK (user_id IS NULL OR user_id = auth.uid());

CREATE INDEX IF NOT EXISTS events_name_created_idx ON public.events (name, created_at DESC);
CREATE INDEX IF NOT EXISTS events_created_idx ON public.events (created_at DESC);
CREATE INDEX IF NOT EXISTS events_session_idx ON public.events (session_id);

CREATE TABLE IF NOT EXISTS public.error_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL,
  stack text,
  route text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.error_log TO authenticated;
GRANT ALL ON public.error_log TO service_role;
ALTER TABLE public.error_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read error log" ON public.error_log
FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "Users log own errors" ON public.error_log
FOR INSERT TO authenticated WITH CHECK (user_id IS NULL OR user_id = auth.uid());

CREATE INDEX IF NOT EXISTS error_log_created_idx ON public.error_log (created_at DESC);

-- Admin-editable configuration.
GRANT INSERT, UPDATE ON public.pricing_rules TO authenticated;
CREATE POLICY "Admins change pricing rules" ON public.pricing_rules
FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins add pricing rules" ON public.pricing_rules
FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));

GRANT UPDATE ON public.providers TO authenticated;
CREATE POLICY "Admins change providers" ON public.providers
FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins read audit log" ON public.audit_log
FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));