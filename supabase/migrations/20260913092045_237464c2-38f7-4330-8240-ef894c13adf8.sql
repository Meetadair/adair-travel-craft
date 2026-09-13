CREATE TABLE public.place_cache (
  cache_key text PRIMARY KEY,
  payload jsonb NOT NULL DEFAULT '[]'::jsonb,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.place_cache TO authenticated;
GRANT ALL ON public.place_cache TO service_role;

ALTER TABLE public.place_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can read cached map results"
  ON public.place_cache FOR SELECT TO authenticated USING (true);

CREATE POLICY "Signed-in users can store cached map results"
  ON public.place_cache FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Signed-in users can refresh cached map results"
  ON public.place_cache FOR UPDATE TO authenticated USING (true) WITH CHECK (true);