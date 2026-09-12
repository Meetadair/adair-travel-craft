ALTER TABLE public.getaway_destinations
  ADD COLUMN IF NOT EXISTS travel_tips jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notify_channel text NOT NULL DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS whatsapp_phone text,
  ADD COLUMN IF NOT EXISTS whatsapp_verified_at timestamptz;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_notify_channel_check
  CHECK (notify_channel IN ('email', 'whatsapp', 'both'));

CREATE TABLE public.whatsapp_verifications (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone text NOT NULL,
  code_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_verifications TO authenticated;
GRANT ALL ON public.whatsapp_verifications TO service_role;

ALTER TABLE public.whatsapp_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Travellers manage their own verification"
  ON public.whatsapp_verifications FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER whatsapp_verifications_updated_at
  BEFORE UPDATE ON public.whatsapp_verifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  channel text NOT NULL,
  template text NOT NULL,
  kind text NOT NULL,
  status text NOT NULL,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notification_log_user_created_idx
  ON public.notification_log (user_id, created_at DESC);

GRANT SELECT ON public.notification_log TO authenticated;
GRANT ALL ON public.notification_log TO service_role;

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Travellers read their own notifications"
  ON public.notification_log FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins read every notification"
  ON public.notification_log FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));