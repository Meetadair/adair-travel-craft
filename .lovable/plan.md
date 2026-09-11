# Adair — real product behind sign-in

Marketing pages (home, /business, all 14 languages), design system, logo and copy stay untouched. Everything below happens behind "Sign in", "Assistant" and "My trips". Backend is already enabled.

## Two things to confirm

1. **Real bookings now?** Earlier we agreed booking and payments stay switched off until ~1000 active accounts. This request asks for real test-mode booking. Plan below builds the full booking flow in **test mode only** (test travel key + test card, no real money, clearly labelled). Say the word if you'd rather stop before the booking step.
2. **Missing keys.** The travel data key and the card-payment key are not saved yet. Without the travel key, signed-in users will see "Connect live search" instead of sample data (as you asked). I'll ask for both keys once the flow is ready.

## 1. Sign in and onboarding

- /auth gets magic-link email and Google sign-in (keeping the existing password option).
- After first sign-in: 3-step onboarding.
  1. Name + home airport (default Warsaw).
  2. Preferences: seat, cabin, max connections, minimum hotel rating, free-text hotel rules, car transmission.
  3. Optional invoice companies: name, VAT ID, address, invoice email; several allowed, one marked default.
- Onboarding can be reopened later from the account area.

## 2. Data

New tables, each private to its owner: preferences, companies, trip_requests, trip_cards, trip_items (extended), payments, pricing_rules, subscriptions, audit_log. Existing profiles/trips are kept and extended.

Pricing table seeded exactly as specified: flight 4%, stay 12%, car 10%, extras 40% markup; Select −3%, Signature −6%; change fee 20 / 15 / 0 EUR.

## 3. Real search

- The hero sentence box and its chat animation stay exactly as they are.
- Signed-out: sample card, as today.
- Signed-in: live search using the traveller's own preferences — flight, hotel near the centre above the 25th price percentile, car at the airport (skipped quietly if unavailable). Prices include the markup for the user's plan; "saved" stays an estimate (8% and 160 minutes).
- Sentence understanding: rule-based city/date/cabin parser, upgraded to Claude when the AI key is present, with at most one clarifying question.
- Each search is stored, cached 10 minutes, limited to 10 searches per user per hour.
- No sample data is ever shown as real to a signed-in user.

## 4. Booking (test mode)

- "Book it all" opens a confirmation step: travellers (from profile + passport details, stored encrypted), invoice company preselected, insurance toggle.
- Prices are re-checked before charging; any line that moved more than 2% is shown as a difference and must be re-confirmed.
- Booking runs flight → hotel → car; if anything fails, what succeeded is cancelled and the payment released, with a plain error message.
- "My trips" becomes real: their own trips, per-line status, documents, and a cancel action that shows the refund conditions first.

## 5. Plans

- New Plan page: Free / Select / Signature with the benefits already on the landing page. Card checkout is wired when the payment key exists, otherwise "Coming soon". Plan changes affect prices immediately.

## 6. Internal page

/dev/status, signed-in only: lists which keys are configured (names only, never values) and whether live search and booking are available.

## Technical notes

- Backend logic uses TanStack server functions (`src/lib/*.functions.ts`) and server routes for external callbacks — this project's runtime replaces Supabase edge functions, so `trip-parse` / `trip-search` / `trip-book` become server functions with the same behaviour.
- Travel provider calls stay server-only, keys never reach the browser.
- Migrations include grants + owner-only row-level policies; passport data encrypted at rest via a server-held key.
- Strict TypeScript, mobile-first 390px, loading/error states, reduced-motion respected.
- Delivered in order: 1 auth/onboarding + data model → 2 live search → 3 booking + My trips → 4 plans + /dev/status. Nothing published.
