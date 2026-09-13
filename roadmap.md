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
- [x] Task 4: split questionnaire into Part 1 essentials + dealbreakers (hard filters) and Part 2 optional refinement with completion %
- [x] Task 5: smaller logo in the top bar (~70-75%)

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

## Analytics & admin (done)
- [x] Database groundwork: admin flag on profiles (self-promotion blocked), events table, error_log table, admin-only report query, admin-editable pricing rules + providers
- [x] /admin/analytics page reading the report
- [x] /admin panel: pricing rules, bookings, users, providers, secrets status, recent errors
- [x] Event logging from the app (typed sentence, search, card, booking start/finish, onboarding steps, cheaper-dates outcome, match scores, failures)
- [x] Global error boundary writing to error_log

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

## Gap-filling pass

- [x] GDPR: "Download my data" (JSON + summary, audit-logged) and account deletion in Settings — personal data removed, calendar tokens revoked, tax/payment rows anonymised not deleted, existing supplier bookings must be cancelled first.
- [x] /privacy and /terms placeholder pages (to be completed by counsel) linked from the signed-in footer.
- [x] Support: `support_requests` table, Help in the signed-in nav, "Something wrong with this trip?" on every trip, /support form (trip auto-attached, category, urgency, description), admin "Help requests" card with trip context and status changes, optional Resend notification to SUPPORT_EMAIL (skipped silently when unset).
- [x] Multi-passenger booking (parser count, per-passenger details, per-count pricing).
- [x] Loyalty numbers passed to the supplier / stored on the booking.
- [x] Change a booked trip (dates, hotel) with price difference and change conditions.
- [x] One clarifying question at search time when the sentence is genuinely ambiguous; assumption stated on the card, questions counted in admin analytics.
- [x] Ranking that learns from `choice_feedback`, surfaced and resettable on Preferences (stated always beats learned).

## Loyalty programmes (amended item 4)
- [x] Wallet in Settings ("Saved details"): airlines, hotels, car rental; several per category; programme list + free text; optional tier.
- [x] Member numbers encrypted at rest (TRAVELLER_DATA_KEY), shown masked, full on tap.
- [x] Passed at booking: frequent-flyer accounts on the flight order, hotel number stored on the stay, car membership on the car line; confirmation lists applied vs not applied.
- [x] Part 2 questionnaire reduced to one light-touch yes/no pointing to Settings.

## Final feature pass

### 1. Early-booking discount (leisure only) — done
- [x] Configuration, not code: `pricing_rules` rows `lead_time_90` (200 bps) and `lead_time_60` (100 bps) per plan, editable in /admin like every other rule. No existing rule value changed.
- [x] `src/lib/pricing.server.ts`: `loadLeadTimeTiers`, `daysUntilDeparture`, `leadTimeDiscountBps`, `withLeadTimeDiscount` — lowers OUR markup on every line, floored at zero markup (a commission-only line gives nothing away).
- [x] Applied in `trip-live.functions.ts` only when the trip is leisure (purpose not business); survives a line swap, savings recalculated. Stored on the card as `items.earlyBooking`.
- [x] Card line worded honestly ("you're booking N days ahead, so our fee is lower"), never as a supplier discount. Analytics event `early_booking_discount`.
- Build clean: tsgo clean, 112 tests pass, `/`, `/trips`, `/preferences` 200.

### 2. Travel tips per destination — done
- [x] `getaway_destinations.travel_tips` (jsonb, empty by default) with five editorial categories: getting from the airport, local payment and tipping, transport, one thing worth knowing, when to avoid.
- [x] Editable at /admin/getaway alongside the other editorial content; `src/lib/trip/tips.ts` is the single parser/renderer. 3 unit tests.
- [x] Shown in My trips as "Good to know in <city>" for booked trips only; the day-before reminder email carries the "getting from the airport" note.
- [x] Nothing written yet means nothing shown — no generated filler. Content stays for the team to write.

## WhatsApp notifications (built behind a key, off by default)
- [x] Adapter `src/lib/notifications/whatsapp.ts` — approved templates with ordered
      parameters, Graph v21.0, reports `unavailable` without
      `WHATSAPP_API_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID`.
- [x] Router `src/lib/notifications/send.server.ts` — WhatsApp only when chosen,
      number verified and keys present; silent email fallback; every attempt in
      `notification_log`.
- [x] Settings channel picker (email / WhatsApp / both). WhatsApp controls only
      render when the channel is configured; number collected with country code
      and confirmed by a one-time code (hashed, 10 min, 5 attempts).
- [x] Wired into booking confirmation, day-before reminder, supplier schedule
      change and the weekly Getaway.
- Remaining external setup: Meta business verification and template approval.

