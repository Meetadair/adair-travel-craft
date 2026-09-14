# Adair

AI travel assistant: one sentence in, a complete trip out — flight, hotel and car
composed into a single bookable card, instead of five separate apps.

## Stack

- TanStack Start (React, file-based routing, server functions)
- Tailwind CSS + shadcn/ui
- Supabase (Postgres, auth, storage)
- Duffel (flights; stays and cars pending product activation)
- Anthropic Claude (natural-language trip parsing)
- Vitest

## Getting started

Requires Node.js and npm.

```sh
npm install
npm run dev
```

## Environment

Copy the keys below into a `.env` file in the project root. It is git-ignored —
never commit it.

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase client (browser) |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | Supabase client (SSR) |
| `ANTHROPIC_API_KEY` | Trip parsing and i18n translation script |
| `DUFFEL_API_KEY` | Flights, stays and cars |
| `STRIPE_SECRET_KEY` | Payments |
| `UNSPLASH_ACCESS_KEY` | Destination photography (optional) |

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm test` | Test suite |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |

## Notes

Duffel Stays and Cars are not yet enabled on the Adair account; the API answers
`403` for those products. The booking layer detects this and leaves hotel lines
on the trip as *requested* without charging, so no code change is needed on the
day Duffel switches them on.
