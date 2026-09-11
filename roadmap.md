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
