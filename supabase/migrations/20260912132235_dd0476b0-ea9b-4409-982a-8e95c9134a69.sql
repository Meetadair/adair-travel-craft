-- themes
CREATE TABLE public.getaway_themes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  interest_tags text[] NOT NULL DEFAULT '{}',
  season_months int[] NOT NULL DEFAULT '{}',
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.getaway_themes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.getaway_themes TO authenticated;
GRANT ALL ON public.getaway_themes TO service_role;
ALTER TABLE public.getaway_themes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "getaway_themes readable" ON public.getaway_themes FOR SELECT USING (true);
CREATE POLICY "getaway_themes admin write" ON public.getaway_themes FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- destinations
CREATE TABLE public.getaway_destinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  country text NOT NULL,
  nearest_airport_iata text NOT NULL,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  drivable_from text[] NOT NULL DEFAULT '{}',
  editorial_note text,
  best_for text,
  avoid_when text,
  typical_nights int NOT NULL DEFAULT 3,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.getaway_destinations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.getaway_destinations TO authenticated;
GRANT ALL ON public.getaway_destinations TO service_role;
ALTER TABLE public.getaway_destinations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "getaway_destinations readable" ON public.getaway_destinations FOR SELECT USING (true);
CREATE POLICY "getaway_destinations admin write" ON public.getaway_destinations FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- destination <-> theme, with the season on the join row
CREATE TABLE public.getaway_destination_themes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destination_id uuid NOT NULL REFERENCES public.getaway_destinations(id) ON DELETE CASCADE,
  theme_id uuid NOT NULL REFERENCES public.getaway_themes(id) ON DELETE CASCADE,
  season_months int[] NOT NULL DEFAULT '{}',
  editorial_angle text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (destination_id, theme_id)
);
GRANT SELECT ON public.getaway_destination_themes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.getaway_destination_themes TO authenticated;
GRANT ALL ON public.getaway_destination_themes TO service_role;
ALTER TABLE public.getaway_destination_themes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "getaway_dt readable" ON public.getaway_destination_themes FOR SELECT USING (true);
CREATE POLICY "getaway_dt admin write" ON public.getaway_destination_themes FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- curated places
CREATE TABLE public.getaway_places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destination_id uuid NOT NULL REFERENCES public.getaway_destinations(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('hotel','restaurant','sight')),
  name text NOT NULL,
  address text,
  latitude numeric,
  longitude numeric,
  editorial_note text,
  why_this_one text,
  price_band text,
  family_friendly boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.getaway_places TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.getaway_places TO authenticated;
GRANT ALL ON public.getaway_places TO service_role;
ALTER TABLE public.getaway_places ENABLE ROW LEVEL SECURITY;
CREATE POLICY "getaway_places readable" ON public.getaway_places FOR SELECT USING (true);
CREATE POLICY "getaway_places admin write" ON public.getaway_places FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- itineraries
CREATE TABLE public.getaway_itineraries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destination_id uuid NOT NULL REFERENCES public.getaway_destinations(id) ON DELETE CASCADE,
  title text NOT NULL,
  nights int NOT NULL DEFAULT 2,
  summary text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.getaway_itineraries TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.getaway_itineraries TO authenticated;
