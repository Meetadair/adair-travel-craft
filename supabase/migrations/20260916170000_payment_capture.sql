-- What we actually took, next to what we said was owed.
--
-- `amount_minor` records the amount the traveller was told to pay. Nothing
-- recorded whether that money was ever collected — and it was not: the card was
-- authorised with a manual capture that no code ever called, so every booking
-- ended with an invoice, a confirmed trip and a hold that expired on its own.
--
-- These two columns make the difference visible. A row where captured_minor is
-- short of amount_minor is money owed on a trip that is already flying, and
-- capture_note says why: the supplier charged the card directly, store credit
-- covered it, or the capture itself failed and someone has to chase it.

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS captured_minor integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS capture_note text;

COMMENT ON COLUMN public.payments.captured_minor IS
  'Minor units actually taken off the card by us; excludes anything a supplier charged directly.';
COMMENT ON COLUMN public.payments.capture_note IS
  'Why captured_minor differs from amount_minor, in one line.';

CREATE INDEX IF NOT EXISTS payments_uncaptured
  ON public.payments (user_id, created_at DESC)
  WHERE captured_minor < amount_minor;
