# Roadmap

## Duffel integration (test mode)
- [x] Rule-based trip parser + city→IATA/coords map (40 EU cities + Tokyo/New York/Dubai)
- [x] POST /api/trip/parse
- [x] POST /api/trip/search: flights, Stays, Cars (graceful skip), FX to EUR, saved estimates
- [x] 10-minute server cache + 10 searches/IP/hour rate limit
- [x] Hero → real search in the chat animation (min 1.5 s indicator), rows hidden when a part is missing
- [x] Source tags, "Book it all" disabled with launch tooltip, test-mode note
- [x] New copy in en.ts + 13 locale files regenerated
- [x] Verified at 390 px, reduced motion, typecheck

## In progress
- [ ] Real product behind sign-in: auth + onboarding, data model, live search, test-mode booking, My Trips, plans, /dev/status
- [x] DUFFEL_API_KEY saved (test mode) — verify live search

## Done
- Business card for Kitti Fodor in the chosen layout

## Real product behind sign-in (done, preview only)
- [x] Data model: preferences, companies, trip_requests, trip_cards, payments, pricing_rules, subscriptions, audit_log; owner-only access
- [x] Sign in with Google + email link (password kept), 3-step first-login setup at /onboarding
- [x] Signed-in hero search uses real supplier results, plan pricing and saves a trip card
- [x] Test-mode booking at /book/:cardId, confirmation, reprice check, per-line cancel
- [x] My trips at /trips with real bookings, /plan (paid plans Coming soon), /dev/status
- [ ] Hotels and cars: supplier account returns not-authorised; stored as requested lines until enabled
- [ ] Card payments: open at ~1000 active accounts

## Rich onboarding + map (this round)
- [x] Part A: one-question-per-screen onboarding (config-driven), searchable home airport, all preference groups, repeatable companies; editable at /preferences; preferences feed search ranking
- [x] Part C: hotel/car lines always explain themselves when nothing is available; insurance + requested names on the signed-in card
- [x] Part B: multi-city parsing into ordered stops, "Show on map" (OpenStreetMap, no key), drag/arrow reordering with re-search and re-pricing, total distance + detour hint, stops stored with each booking

## Round: user testing feedback (Sep 11)
- [x] Email text for supplier form (enable Stays/Cars on the account) — delivered in chat
- [x] Verify signed-in card really renders car, insurance and requested names (present; only visible after sign-in)
- [x] Verify onboarding/preferences show selectable lists: airlines, cabin, seat, hotel chains/amenities/stars/rating/distance, cars, cuisines, music, interests
- [x] Multi-city map + reordering available for any trip, incl. private (Warsaw>Paris>New York>London)
- [ ] Idea to consider: early-booking discounts for private trips (honeymoon/holidays)

## Round: Sep 12 task list
- [x] Task 0: move "For companies" out of the top nav to the footer (it is an offer page, not the user panel)
- [x] Task 1: verify typecheck + preview, Invoices/Settings in nav, invoice email after booking
- [x] Task 2: peak-pricing baseline comparison (±3/7/14 days), Claude event naming, ask-to-move-dates prompt (leisure only)
- [x] Task 3: swap a line from stored alternatives, choice_feedback table, per-line match score, trip budget status, amend-by-sentence
- [ ] Task 4: split questionnaire into Part 1 essentials + dealbreakers (hard filters) and Part 2 optional refinement with completion %
- [ ] Task 5: smaller logo in the top bar (~70-75%)

## Round: restaurants + rides (provider-adapter layer)
- [x] `src/lib/suppliers/` adapter layer: one shared contract per category, one file per provider (uber, bolt, thefork, opentable), each reading its own secret and reporting `unavailable` when absent
- [x] `providers` table records which provider is enabled per category, so one can be switched on without a deploy
- [x] `pricing_rules` extended: `ride` 1000 bps, `restaurant` 0 bps (all plans)
- [x] Optional airport transfers on the signed-in card and at booking (opt-in, pickup/drop-off derived from the flight and hotel, no invented fare), stored as `trip_items` of kind `ride`
- [x] Dinner reservations section per evening of the trip, filtered by the profile's cuisines/diets/distance/budget, with a per-offer match score; "Add a reservation" on confirmed trips in My trips
- [x] Rides and reservations included in the .ics export and reminder emails
- [ ] Connect the live supplier APIs: add the provider key and fill in that adapter's search/quote/book/cancel