GRANT ALL ON public.getaway_itineraries TO service_role;
ALTER TABLE public.getaway_itineraries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "getaway_itineraries readable" ON public.getaway_itineraries FOR SELECT USING (true);
CREATE POLICY "getaway_itineraries admin write" ON public.getaway_itineraries FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.getaway_itinerary_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  itinerary_id uuid NOT NULL REFERENCES public.getaway_itineraries(id) ON DELETE CASCADE,
  day_number int NOT NULL,
  morning text,
  afternoon text,
  evening text,
  sleep_place_id uuid REFERENCES public.getaway_places(id) ON DELETE SET NULL,
  meal_place_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (itinerary_id, day_number)
);
GRANT SELECT ON public.getaway_itinerary_days TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.getaway_itinerary_days TO authenticated;
GRANT ALL ON public.getaway_itinerary_days TO service_role;
ALTER TABLE public.getaway_itinerary_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "getaway_days readable" ON public.getaway_itinerary_days FOR SELECT USING (true);
CREATE POLICY "getaway_days admin write" ON public.getaway_itinerary_days FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- our own price baseline
CREATE TABLE public.getaway_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destination_id uuid NOT NULL REFERENCES public.getaway_destinations(id) ON DELETE CASCADE,
  origin_iata text NOT NULL,
  depart_date date NOT NULL,
  return_date date NOT NULL,
  flight_minor int,
  stay_minor int,
  currency text NOT NULL DEFAULT 'EUR',
  checked_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX getaway_prices_lookup ON public.getaway_prices (origin_iata, destination_id, depart_date);
CREATE INDEX getaway_prices_checked ON public.getaway_prices (checked_at);
GRANT SELECT ON public.getaway_prices TO authenticated;
GRANT ALL ON public.getaway_prices TO service_role;
ALTER TABLE public.getaway_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "getaway_prices readable" ON public.getaway_prices FOR SELECT TO authenticated USING (true);

-- one proposal per user per week
CREATE TABLE public.getaway_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  destination_id uuid NOT NULL REFERENCES public.getaway_destinations(id) ON DELETE CASCADE,
  theme_id uuid REFERENCES public.getaway_themes(id) ON DELETE SET NULL,
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  emailed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.getaway_proposals TO authenticated;
GRANT ALL ON public.getaway_proposals TO service_role;
ALTER TABLE public.getaway_proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "getaway_proposals own" ON public.getaway_proposals FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- "not interested in this theme"
CREATE TABLE public.getaway_theme_optouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  theme_id uuid NOT NULL REFERENCES public.getaway_themes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, theme_id)
);
GRANT SELECT, INSERT, DELETE ON public.getaway_theme_optouts TO authenticated;
GRANT ALL ON public.getaway_theme_optouts TO service_role;
ALTER TABLE public.getaway_theme_optouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "getaway_optouts own" ON public.getaway_theme_optouts FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER getaway_themes_updated_at BEFORE UPDATE ON public.getaway_themes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER getaway_destinations_updated_at BEFORE UPDATE ON public.getaway_destinations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER getaway_places_updated_at BEFORE UPDATE ON public.getaway_places
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER getaway_itineraries_updated_at BEFORE UPDATE ON public.getaway_itineraries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- skeleton content: names, airports, seasons only. No editorial text, no places.
INSERT INTO public.getaway_themes (slug, name, interest_tags, season_months, sort_order) VALUES
  ('winter-sports', 'Winter sports', ARRAY['skiing','snowboarding','mountains'], ARRAY[12,1,2,3], 1),
  ('cycling', 'Cycling', ARRAY['cycling','sport','outdoors'], ARRAY[3,4,5,6,9,10], 2),
  ('wine', 'Wine', ARRAY['wine','food','gastronomy'], ARRAY[4,5,6,9,10], 3),
  ('spa-wellness', 'Spa & wellness', ARRAY['spa','wellness','relax'], ARRAY[1,2,3,4,10,11,12], 4),
  ('beach', 'Beach', ARRAY['beach','swimming','sun'], ARRAY[6,7,8,9], 5),
  ('mountains-lakes', 'Mountains & lakes', ARRAY['hiking','mountains','nature'], ARRAY[5,6,7,8,9], 6),
  ('family', 'Family', ARRAY['family','children'], ARRAY[1,2,3,4,5,6,7,8,9,10,11,12], 7),
  ('culture-touring', 'Culture & touring', ARRAY['art','history','architecture','museums'], ARRAY[1,2,3,4,5,6,7,8,9,10,11,12], 8);