## Loyalty clarifications
- [x] A programme can be kept without a member number, but is marked incomplete
      in Settings ("Without your member number, miles won't be credited.") and on
      the confirmation ("Miles & More — no number, not applied").
- [x] Editable `loyalty_earning_rules` table maps each programme to the airlines,
      hotel brands and rental brands it actually earns on (Miles & More on LOT /
      Austrian / Swiss / Star Alliance, Flying Blue on AF-KL-SkyTeam, Avios on
      BA / Iberia / Aer Lingus, Bonvoy across its brands, Hertz Gold across
      Hertz-Dollar-Thrifty, and so on). Booking sends the matching number.
- [x] Where nothing matches: "No loyalty programme applies to this flight."

## Getaway — visual
- [x] Pictures per destination (own upload wins, Unsplash fallback by name, credit stored)
      and one optional picture per itinerary day. Uploads are resized in the browser to
      1600px WebP + JPEG fallback + a 560px email copy under 150 KB, kept in a private
      Cloud storage bucket and served through /api/public/getaway-image.
- [x] /getaway leads with a full-width hero, name and theme overlaid on a gradient scrim.
      One image, never a carousel. No Ken Burns or parallax, so reduced motion is honoured.
      Everything below the hero lazy-loads with explicit dimensions.
- [x] Weekly email: picture, then note, then price. Max 600px wide, small JPEG.
- [x] No picture and no UNSPLASH_ACCESS_KEY → calm typographic header, never a grey box.
- [x] Hotels deliberately have no pictures until the hotel supplier is enabled and its
      own property photos are available.
- [x] UNSPLASH_ACCESS_KEY shown on /dev/status.

## Creator programme (built)
- [x] `creators` accounts with handle, short code, platform links, statuses (applied/approved/paused/rejected) and encrypted payout details (only last 4 of the IBAN ever shown)
- [x] Application at /creators/apply, approval only from /admin/creators, creator page at /creator
- [x] Attribution: /c/:handle link and short code, 90 days to sign up, then a 12-month earning window (editable per rule)
- [x] `creator_commission_rules` editable in admin — share of OUR margin, seeded 30% stay/car, 20% flight/extras, €10 Select, €25 Signature signup
- [x] Commission accrues on confirmed bookings only, pending until the 14-day free-cancellation window passes, reversed when a trip is cancelled or refunded
- [x] Creator dashboard: real click/sign-up/booking counts, earnings by month, CSV statement, payouts; no customer names anywhere
- [x] Payouts monthly from €50, drawn and marked paid with a reference in admin (we do not move the money)
- [x] Creator-submitted places stay hidden until editorial approval; approved ones show "Recommended by …" plus a plain "Creator partner" label and link to /c/:handle
- [x] Bookings of a creator-recommended place earn that creator, even without their link
- [x] Content licence acceptance stored with a timestamp; licence wording is a placeholder for counsel
- [x] "Recommended by" shows the creator's avatar (or their initial) next to the name
- [x] Tests cover accrual (attribution, curation, expired window, paused creator, markup-derived margin, extras mapping, skipped failed lines) and reversal
- [ ] Flat subscription commission (€10/€25) pays out when paid plans go live

## Round: places to go out (amended from "restaurants") — built
- [x] Categories: restaurants, cafés, bars, wine bars, cocktail bars, rooftops, clubs. OpenStreetMap via Overpass (no key, 7-day cache in `place_cache`) mapping amenity=restaurant/bar/pub/cafe/nightclub plus cuisine/drink/rooftop tags. Curated places in /admin/getaway can be tagged with any category.
- [x] Time-of-day sections per trip day: morning cafés, evening restaurants, late bars/wine bars/cocktail bars/rooftops, night clubs. Rendered as "Tonight in <city>" / "Tomorrow morning in <city>".
- [x] Profile matching: cuisines, interests (wine, gastronomy, nightlife, live music), family travel (nightlife removed entirely, family-friendly boosted), budget band, distance from the hotel; stated dealbreakers remove a place outright.
- [x] One-line reason per place plus a source label (Adair pick / Creator partner / from OpenStreetMap); curated and creator entries always outrank map data. "Map data © OpenStreetMap contributors" shown; "Price not known" where we have no price.
- [x] Restaurants: "Reserve" opens the venue's own site or phone with "Reservation directly with the restaurant". Bars and cafés get "Open in maps" and opening hours where known. "Going there" writes the place onto the trip, the .ics and the reminder.
- [x] Tests: time-of-day bucketing, family/nightlife exclusion, source ranking, dealbreaker precedence, map tag reading (215 tests pass).
- [ ] Booking a table inside Adair — blocked: needs a reservation partner agreement and API credentials (adapter layer and UI are already in place).

