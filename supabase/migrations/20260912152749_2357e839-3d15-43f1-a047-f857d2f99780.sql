CREATE TABLE public.support_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trip_id uuid REFERENCES public.trips(id) ON DELETE SET NULL,
  trip_reference text,
  category text NOT NULL DEFAULT 'other',
  urgency text NOT NULL DEFAULT 'normal',
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  admin_note text,
  contact_email text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.support_requests TO authenticated;
GRANT ALL ON public.support_requests TO service_role;

ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see their own support requests"
  ON public.support_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY "Users create their own support requests"
  ON public.support_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins update support requests"
  ON public.support_requests FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

GRANT UPDATE ON public.support_requests TO authenticated;

CREATE TRIGGER support_requests_updated_at
  BEFORE UPDATE ON public.support_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX support_requests_user_idx ON public.support_requests (user_id, created_at DESC);
CREATE INDEX support_requests_status_idx ON public.support_requests (status, created_at DESC);