INSERT INTO public.getaway_destinations (name, country, nearest_airport_iata, latitude, longitude, drivable_from, typical_nights) VALUES
  ('Tuscany (Florence)', 'Italy', 'FLR', 43.7696, 11.2558, ARRAY[]::text[], 3),
  ('Mallorca', 'Spain', 'PMI', 39.5696, 2.6502, ARRAY[]::text[], 3),
  ('Gran Canaria', 'Spain', 'LPA', 27.9202, -15.5474, ARRAY[]::text[], 5),
  ('Tenerife', 'Spain', 'TFS', 28.2916, -16.6291, ARRAY[]::text[], 5),
  ('Zakopane / Tatra', 'Poland', 'KRK', 49.2992, 19.9496, ARRAY['WAW','KRK','KTW','WRO','POZ'], 2),
  ('Innsbruck & Tyrol', 'Austria', 'INN', 47.2692, 11.4041, ARRAY['MUC','VIE','ZRH'], 3),
  ('Zermatt', 'Switzerland', 'GVA', 46.0207, 7.7491, ARRAY[]::text[], 4),
  ('Piedmont (Langhe)', 'Italy', 'TRN', 44.6980, 8.0350, ARRAY['MXP','LIN','GVA'], 3),
  ('Douro Valley', 'Portugal', 'OPO', 41.1621, -7.7864, ARRAY[]::text[], 3),
  ('Alsace (Colmar)', 'France', 'BSL', 48.0794, 7.3585, ARRAY['STR','ZRH','FRA'], 2),
  ('Budapest', 'Hungary', 'BUD', 47.4979, 19.0402, ARRAY['VIE','BTS','KRK'], 2),
  ('Karlovy Vary', 'Czechia', 'PRG', 50.2320, 12.8710, ARRAY['PRG','MUC','DRS'], 2),
  ('Algarve (Faro)', 'Portugal', 'FAO', 37.0194, -7.9304, ARRAY[]::text[], 4),
  ('Crete (Chania)', 'Greece', 'CHQ', 35.5138, 24.0180, ARRAY[]::text[], 5),
  ('Sardinia (Olbia)', 'Italy', 'OLB', 40.9236, 9.4979, ARRAY[]::text[], 4),
  ('Lake Garda', 'Italy', 'VRN', 45.5800, 10.6400, ARRAY['MXP','LIN','MUC','INN'], 3),
  ('Slovenian Alps (Bled)', 'Slovenia', 'LJU', 46.3683, 14.1146, ARRAY['LJU','VIE','ZAG','VCE'], 3),
  ('Dolomites (Bolzano)', 'Italy', 'VRN', 46.4983, 11.3548, ARRAY['MUC','INN','VCE'], 4),
  ('Copenhagen', 'Denmark', 'CPH', 55.6761, 12.5683, ARRAY['CPH','HAM'], 2),
  ('Rome', 'Italy', 'FCO', 41.9028, 12.4964, ARRAY[]::text[], 3),
  ('Loire Valley (Tours)', 'France', 'CDG', 47.3941, 0.6848, ARRAY['CDG','ORY','NTE'], 3),
  ('Lisbon', 'Portugal', 'LIS', 38.7223, -9.1393, ARRAY[]::text[], 3),
  ('Vienna', 'Austria', 'VIE', 48.2082, 16.3738, ARRAY['VIE','BTS','BUD','KRK'], 2),
  ('Barcelona', 'Spain', 'BCN', 41.3874, 2.1686, ARRAY[]::text[], 3);

