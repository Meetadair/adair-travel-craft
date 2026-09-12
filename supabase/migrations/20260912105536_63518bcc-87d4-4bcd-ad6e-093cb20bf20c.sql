CREATE OR REPLACE FUNCTION public.admin_analytics()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'admins only';
  END IF;

  WITH windows AS (
    SELECT * FROM (VALUES
      ('today', (now() - interval '1 day')),
      ('7d',    (now() - interval '7 days')),
      ('30d',   (now() - interval '30 days'))
    ) AS w(label, since)
  ),
  funnel AS (
    SELECT w.label,
      count(*) FILTER (WHERE e.name = 'sentence_typed')     AS typed,
      count(*) FILTER (WHERE e.name = 'search_run')         AS searched,
      count(*) FILTER (WHERE e.name = 'card_created')       AS cards,
      count(*) FILTER (WHERE e.name = 'booking_started')    AS booking_started,
      count(*) FILTER (WHERE e.name = 'booking_completed')  AS booked
    FROM windows w
    LEFT JOIN public.events e ON e.created_at >= w.since
    GROUP BY w.label
  ),
  onboarding AS (
    SELECT
      (SELECT count(*) FROM public.profiles WHERE onboarded) AS part1,
      (SELECT count(*) FROM public.preferences
        WHERE jsonb_array_length(interests) > 0
           OR jsonb_array_length(cuisines) > 0
           OR jsonb_array_length(music) > 0) AS part2,
      (SELECT count(*) FROM public.profiles) AS total
  ),
  onboarding_pct AS (
    SELECT coalesce(round(avg(pct)), 0) AS avg_pct FROM (
      SELECT (
        (CASE WHEN jsonb_array_length(p.airlines) > 0 THEN 1 ELSE 0 END) +
        (CASE WHEN jsonb_array_length(p.hotel_chains) > 0 THEN 1 ELSE 0 END) +
        (CASE WHEN jsonb_array_length(p.hotel_amenities) > 0 THEN 1 ELSE 0 END) +
        (CASE WHEN jsonb_array_length(p.car_brands) > 0 THEN 1 ELSE 0 END) +
        (CASE WHEN jsonb_array_length(p.cuisines) > 0 THEN 1 ELSE 0 END) +
        (CASE WHEN jsonb_array_length(p.interests) > 0 THEN 1 ELSE 0 END) +
        (CASE WHEN jsonb_array_length(p.music) > 0 THEN 1 ELSE 0 END) +
        (CASE WHEN p.budget_band IS NOT NULL THEN 1 ELSE 0 END)
      ) * 100.0 / 8 AS pct
      FROM public.preferences p
    ) s
  ),
  worst_question AS (
    SELECT coalesce(props ->> 'question', props ->> 'step') AS question, count(*) AS drop_offs
    FROM public.events
    WHERE name IN ('onboarding_skip', 'onboarding_abandoned')
      AND created_at >= now() - interval '30 days'
    GROUP BY 1
    ORDER BY 2 DESC
    LIMIT 1
  ),
  destinations AS (
    SELECT props ->> 'destination' AS city, count(*) AS searches
    FROM public.events
    WHERE name = 'search_run' AND props ->> 'destination' IS NOT NULL
      AND created_at >= now() - interval '30 days'
    GROUP BY 1 ORDER BY 2 DESC LIMIT 10
  ),
  search_stats AS (
    SELECT
      coalesce(round(avg(nullif((props ->> 'total_eur')::numeric, 0)), 2), 0) AS avg_value,
      coalesce(round(100.0 * count(*) FILTER (WHERE props ->> 'peak' = 'true') / nullif(count(*), 0)), 0) AS peak_share
    FROM public.events
    WHERE name = 'search_run' AND created_at >= now() - interval '30 days'
  ),
  cheaper AS (
    SELECT
      count(*) FILTER (WHERE name = 'cheaper_dates_accepted') AS accepted,
      count(*) FILTER (WHERE name = 'cheaper_dates_dismissed') AS dismissed
    FROM public.events
    WHERE created_at >= now() - interval '30 days'
  ),
  swaps AS (
    SELECT item_kind, count(*) AS swaps
    FROM public.choice_feedback
    GROUP BY 1 ORDER BY 2 DESC
  ),
  swap_reasons AS (
    SELECT coalesce(nullif(reason, ''), 'no reason given') AS reason, count(*) AS swaps
    FROM public.choice_feedback
    GROUP BY 1 ORDER BY 2 DESC LIMIT 12
  ),
  match_scores AS (
    SELECT props ->> 'kind' AS kind,
           round(avg((props ->> 'score')::numeric)) AS avg_score,
           count(*) AS samples
    FROM public.events
    WHERE name = 'match_score' AND props ->> 'score' IS NOT NULL
      AND created_at >= now() - interval '30 days'
    GROUP BY 1 ORDER BY 1
  ),
  unmet AS (
    SELECT unmet_reason AS reason, count(*) AS misses
    FROM public.events e,
         LATERAL jsonb_array_elements_text(
           CASE WHEN jsonb_typeof(e.props -> 'unmet') = 'array' THEN e.props -> 'unmet' ELSE '[]'::jsonb END
         ) AS unmet_reason
    WHERE e.name = 'match_score' AND e.created_at >= now() - interval '30 days'
    GROUP BY 1 ORDER BY 2 DESC LIMIT 12
  ),
  bookings_by_day AS (
    SELECT to_char(t.booked_at, 'YYYY-MM-DD') AS day,
           count(*) AS bookings,
           round(sum(t.total_amount), 2) AS value,
           round(coalesce(sum(c.markup_minor), 0) / 100.0, 2) AS margin
    FROM public.trips t
    LEFT JOIN public.trip_cards c ON c.id = t.card_id
    WHERE t.booked_at IS NOT NULL AND t.booked_at >= now() - interval '30 days'
    GROUP BY 1 ORDER BY 1 DESC
  ),
  cancellations AS (
    SELECT coalesce(nullif(props ->> 'reason', ''), 'not given') AS reason, count(*) AS cancels
    FROM public.events
    WHERE name = 'booking_cancelled' AND created_at >= now() - interval '30 days'
    GROUP BY 1 ORDER BY 2 DESC LIMIT 12
  ),
  search_errors AS (
    SELECT coalesce(nullif(props ->> 'cause', ''), 'unknown') AS cause, count(*) AS hits
    FROM public.events
    WHERE name = 'search_failed' AND created_at >= now() - interval '30 days'
    GROUP BY 1 ORDER BY 2 DESC LIMIT 12
  ),
  booking_errors AS (
    SELECT coalesce(nullif(props ->> 'cause', ''), 'unknown') AS cause, count(*) AS hits
    FROM public.events
    WHERE name = 'booking_failed' AND created_at >= now() - interval '30 days'
    GROUP BY 1 ORDER BY 2 DESC LIMIT 12
  )
  SELECT jsonb_build_object(
    'funnel', (SELECT coalesce(jsonb_agg(to_jsonb(f)), '[]'::jsonb) FROM funnel f),
    'onboarding', (
      SELECT jsonb_build_object(
        'part1', o.part1, 'part2', o.part2, 'total', o.total,
        'avgPct', (SELECT avg_pct FROM onboarding_pct),
        'worstQuestion', (SELECT to_jsonb(w) FROM worst_question w)
      ) FROM onboarding o
    ),
    'searches', jsonb_build_object(
      'destinations', (SELECT coalesce(jsonb_agg(to_jsonb(d)), '[]'::jsonb) FROM destinations d),
      'stats', (SELECT to_jsonb(s) FROM search_stats s),
      'cheaperDates', (SELECT to_jsonb(c) FROM cheaper c)
    ),
    'feedback', jsonb_build_object(
      'byKind', (SELECT coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) FROM swaps s),
      'reasons', (SELECT coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) FROM swap_reasons r)
    ),
    'match', jsonb_build_object(
      'byKind', (SELECT coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) FROM match_scores m),
      'unmet', (SELECT coalesce(jsonb_agg(to_jsonb(u)), '[]'::jsonb) FROM unmet u)
    ),
    'bookings', jsonb_build_object(
      'byDay', (SELECT coalesce(jsonb_agg(to_jsonb(b)), '[]'::jsonb) FROM bookings_by_day b),
      'cancellations', (SELECT coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) FROM cancellations c)
    ),
    'errors', jsonb_build_object(
      'searches', (SELECT coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) FROM search_errors s),
      'bookings', (SELECT coalesce(jsonb_agg(to_jsonb(b)), '[]'::jsonb) FROM booking_errors b)
    )
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_analytics() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_analytics() TO service_role;