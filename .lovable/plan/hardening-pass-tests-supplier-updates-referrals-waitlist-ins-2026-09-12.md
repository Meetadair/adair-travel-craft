# Hardening pass: tests, supplier updates, referrals, waitlist, installable app

Five pieces of work, in order, each finished and verified before the next starts.

## 1. Automated tests (the priority)

Add Vitest with a Node environment plus a jsdom project for route rendering. New scripts: `test`, `test:watch`.

Covered, all asserting exact minor-unit amounts:

- **Pricing** — markup and discount per plan and line type against a stubbed rules source, extras rate, change fees, and the documented fallback when a rule row is missing. Rounding checked at the minor-unit boundary.
- **Backwards planning** — the chosen flight clears airport time + transfer + safety margin before the required arrival; the "nothing lands in time" path returns the honest shortfall and `feasible: false` instead of a wrong pick; Schengen and non-Schengen buffers produce different results for the same flight; business adds its extra margin; the calmer alternative appears only when the pick is tight.
- **Parser** — English and Polish sentences: weekday resolution relative to a fixed "today", explicit night counts, cabin class, passenger counts, named hotel and named car, invoice-to-company, `must_arrive_by` with meeting location, and multi-city stop ordering with the departure city excluded.
- **Getaway matching** — reach beyond the weekend threshold is excluded from weekend proposals; out-of-season destinations never appear; a dealbreaker removes a candidate outright rather than lowering its score; a cheaper destination never outranks a better-matching one.
- **Booking idempotency** — the pure guard that decides "already settled → stop before the supplier" is extracted from `booking.functions.ts` into a small tested module, and the booking flow calls it. Tests prove one key yields one order and one charge, and that a retry after a settled payment stops without touching the supplier.
- **Route smoke test** — every route module is imported and every page component rendered against a test router; a throw fails the test. Server-only routes are asserted to export a handler.

Where the current code makes an assertion impossible without a live database, the pure logic is lifted into a testable function and the server function calls it. No behaviour changes.

## 2. Supplier order-change webhook

New endpoint under the public API path, signature-verified with a timing-safe HMAC compare against a secret; unsigned or badly signed requests get 401 before the body is parsed as data. Replays of an already-seen event id are ignored.

On a schedule change, cancellation or supplier-initiated change:
- update the affected `trip_items` (status, times, payload) and the trip status when the whole order is cancelled
- update or delete the matching calendar events using the provider event ids we already store, on every connected calendar
- write a before/after row to `audit_log`
- email the customer when the email key exists; skip silently when it does not

The secret is a shared value the supplier's dashboard also needs, so you will create it yourself and paste the same value in both places. I will deploy the endpoint first and give you its URL.

## 3. Referrals and credits

- A unique referral code per user, generated on first sign-in and shown with a shareable link.
- `/r/<code>` attributes a visit to that code and carries it through sign-up.
- A `credits` table (owner-only) with a ledger of grants and spends. Both sides are granted only when the referred user's **first booking confirms** — never on signup.
- €40 to the referrer, €20 to the friend, matching the marketing promise.
- Balance and history in the app; the balance is applied against the next booking total as our own voucher, capped at the total, recorded as a discount line — not stored money, never refundable in cash.

## 4. Waitlist to invitations

A one-off backfill plus an ongoing path so the two lists stop diverging: each waitlist record becomes an invitation the app can see, marked as invited or already-registered, with the referral code preserved so credits still attribute. Existing accounts are matched by email and not duplicated.

## 5. Installable app

Manifest, icons generated from the existing Adair mark, and a service worker caching the app shell and static assets. Pages that work without network keep working; anything needing live data shows a calm offline message in the existing tone. Booking and payment are never cached or attempted offline.

## Notes and assumptions

- There is no `credits` table yet, so step 3 creates it (the brief refers to it as existing).
- Two database migrations: one for credits/referrals, one for waitlist invitations.
- Two secrets are needed from you: the supplier webhook signing secret (step 2). Email sending stays optional as it is today.
- `roadmap.md` gets a section per step; the pre-existing analytics-function security warning stays as it is.

## Technical detail

- `vitest` + `@vitejs/plugin-react` + `jsdom` + `@testing-library/react`; tests under `src/**/*.test.ts(x)`, config in `vite.config.ts` via a `test` block with two projects (node, jsdom).
- Extracted pure modules: `src/lib/trip/idempotency.ts`, and pricing/getaway helpers already pure.
- Webhook route: `src/routes/api/public/supplier/order-updated.ts`, HMAC SHA-256 over the raw body, `crypto.timingSafeEqual`, `supabaseAdmin` loaded inside the handler after verification.
- Credits: `credits` (user_id, kind, amount_minor, currency, reason, trip_id, referral_id) + `referrals` (code, referrer, referred_user, status), both with GRANTs, RLS owner-only, and admin/service-role writes for the grant path.
- PWA: `public/manifest.webmanifest`, `public/sw.js` registered from the root route, `public/icon-192.png` / `icon-512.png` / maskable.
