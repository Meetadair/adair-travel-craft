import { describe, expect, it } from "vitest";
import { claimsBooking, safeReply } from "./reply-guard";

describe("the assistant may not claim a booking that has not happened", () => {
  it("catches the sentence that started this", () => {
    // Seen on screen, above a card with a Book button still on it.
    expect(
      claimsBooking("I've booked your trip from Warsaw to Lisbon from October 20 to October 24."),
    ).toBe(true);
  });

  it("catches the claim in the other languages Adair speaks", () => {
    for (const claim of [
      "Zarezerwowałem Twoją podróż z Warszawy do Lizbony.",
      "Twoja podróż została zarezerwowana.",
      "Ich habe Ihren Flug nach Lissabon gebucht.",
      "Ihr Hotel ist gebucht.",
      "J'ai réservé votre voyage à Lisbonne.",
      "He reservado su viaje a Lisboa.",
      "Ho prenotato il tuo viaggio per Lisbona.",
      "Your trip is confirmed.",
      "We have successfully booked your hotel.",
    ]) {
      expect(claimsBooking(claim), claim).toBe(true);
    }
  });

  it("leaves honest sentences alone, including ones about booking", () => {
    // Over-blocking would cost the assistant the ability to discuss booking.
    for (const honest of [
      "Lisbon: 2026-10-20 – 2026-10-24. Your composed trip is below.",
      "Ready to book whenever you are.",
      "Book this trip when the dates look right.",
      "I found a Lufthansa flight and a hotel near the station.",
      "Twoja podróż jest gotowa do rezerwacji.",
      "You can book it in one step.",
    ]) {
      expect(claimsBooking(honest), honest).toBe(false);
    }
  });

  it("falls back to our own sentence rather than editing theirs", () => {
    const ours = "Lisbon: 2026-10-20 – 2026-10-24. Your composed trip is below.";
    expect(safeReply("I've booked your trip.", ours)).toBe(ours);
    expect(safeReply("Lisbon in October, one hotel and a flight.", ours)).toBe(
      "Lisbon in October, one hotel and a flight.",
    );
  });

  it("uses our sentence when the model said nothing", () => {
    const ours = "Lisbon: 2026-10-20 – 2026-10-24.";
    expect(safeReply(null, ours)).toBe(ours);
    expect(safeReply("   ", ours)).toBe(ours);
  });
});
