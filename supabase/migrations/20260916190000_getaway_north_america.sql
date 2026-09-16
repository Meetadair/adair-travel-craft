-- Somewhere to go when home is not in Europe.
--
-- The curated list was twenty-four European places, so the three-hour rule —
-- which works exactly as intended — left a traveller flying from New York with
-- nothing at all. Getaway answered "nothing in the curated list is within reach
-- of your home airport", which reads as a broken product rather than an empty
-- catalogue.
--
-- Fourteen places within about three hours of the big North American hubs,
-- joined to the themes that already exist, each with the months it is actually
-- worth going. Editorial notes stay empty on purpose: the card says plainly
-- that our note is still being written rather than inventing one.

WITH d(name, country, iata, lat, lon, nights) AS (
  VALUES
    ('Charleston',      'United States', 'CHS', 32.7765, -79.9311, 3),
    ('Savannah',        'United States', 'SAV', 32.0809, -81.0912, 2),
    ('Nashville',       'United States', 'BNA', 36.1627, -86.7816, 3),
    ('New Orleans',     'United States', 'MSY', 29.9511, -90.0715, 3),
    ('Miami & the Keys','United States', 'MIA', 25.7617, -80.1918, 4),
    ('Asheville',       'United States', 'AVL', 35.5951, -82.5515, 3),
    ('Santa Fe',        'United States', 'SAF', 35.6870, -105.9378, 3),
    ('Napa Valley',     'United States', 'SFO', 38.2975, -122.2869, 3),
    ('Aspen',           'United States', 'ASE', 39.1911, -106.8175, 4),
    ('Park City',       'United States', 'SLC', 40.6461, -111.4980, 4),
    ('Sedona',          'United States', 'FLG', 34.8697, -111.7610, 3),
    ('Quebec City',     'Canada',        'YQB', 46.8139, -71.2080, 3),
    ('Montreal',        'Canada',        'YUL', 45.5019, -73.5674, 3),
    ('Whistler',        'Canada',        'YVR', 50.1163, -122.9574, 4)
)
INSERT INTO public.getaway_destinations
  (name, country, nearest_airport_iata, latitude, longitude, typical_nights, active)
SELECT d.name, d.country, d.iata, d.lat, d.lon, d.nights, true
FROM d
WHERE NOT EXISTS (
  SELECT 1 FROM public.getaway_destinations g WHERE g.name = d.name
);

-- Theme and season. Months are when the place is worth the trip, not when a
-- flight exists: Miami in August and Aspen in July are both a mistake.
WITH j(dest, theme, months, angle) AS (
  VALUES
    ('Charleston',       'culture-touring', ARRAY[3,4,5,10,11],        'Antebellum streets before the humidity arrives'),
    ('Savannah',         'culture-touring', ARRAY[3,4,5,10,11],        NULL),
    ('Nashville',        'culture-touring', ARRAY[4,5,9,10],           NULL),
    ('New Orleans',      'culture-touring', ARRAY[2,3,4,10,11],        NULL),
    ('Miami & the Keys', 'beach',           ARRAY[11,12,1,2,3,4],      'Winter sun without crossing an ocean'),
    ('Miami & the Keys', 'family',          ARRAY[12,1,2,3],           NULL),
    ('Asheville',        'mountains-lakes', ARRAY[5,6,9,10],           'The Blue Ridge in leaf season'),
    ('Asheville',        'spa-wellness',    ARRAY[4,5,9,10,11],        NULL),
    ('Santa Fe',         'culture-touring', ARRAY[4,5,6,9,10],         NULL),
    ('Napa Valley',      'wine',            ARRAY[4,5,6,9,10],         'Harvest runs from late August into October'),
    ('Aspen',            'winter-sports',   ARRAY[12,1,2,3],           NULL),
    ('Aspen',            'mountains-lakes', ARRAY[6,7,8,9],            'The other Aspen, on foot and on a bike'),
    ('Park City',        'winter-sports',   ARRAY[12,1,2,3],           NULL),
    ('Sedona',           'spa-wellness',    ARRAY[3,4,5,10,11],        NULL),
    ('Quebec City',      'culture-touring', ARRAY[5,6,9,10],           NULL),
    ('Quebec City',      'winter-sports',   ARRAY[1,2,3],              NULL),
    ('Montreal',         'culture-touring', ARRAY[5,6,7,9,10],         NULL),
    ('Montreal',         'family',          ARRAY[6,7,8],              NULL),
    ('Whistler',         'winter-sports',   ARRAY[12,1,2,3,4],         NULL),
    ('Whistler',         'mountains-lakes', ARRAY[6,7,8,9],            NULL)
)
INSERT INTO public.getaway_destination_themes (destination_id, theme_id, season_months, editorial_angle)
SELECT g.id, t.id, j.months, j.angle
FROM j
JOIN public.getaway_destinations g ON g.name = j.dest
JOIN public.getaway_themes t ON t.slug = j.theme
WHERE NOT EXISTS (
  SELECT 1 FROM public.getaway_destination_themes x
  WHERE x.destination_id = g.id AND x.theme_id = t.id
);
