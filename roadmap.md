# Roadmap

## Duffel integration (test mode)
- [ ] Rule-based trip parser + city→IATA/coords map (40 EU cities + Tokyo/New York/Dubai)
- [ ] POST /api/trip/parse server route
- [ ] POST /api/trip/search server route: Duffel flights, Stays, Cars (graceful skip), FX to EUR, saved estimates
- [ ] 10-minute server cache for identical searches + 10 searches/IP/hour rate limit
- [ ] Hero → real search wired into chat animation (min 1.5 s indicator), rows hidden when a part is missing
- [ ] Source tags (Duffel · NDC/GDS, Duffel Stays, Duffel Cars), "Book it all" disabled with launch tooltip, test-mode note
- [ ] New copy in en.ts + regenerate 13 locale files
- [ ] Verify at 390 px, reduced motion, typecheck

## Blocked
- [ ] Live Duffel results need the DUFFEL_API_KEY secret (user adds it in project settings); until then sample data shows.

## Done
- Business card for Kitti Fodor in the chosen layout