## Round: children and family travel — built
- [x] Date of birth required for every traveller and for everyone saved under "people I travel with"; category computed as of the return date (infant under 2, child 2–11, adult 12+), including the birthday-during-trip case; category shown per traveller on the confirmation.
- [x] Parser reads family phrases in English and Polish ("with two kids aged 4 and 7", "z dwójką dzieci 4 i 7 lat", "with a baby", "z niemowlakiem", "family of four", "we czwórkę z dziećmi"). Children without ages → one mandatory clarifying question before searching.
- [x] Flights: infant and child fares requested per category, infant on lap by default with "own seat" where allowed, fare shown per traveller on the card.
- [x] Hotels: occupancy sent with children's ages; rooms that break the policy are not shown, family rooms / suites / two connecting rooms offered instead with the reason stated; policies quoted where given; cot and extra bed as explicit lines with price or "on request at check-in".
- [x] Cars: child seat as an optional line matched to age and weight band, with the company's price where available.
- [x] Rides and restaurants: vehicle capacity for the family size; family-friendly filter respected.
- [x] Profile: children stored with birth dates so "same as Rome, with the kids" reprices correctly.
- [x] Tests: category by return date incl. birthday during the trip, occupancy exceeding a room policy triggering the family-room path, infant on lap vs own seat pricing.

## Round: brands as data — built
- [x] `brands` table (id, kind airline/hotel_chain/car_rental, name, alliance_or_group, regions, aliases, popularity_rank, active) seeded with 141 brands: the three alliances, European and US carriers, Gulf and Asian carriers, the hotel groups with their sub-brands, and the car rental groups incl. Panek and Express.
- [x] Region-aware short list of 14 in onboarding, ranked from the home airport's region, with search across the whole table; Settings shows the full searchable list. "No preference" always available.
- [x] Loyalty earning widened through alliance/group: Bonvoy earns at Westin and Ritz-Carlton, a Star Alliance card earns on Lufthansa and United, Avis Preferred at Budget.
- [x] Preference matching in search ranking and the card's match checklist resolves brand ids to their names and aliases.
- [x] /admin/brands: add, rename, re-rank, set regions and group, hide a brand — no code change.
- [x] Tests for region-based ranking, search and the group-widened loyalty mapping (240 tests pass).

## Fix: several loyalty programmes per category — done
- [x] Settings → Saved details: each category (airlines, hotels, car rental) keeps its own form, so adding one no longer blocks or clears another; the action reads "Add another … programme" once an entry exists, with "Saved. Add another if you hold more than one." and a per-entry Remove.
- [x] Every entry is stored, listed masked to the last four with an optional reveal, and checked at booking; where two programmes both earn we pass one and say plainly that only one can be credited.
- [x] Home screen shows a dismissible reminder to add member numbers when onboarding answered "Yes — I'll add the numbers in Settings" and nothing is saved yet; it disappears once the first programme is saved.

- [x] Step 2(f): add payment cards ahead of time in Settings (hosted form via the payment adapter, default card pre-selected at checkout, honest wallet availability)

## My trips: Upcoming / Past split — done
- [x] Two tabs, "Upcoming" default: return date today or later, soonest first; a trip in progress sits at the top with a subtle "Now" marker.
- [x] "Past" holds completed and cancelled trips, newest first, moved there automatically the day after the return date.
- [x] Past actions: invoice download, "Book again" (same sentence handed to the assistant for new dates) and "Same trip, but…" (amend-by-sentence prefilled). Cancel and "Change this trip" stay on Upcoming only (change now routed at /trips/:tripId/change).
- [x] Month-grid calendar view unchanged and shows both. Empty states: "Nothing booked yet. Describe a trip above to start." / "Your completed trips will appear here."
- [x] Tests for the return-date boundary, the in-progress marker, cancelled trips and both sort orders (272 tests pass).

