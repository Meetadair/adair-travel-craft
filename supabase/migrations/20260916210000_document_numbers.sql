-- Every invoice needs a document number nobody can reuse or leave blank:
-- one series, per calendar year, that only ever goes up. Before this, a
-- booked trip's document number WAS the airline's own PNR (missing on a
-- hotel-only trip, and not ours to assign), and a saved itinerary got a
-- random six-digit number with no continuity and a real chance of colliding.
CREATE TABLE IF NOT EXISTS public.document_number_counters (
  year integer PRIMARY KEY,
  next_value integer NOT NULL DEFAULT 1
);
ALTER TABLE public.document_number_counters ENABLE ROW LEVEL SECURITY;
-- Only the function below (SECURITY DEFINER) ever touches this table; no
-- direct grants to authenticated, so a client can't skip a number or peek
-- at how many invoices exist.

-- Atomic: two bookings confirmed in the same instant still get two
-- different numbers, because the increment and the read happen in one
-- UPDATE ... RETURNING, not a read-then-write a client could race.
CREATE OR REPLACE FUNCTION public.next_document_number(prefix text DEFAULT 'ADR')
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  y integer := extract(year from now())::integer;
  n integer;
BEGIN
  INSERT INTO public.document_number_counters (year, next_value)
  VALUES (y, 2)
  ON CONFLICT (year) DO UPDATE SET next_value = document_number_counters.next_value + 1
  RETURNING next_value - 1 INTO n;

  RETURN prefix || '/' || y::text || '/' || lpad(n::text, 6, '0');
END;
$$;
GRANT EXECUTE ON FUNCTION public.next_document_number(text) TO authenticated;