## Payments (done)
- Duffel hosted card form + 3-D Secure on the booking screen (test mode), card data never touches our backend
- Saved cards (provider token only), payment outcomes + idempotency key recorded in payments
- No Apple Pay / Google Pay: Duffel Cards does not support digital wallets. Add Stripe alongside if wallets are wanted.

## Analytics & admin (in progress)
- [x] Database groundwork: admin flag on profiles (self-promotion blocked), events table, error_log table, admin-only report query, admin-editable pricing rules + providers
- [ ] /admin/analytics page reading the report
- [ ] /admin panel: pricing rules, bookings, users, providers, secrets status, recent errors
- [ ] Event logging from the app (typed sentence, search, card, booking start/finish, onboarding steps, cheaper-dates outcome, match scores, failures)
- [ ] Global error boundary writing to error_log

## Connected calendars (this round)
- [x] `calendar_connections` (owner-only, tokens encrypted with CALENDAR_TOKEN_KEY), `calendar_feeds`, `calendar_oauth_states`; `trip_items.calendar_event_ids`
- [x] Google Calendar (scope `calendar.events`) and Microsoft Graph (`Calendars.ReadWrite`) OAuth, callback at `/api/public/calendar/callback/:provider`, disconnect deletes the tokens
- [x] Apple: private webcal feed at `/api/public/calendar/feed/:token.ics` — subscribe once, refreshes automatically (no credentials needed)
- [x] Booking writes events to every connected calendar and stores provider event ids, so changes update and cancellations delete instead of duplicating; reminders 24 h + 2 h (Graph supports one reminder: 2 h)
- [x] "Add to calendar" .ics download kept as the always-available fallback
- [ ] Add GOOGLE_CALENDAR_CLIENT_ID/SECRET and MS_GRAPH_CLIENT_ID/SECRET to switch those two options on (hidden with a short note until then)

## Payment provider adapter layer (this round)
- [x] `src/lib/payments/types.ts`: one interface — createIntent / confirm / capture / cancel / refund / getStatus / supportedMethods, plus honest `unavailable` reasons and the settlement model (supplier-of-record vs merchant-of-record)
- [x] `duffel-payments.ts` (card only, supplier of record) and `stripe.ts` (Payment Intents with Apple Pay + Google Pay via the Payment Element, merchant of record) — built but inactive
- [x] `payment_providers` config row decides the active adapter; `registry.server.ts` picks the enabled row whose credentials exist; Duffel Payments stays the default
- [x] Booking and the payment step call only the interface — no provider SDK import in the booking flow
- [x] Checkout renders wallet buttons only when the adapter reports them and the device supports them; Duffel shows a plain note instead
- [x] `payments` records provider, provider reference, method, settlement model, idempotency key and outcome; a retry stops before the supplier
- [x] Admin screen at `/admin/payments`: switch provider without a deploy (written to `audit_log`), see credentials/test mode/methods per provider and the last 50 payments with their money model
- [ ] To go live on Stripe: add STRIPE_SECRET_KEY + STRIPE_PUBLISHABLE_KEY and make its row active