## Conversational layer — done
- [x] Parse, then confirm: an understanding strip under the input shows from → to, dates, must-arrive-by, travellers and free-text wishes; every structured chip opens an inline picker (calendar, time, searchable airport list, travellers). Search runs only on "Find it".
- [x] Adair asks for what's missing in the chat, at most two questions, with the control under the question: dates, arrival time (mandatory for business trips), child ages, which airport in two-airport cities. Non-essential questions can be skipped and the assumption is stated on the card.
- [x] Advice above the card, capped at two lines, generated from real data: hotel→airport distance and parking vs car price, tight arrival with the calmer flight, peak-week pricing with the cheaper offset, breakfast not included. Each carries one action (Swap, Take the earlier flight, Show cheaper dates, Add breakfast) and logs `advice_acted`.
- [x] At most one nudge per conversation, never again once dismissed: connect the calendar, add a loyalty number, save the default company. Dismissal remembered in the browser and logged.
- [x] Copy in en.ts under `assistant.strip/questions/advice/nudge`, plain short sentences, no exclamation marks; all 13 locales regenerated.
- [x] Tests: understanding strip fields, mandatory arrival-time question for business trips, advice generation and the two-line cap, nudge shown once (295 tests pass).
- [x] Closing the booking in the chat: "Book it all" stays in the conversation. One saved company and one saved card are used without asking; several ask once; no company plus an invoice mention asks for the name once and saves it; no card renders the secure card form inline. Traveller details asked once and stored on the profile. Extras from the sentence are confirmed in one line with a Remove on each. One summary line and [Book it] / [Change something]. `/book/:cardId` stays for passport capture and payment recovery. Copy in `assistant.closing`, all 14 locales regenerated, 308 tests pass.
- [x] Understand the intent before anything else: greeting, trip, amendment, product question, booking question or unclear. Rules decide the clear cases instantly (`src/lib/trip/intent.ts`), a short cached model call settles the doubtful ones (`src/lib/intent.functions.ts`), and only a trip or an amendment reaches the parser. Everything else gets a short answer in the chat.
- [x] The parser no longer invents a destination: `parseTripSentence` returns null when no city is named, `/api/trip/parse` answers 422, and the chat asks "Where are you going?" instead of proposing Milan.
- [x] Copy in `assistant.intent`, all 14 locales regenerated; intent and no-guessed-destination tests added (318 tests pass).




## Traveller memory — done

- Place memory (`traveller_place_memory`): what was chosen in each city, written on every confirmed booking and every swap-to. The remembered hotel is proposed first on a return trip and mentioned in one line; when it is not available the chat says so and names the closest option.
- Patterns (`traveller_patterns`): airline, hotel chain, car brand, morning departures, direct-only, lead time, typical length and typical spend, read from real bookings. Three trips is the threshold; Adair asks once and never asks a rejected habit again.
- Precedence (`src/lib/trip/memory.ts`, `resolvePreferences`): dealbreakers > stated > confirmed patterns > place memory > learned weights > price. Tested, including a dealbreaker beating a learned weight.
- "What Adair knows about you" in Preferences (`src/components/prefs/knows.tsx`): stated preferences, confirmed habits, place memories and ranking adjustments, each removable, plus "Forget everything you've learned" which keeps stated preferences.
- Everything is in the GDPR export and in account deletion.

## Real controls behind every chat question — done

- Shortcut chips first, a real control underneath, on every question with an answer behind it (`src/lib/trip/answers.ts`, `src/components/trip/answer-controls.tsx`).
- Dates: This weekend / Next weekend / Tomorrow above a compact inline month calendar in the chat — single day or outbound + return, past days disabled, opens on the current month, navigable a year forward. Chosen dates fill the answer and then appear in the understanding strip as tappable chips.
- Arrival time: 09:00 / 12:00 / 18:00 chips above a real time picker.
- Airport: known airports as chips above a searchable list matching code, city, country or airport name.
- Travellers: 1–4 chips above a count field and the saved "people I travel with" list.
- Same controls behind the understanding-strip chips, so anything can still be changed before searching.
- Fits 390 px with no horizontal scrolling (checked in the browser); the month grid loads on demand.
- Tests: weekend shortcuts including the Saturday case, sentence folding, calendar bounds, past-date rule and airport search (339 tests pass). All 14 locales regenerated.

## Destination first, no invented city — done

- Question order is fixed: destination, then dates, then the arrival time for a business trip or a mentioned meeting, then anything else. `clarify` (`src/lib/trip/clarify.ts`) returns `needs_destination` before every other question, and `chatQuestions` (`src/lib/trip/questions.ts`) returns the destination question alone while the city is unknown, ranking the rest destination → dates → arrival time → child ages → travellers → airport.
- The Milan default is gone: `src/lib/travel.functions.ts` no longer defaults a city or dates. The rule parser reads the sentence first; with no destination `composeTrip` returns `needsDestination` and never searches. The AI reading must include a city and dates or the rule reading is used.
- `/api/trip/parse` and `runLiveSearch` already refused a sentence without a destination; the only remaining Milan is the marketing example copy, the signed-out demo card and the admin supplier probe.
- Greetings ("hey", "cześć", "hello") get one line — "Hi. Where are you going?" — and nothing else is asked. Same copy in all 14 locales.
- The assistant page now classifies intent before searching (`src/pages/assistant.tsx`), asks one question at a time, and re-checks the sentence after each answer instead of searching blind.
- Tests (`src/lib/trip/order.test.ts`): greeting produces no search, a date with no city asks for the destination, no code path parses a trip without a destination (345 tests pass).
