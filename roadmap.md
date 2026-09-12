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