## Work order (Sep 2026)
- [x] Step 1 — "Show other options": alternatives are stored on the card server-side; flight alternatives now deduped on the real itinerary (so three distinct flights, not the same one thrice); the control is a full-width bordered button with an option count, directly under the flight line, plus a calm note when the supplier returned nothing else.
- [x] Step 2 — plan backwards from a fixed arrival time: parser reads "be in Milan tomorrow at 3pm" / "muszę być w Mediolanie jutro o 15:00" into `must_arrive_by` + `meeting_location`; `planning_rules` table holds the buffers (45/75 min airport, 30 min margin, +20 min for business, transfer = 12 min + 1.6 min/km) and is admin-tunable; the search picks the latest flight that still lands in time, shows the arithmetic on the card, offers the calmer flight when tight, states the shortfall plainly when nothing arrives in time, adds the airport→meeting transfer (no price — no ride supplier connected), and handles the reverse "leave by" constraint
- [x] Step 3 — analytics + admin panel + event logging + error boundary: first-party `events` log (`src/lib/events.functions.ts`, `src/lib/track.ts`) written from the app for sentences typed, searches, cards, match scores, swaps and reasons, cheaper-dates accept/dismiss, onboarding steps/skips and booking start/complete/fail; `/admin/analytics` renders the funnel, onboarding completion + worst question, destinations/value/peak share, swap reasons, match quality and unmet preferences, bookings with margin by day, cancellations and failure causes, all aggregated by the `admin_analytics()` SQL report; `/admin` edits pricing rules (written to `audit_log` with the actor), lists bookings with lines/payments/documents and admin cancellation, lists users with plan/onboarding/preference completion and the admin flag, toggles providers, shows which keys are configured (names only) and the most recent errors; the root error boundary now also writes to `error_log`
- [x] Step 4 — questionnaire split: every question carries `part: 1 | 2` in `src/lib/prefs/questions.ts`; onboarding asks the eight essentials (home airport, purpose, cabin, seat, hotel stars, hotel rating, car setup, budget), then a bridge screen offering "Finish now" or "Keep going" for the taste questions; Preferences groups the same set under "Essentials" and "Taste" Part 1 now also asks the dealbreakers as toggles (never below 4 stars, no lift, shared bathroom, automatic only, non-smoking, no hostel, step-free, pets) and those act as HARD filters applied before ranking — stays and cars failing one are dropped, and the rules a supplier does not publish are shown honestly instead of guessed. Part 2 adds travel style, typical trip length, booking lead time, who they travel with, loyalty programmes, three trade-off questions and free-text accessibility / always-avoid notes, stored in `preferences.dealbreakers`, `extra_answers`, `accessibility_note`, `avoid_note`. Preferences shows a completion meter for Part 2, and the dashboard carries a dismissible "finish your profile" prompt.
- [x] Step 5 — small fixes verified: top-bar logo at `h-7` (~75% of before), voice input live behind feature detection, calendar connect + ICS + reminders in place, payment provider adapter active with Duffel selected and Stripe built but off

## Adair Getaway (built, content pending)
- [x] Data model: `getaway_themes`, `getaway_destinations`, `getaway_destination_themes` (season lives on the join row), `getaway_places`, `getaway_itineraries` + `getaway_itinerary_days`, `getaway_prices`, plus `getaway_proposals` (one per traveller per week) and `getaway_theme_optouts`
- [x] Matching engine (`src/lib/getaway/match.ts` + `src/lib/getaway.functions.ts`) in the fixed order: REACH from the stored home airport (3 h flight, or 3 h drive only where the destination is marked drivable from that airport; anything longer is only shown framed as "needs more than a weekend") → SEASON enforced in the query against the theme join row → INTEREST against interests/cuisines/travel style/companions/budget → PRICE last, as a tie-break against our own baseline
- [x] Nightly price check at `/api/public/getaway-prices` (cron-secret protected): every home airport in use × active destinations × the next two weekends, capped at 120 lookups, paced ~0.9 s apart so live searches always win, skips anything priced in the last 20 h, prunes past 90 days
- [x] `/getaway`: this week's proposal with the editorial note, curated places, day-by-day itinerary, real checked price with an honest "below/about/above the usual price" verdict, "Plan this trip" handing the sentence to the normal search flow, and "Not interested in <theme>" feeding straight back into matching
- [x] Weekly email at `/api/public/getaway-weekly`; skips silently without RESEND_API_KEY (in-app always works)
- [x] `/admin/getaway`: themes, destinations, per-theme season windows, curated places and day-by-day itineraries, active toggles everywhere, plus a list of destinations with no curated places yet
- [x] Seeded 8 themes and 24 destinations with airports, coordinates and season windows — every editorial note and every curated hotel/restaurant deliberately left empty for the team
- [ ] Schedule the two endpoints (daily price check, weekly email) — needs the cron secret pasted into the schedule, same as the trip reminders
- [ ] Editorial content: notes, best-for/avoid-when, curated hotels/restaurants/sights, itineraries

## Known warning
- The database security linter flags `admin_analytics()` and `is_admin()` as SECURITY DEFINER functions callable by signed-in users. Both are intentional: `admin_analytics()` refuses non-admins itself, and `is_admin()` is what the policies rely on.

