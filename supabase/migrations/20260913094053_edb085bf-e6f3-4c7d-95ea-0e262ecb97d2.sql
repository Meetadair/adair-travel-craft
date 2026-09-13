CREATE TABLE public.brands (
  id text PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('airline','hotel_chain','car_rental')),
  name text NOT NULL,
  alliance_or_group text,
  regions text[] NOT NULL DEFAULT '{}',
  aliases text[] NOT NULL DEFAULT '{}',
  popularity_rank integer NOT NULL DEFAULT 100,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.brands TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brands TO authenticated;
GRANT ALL ON public.brands TO service_role;

ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active brands"
  ON public.brands FOR SELECT
  USING (active OR public.is_admin(auth.uid()));

CREATE POLICY "Admins manage brands insert"
  ON public.brands FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins manage brands update"
  ON public.brands FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins manage brands delete"
  ON public.brands FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE INDEX brands_kind_rank_idx ON public.brands (kind, popularity_rank);

CREATE TRIGGER update_brands_updated_at
  BEFORE UPDATE ON public.brands
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();