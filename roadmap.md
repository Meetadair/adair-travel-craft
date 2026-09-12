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
- [ ] Step 3 — finish analytics + admin panel + event logging + error boundary
- [ ] Step 4 — questionnaire split (Part 1 essentials/dealbreakers, Part 2 optional)
- [ ] Step 5 — small fixes (logo size, voice, calendar, payment adapter verification)
