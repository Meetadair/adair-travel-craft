/**
 * Real events happening near a trip — concerts, shows, sport. Ticketmaster's
 * Discovery API can search and describe these, but its self-serve tier
 * cannot sell a ticket through us (see ticketmaster.server.ts for why): every
 * card links out to Ticketmaster's own event page, and Adair never claims to
 * hold, reserve or sell a ticket.
 */

export type TripEvent = {
  /** Ticketmaster's own event id. */
  id: string;
  name: string;
  /** "YYYY-MM-DD", the local date Ticketmaster gives for the event's start. */
  date: string;
  /** "HH:mm", null when Ticketmaster has no confirmed start time. */
  time: string | null;
  venueName: string | null;
  city: string | null;
  /** Ticketmaster's own segment/genre label ("Music", "Sports", ...). */
  category: string | null;
  /** Null when Ticketmaster gives no price range for this event. */
  priceFrom: number | null;
  priceTo: number | null;
  currency: string | null;
  distanceKm: number | null;
  imageUrl: string | null;
  /** Ticketmaster's event page — the only place to actually buy. */
  url: string;
};
