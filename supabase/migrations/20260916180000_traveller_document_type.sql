-- Passport or national ID, not passport only.
--
-- Most of Adair's trips are inside Schengen, where an identity card is what
-- people actually travel on and many have no passport at all. Asking for a
-- passport number as the only option either blocks them at sign-up or teaches
-- them to type the wrong number into the passport field — which then goes to
-- the airline as a passport and fails at the gate.
--
-- The column says which document the stored number is. Airlines are only sent
-- a document when it is a passport; an identity card is kept for the traveller's
-- own records and for hotel check-in, and never passed off as something else.

ALTER TABLE public.travel_companions
  ADD COLUMN IF NOT EXISTS document_type text NOT NULL DEFAULT 'passport'
    CHECK (document_type IN ('passport', 'national_id'));

COMMENT ON COLUMN public.travel_companions.document_type IS
  'What passport_number_encrypted actually holds: a passport or a national identity card.';
COMMENT ON COLUMN public.travel_companions.passport_number_encrypted IS
  'Identity document number, AES-GCM encrypted. document_type says which kind.';
