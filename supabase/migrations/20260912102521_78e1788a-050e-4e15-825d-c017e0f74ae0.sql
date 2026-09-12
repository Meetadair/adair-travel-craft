CREATE TABLE public.choice_feedback (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id uuid REFERENCES public.trip_cards(id) ON DELETE SET NULL,
  line_type text NOT NULL,
  recommended jsonb NOT NULL DEFAULT '{}'::jsonb,
  chosen jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.choice_feedback TO authenticated;
GRANT ALL ON public.choice_feedback TO service_role;
ALTER TABLE public.choice_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own choice feedback" ON public.choice_feedback FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users log own choice feedback" ON public.choice_feedback FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE INDEX choice_feedback_user_idx ON public.choice_feedback (user_id, created_at DESC);