## Branding pass (done)
- [x] Removed every supplier name the traveller can see: the "Duffel · NDC/GDS" / "Duffel Stays" / "Duffel Cars" tags are gone from the card in all 14 languages, the "five apps" comparison names a ride app and a restaurant app instead of Uber and OpenTable, the payment note and receipt no longer name the payment provider, transfers no longer show a ride-provider chip, and invoices print the booking reference alone
- [x] Unavailable lines and failures now speak about Adair ("Transfers available at launch", "Live search is not switched on yet") and no error text names a provider
- [x] Test-mode carrier and property names stay as they arrive from the supplier — that is data, and the row is labelled as test data
- [x] Provider names remain accurate everywhere the traveller never looks: /admin, /dev/status, database columns, adapter labels, logs, code comments and this file

## Hardening pass
- [x] 1 — Automated tests (vitest, `bun run test`): 88 checks. Pricing engine (exact minor units per plan/line type, extras rate, change fees, documented fallback when a rule is missing), backwards planning (Schengen vs non-Schengen buffers, business margin, latest flight that still arrives in time, honest shortfall path), parser (English + Polish dates, weekdays, cabin, passengers, named hotel, invoice-to-company, must_arrive_by, multi-city), Getaway matching (reach threshold, season, dealbreakers as hard filters, interest outranking price), booking idempotency (`src/lib/trip/idempotency.ts` — one key, never two charges or two orders), credit ledger, plus a smoke test importing every route module.
- [x] 2 — Supplier order-change webhook at `/api/public/supplier/order-updated`: HMAC-SHA256 over the raw body with a timing-safe compare before anything is parsed, replay protection via `supplier_events`, updates the affected `trip_items`, cancels the trip when no live items remain, syncs or removes the connected calendar events by stored provider event ID, writes before/after `audit_log` rows, and emails the traveller when RESEND_API_KEY exists. Returns 503 until `SUPPLIER_WEBHOOK_SECRET` is configured; the same secret must be set in the supplier dashboard.
- [x] 3 — Referrals and credit: `referral_codes` (one code per traveller, created on first use), `referrals` (one attribution per invited traveller), `credits` ledger. `/r/:code` remembers the code and sends the visitor to sign in; the code is claimed once they are signed in. Both sides are paid only when the invited traveller's FIRST booking confirms — €40 referrer, €20 friend — and never on signup. Credit is applied automatically against the next booking total and shown with balance and history at `/credit`. Vouchers only, never stored money.
- [x] 4 — Waitlist no longer diverges: `waitlist` carries `invited_at`, `invite_error`, `user_id`; `/admin` lists everyone waiting and turns sign-ups into real account invitations in batches, marking already-registered addresses as reconciled.
- [x] 5 — PWA: `public/manifest.webmanifest`, icons generated from the Adair logo, `public/service-worker.js` caching only the offline shell and static assets (never `/api/*` or server-function calls), `public/offline.html` saying plainly that searching and booking need a connection. No offline booking.

## Personal example prompts + calendar-read trip hints (this round)
- [x] `src/lib/prompt-suggestions.ts` — pure builder: always departs the stored home airport, then repeat-a-past-trip, default-invoice-company, in-season/in-reach Getaway match, must-arrive-by example; rotates daily by user seed, tapping fills the input without submitting. 8 unit tests.
- [x] `src/lib/suggestions.functions.ts` — authenticated server fn feeding the builder from profile / preferences / past trips / default company / active getaway destinations. Signed-out marketing page keeps the generic examples, unchanged.
- [x] Calendar read is a SEPARATE optional opt-in (`calendar_connections.read_enabled`, read scopes requested only when asked via a `read_` state prefix); turning it off deletes the stored hints.
- [x] `calendar_trip_hints` (owner-only): only future, non-all-day, non-recurring events whose location resolves to a city away from home, 90-day window, minimal fields only; past hints purged, dismissal final. 8 unit tests.
- [x] `src/components/calendar-trip-hints.tsx` — suggestion cards above the input ("Shall I plan the trip?"), prefilling a must-arrive-by sentence into the existing backwards planning. Never books automatically.
- [x] No mailbox/email reading anywhere — deliberately out of scope.
- Build clean: tsgo clean, 104 tests pass, `/`, `/assistant`, `/preferences`, `/trips` all 200.
