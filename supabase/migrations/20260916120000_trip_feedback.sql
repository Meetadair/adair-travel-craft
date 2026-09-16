-- What the traveller thought of the trip we just booked them.
--
-- Everything else we record is behaviour: what they searched, what they swapped,
-- what they paid. None of it says whether the result was any good. A card can be
-- booked, paid for and flown, and still be the wrong hotel — and without asking
-- we would only find that out when the person quietly stops coming back.
--
-- One question at the end of the booking, four answers, an optional line of
-- their own words. Deliberately not a star rating: "4 out of 5" tells us less
-- than "satisfied but not delighted", and the wording is what people answer
-- honestly.

CREATE TABLE IF NOT EXISTS public.trip_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trip_card_id uuid REFERENCES public.trip_cards(id) ON DELETE SET NULL,
  -- The booking this is about, kept as plain text so feedback survives a card
  -- being deleted and can still be matched to what the supplier has.
  booking_reference text,
  -- 1 not satisfied, 2 satisfied, 3 good, 4 fantastic. Stored as a number so it
  -- can be averaged, with the wording kept beside it so a later change of copy
  -- cannot silently re-interpret old answers.
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 4),
  rating_key text NOT NULL,
  -- Their own words, when they leave any. Never required: a rating that costs
  -- two seconds is answered, a form is not.
  comment text,
  -- What the trip was, so the answers can be read by kind rather than in bulk:
  -- a business trip rated "satisfied" and an anniversary rated "satisfied" are
  -- not the same result.
  purpose text,
  party text,
  occasion text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trip_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own trip feedback" ON public.trip_feedback
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- One answer per booking: asking again about the same trip is nagging, and a
-- second row would quietly double that trip's weight in any average.
CREATE UNIQUE INDEX IF NOT EXISTS trip_feedback_one_per_booking
  ON public.trip_feedback (user_id, booking_reference)
  WHERE booking_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS trip_feedback_user_created
  ON public.trip_feedback (user_id, created_at DESC);

COMMENT ON TABLE public.trip_feedback IS
  'One answer per booked trip: how well the result matched what the traveller wanted.';