-- theme assignments; the season lives here, per destination
INSERT INTO public.getaway_destination_themes (destination_id, theme_id, season_months)
SELECT d.id, t.id, s.months FROM (VALUES
  ('Tuscany (Florence)', 'cycling', ARRAY[3,4,5,6,9,10]),
  ('Tuscany (Florence)', 'wine', ARRAY[5,6,9,10]),
  ('Tuscany (Florence)', 'culture-touring', ARRAY[3,4,5,6,9,10,11]),
  ('Mallorca', 'cycling', ARRAY[2,3,4,5]),
  ('Mallorca', 'beach', ARRAY[6,7,8,9]),
  ('Gran Canaria', 'cycling', ARRAY[11,12,1,2,3]),
  ('Gran Canaria', 'beach', ARRAY[1,2,3,4,5,6,7,8,9,10,11,12]),
  ('Tenerife', 'cycling', ARRAY[11,12,1,2,3]),
  ('Tenerife', 'family', ARRAY[1,2,3,4,10,11,12]),
  ('Zakopane / Tatra', 'winter-sports', ARRAY[12,1,2,3]),
  ('Zakopane / Tatra', 'mountains-lakes', ARRAY[6,7,8,9]),
  ('Innsbruck & Tyrol', 'winter-sports', ARRAY[12,1,2,3]),
  ('Innsbruck & Tyrol', 'mountains-lakes', ARRAY[6,7,8,9]),
  ('Zermatt', 'winter-sports', ARRAY[12,1,2,3,4]),
  ('Zermatt', 'mountains-lakes', ARRAY[7,8,9]),
  ('Piedmont (Langhe)', 'wine', ARRAY[5,6,9,10]),
  ('Piedmont (Langhe)', 'cycling', ARRAY[4,5,6,9,10]),
  ('Douro Valley', 'wine', ARRAY[4,5,6,9,10]),
  ('Alsace (Colmar)', 'wine', ARRAY[5,6,9,10]),
  ('Alsace (Colmar)', 'culture-touring', ARRAY[4,5,6,9,10,12]),
  ('Budapest', 'spa-wellness', ARRAY[1,2,3,4,10,11,12]),
  ('Budapest', 'culture-touring', ARRAY[3,4,5,6,9,10,11]),
  ('Karlovy Vary', 'spa-wellness', ARRAY[1,2,3,4,10,11,12]),
  ('Algarve (Faro)', 'beach', ARRAY[5,6,7,8,9,10]),
  ('Algarve (Faro)', 'family', ARRAY[5,6,7,8,9]),
  ('Crete (Chania)', 'beach', ARRAY[6,7,8,9]),
  ('Crete (Chania)', 'culture-touring', ARRAY[4,5,10]),
  ('Sardinia (Olbia)', 'beach', ARRAY[6,7,8,9]),
  ('Lake Garda', 'mountains-lakes', ARRAY[5,6,7,8,9]),
  ('Lake Garda', 'family', ARRAY[6,7,8]),
  ('Lake Garda', 'cycling', ARRAY[4,5,6,9,10]),
  ('Slovenian Alps (Bled)', 'mountains-lakes', ARRAY[5,6,7,8,9]),
  ('Slovenian Alps (Bled)', 'winter-sports', ARRAY[1,2,3]),
  ('Dolomites (Bolzano)', 'winter-sports', ARRAY[12,1,2,3]),
  ('Dolomites (Bolzano)', 'mountains-lakes', ARRAY[6,7,8,9]),
  ('Copenhagen', 'culture-touring', ARRAY[4,5,6,7,8,9]),
  ('Copenhagen', 'family', ARRAY[5,6,7,8]),
  ('Rome', 'culture-touring', ARRAY[3,4,5,6,9,10,11]),
  ('Loire Valley (Tours)', 'culture-touring', ARRAY[4,5,6,9,10]),
  ('Loire Valley (Tours)', 'wine', ARRAY[5,6,9,10]),
  ('Lisbon', 'culture-touring', ARRAY[3,4,5,6,9,10,11]),
  ('Vienna', 'culture-touring', ARRAY[1,2,3,4,5,6,9,10,11,12]),
  ('Barcelona', 'culture-touring', ARRAY[3,4,5,6,9,10,11]),
  ('Barcelona', 'beach', ARRAY[6,7,8,9])
) AS s(destination, theme, months)
JOIN public.getaway_destinations d ON d.name = s.destination
JOIN public.getaway_themes t ON t.slug = s.theme;