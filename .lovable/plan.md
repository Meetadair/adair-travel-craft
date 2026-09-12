# Personal example prompts + reading the connected calendar

Two additions for signed-in customers. The public marketing page keeps its current
generic examples and stays untouched.

## Part 1 — Example prompts built from the customer's own profile

Today the three chips under the assistant input are fixed sentences from the
locale files. For a signed-in customer they will be generated from their own data.

Candidates, in this priority order, skipping any the data doesn't support:

1. Home airport city as the departure in every example (never another city).
2. A repeat of a destination they actually booked: "Same as Milan in March, but a week later."
3. A business example using their default invoice company: "Vienna Tuesday to Thursday, invoice to <company>."
4. A Getaway-style example from active destinations that pass the existing reach
   and season filters plus their interests.
5. A must-arrive-by example: "I need to be in <nearby business city> by 3pm on Thursday."

Behaviour: three shown at a time, rotated (a daily seed plus the customer's id, so
they change instead of being fixed forever), tapping one fills the input without
submitting so it can be edited. Signed-out visitors and the marketing page keep the
current generic examples.

### Technical notes
- New pure builder `src/lib/prompt-suggestions.ts` — takes home airport, past trips,
  default company, matched getaway destinations and preferences, returns ordered
  sentence candidates. Unit-tested (priority order, home-airport-only departures,
  no candidate when data is missing, rotation is stable per day).
- New `src/lib/suggestions.functions.ts`: `getPromptSuggestions` server fn behind
  `requireSupabaseAuth`, reading `profiles`, `preferences`, `trips`, `companies` and
  `getaway_destinations`/`getaway_destination_themes`, reusing `reachFrom` and
  `inSeason` from `src/lib/getaway/match.ts`.
- `src/pages/assistant.tsx` renders the returned suggestions when signed in and the
  locale examples otherwise.

## Part 2 — Reading the connected calendar to propose trips

Reading is a separate, optional opt-in on top of the existing write connection.

- In Settings, under Connected calendars: "Let Adair spot trips you'll need to book —
  we only look for events with a location away from home, and never read anything
  else." Opting in re-consents with a read-only scope added. Turning it off removes
  the read permission flag and deletes every stored hint.
- The scan looks only at events in the next 90 days that have a location resolving to
  a city different from the customer's home city. Everything else is ignored: no
  all-day personal events, no recurring events, nothing without a location.
- A match appears as a suggestion, never a booking: "You have 'Conference' in
  Barcelona, 12–14 October. Shall I plan the trip?" Accepting fills the assistant
  input with a sentence carrying a must-arrive-by time from the event start, so it
  flows into the backwards planning already built. Dismissing removes it for good.
- Only event id, title, location, start and end are stored, in `calendar_trip_hints`;
  hints are deleted once past or dismissed.
- Without the read scope everything keeps working exactly as now.
- No mailbox reading of any kind — calendar only.

### Technical notes
- Migration: `calendar_connections.read_enabled boolean not null default false`;
  new table `calendar_trip_hints(id, user_id, provider, event_id, title, location,
  city, starts_at, ends_at, dismissed_at, created_at)` with owner-only RLS and the
  standard GRANTs, unique on `(user_id, provider, event_id)`.
- `providers.server.ts`: add read scopes (`calendar.readonly`, `Calendars.Read`) to
  the authorize URL only when read consent is requested, plus `listUpcomingEvents`
  for Google (`events?timeMin&timeMax&singleEvents`) and Graph (`calendarView`).
- New `src/lib/calendar/hints.server.ts`: filter events (location present, resolves
  via `findCity`, city ≠ home city, not all-day, not recurring), upsert hints, purge
  past ones. Pure filter tested in `hints.test.ts`.
- `calendar.functions.ts` gains `setCalendarRead`, `scanCalendarHints`,
  `listTripHints`, `dismissTripHint`; `startCalendarConnect` takes a `read` flag.
- UI: read opt-in row in `src/components/prefs/connected-calendars.tsx`; new
  `src/components/calendar-trip-hints.tsx` shown on the assistant page above the
  input, mobile-first at 390px.

## Verification
Type-check, full test run, assistant/settings routes load, roadmap.md updated.
