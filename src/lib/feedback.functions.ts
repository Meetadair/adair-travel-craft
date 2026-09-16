/**
 * The traveller's own verdict on a booked trip.
 *
 * Kept apart from choice_feedback, which records swaps — what someone picked
 * instead of what we recommended. That says which of two hotels they preferred;
 * this says whether the trip was worth booking at all, which is the only
 * question whose answer we cannot infer from behaviour.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { FEEDBACK_SCALE, ratingOf, type FeedbackKey } from "@/lib/trip/feedback";

const schema = z.object({
  rating: z.enum(FEEDBACK_SCALE.map((option) => option.key) as [FeedbackKey, ...FeedbackKey[]]),
  bookingReference: z.string().min(1).max(64).nullable().optional(),
  tripCardId: z.string().uuid().nullable().optional(),
  // Trimmed and capped here rather than in the component, so a second caller
  // cannot post an essay into the column.
  comment: z.string().trim().max(2000).nullable().optional(),
  purpose: z.string().max(32).nullable().optional(),
  party: z.string().max(32).nullable().optional(),
  occasion: z.string().max(32).nullable().optional(),
});

export type SaveFeedbackResult = { saved: boolean };

export const saveTripFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(schema)
  .handler(async ({ data, context }): Promise<SaveFeedbackResult> => {
    const { supabase, userId } = context;

    const row = {
      user_id: userId,
      trip_card_id: data.tripCardId ?? null,
      booking_reference: data.bookingReference ?? null,
      rating: ratingOf(data.rating),
      rating_key: data.rating,
      comment: data.comment?.length ? data.comment : null,
      purpose: data.purpose ?? null,
      party: data.party ?? null,
      occasion: data.occasion ?? null,
    };

    // Answering twice about the same booking replaces the first answer rather
    // than adding a second: someone who rates a trip, then types a sentence and
    // sends it, has one opinion, not two.
    const { error } = data.bookingReference
      ? await supabase
          .from("trip_feedback")
          .upsert(row, { onConflict: "user_id,booking_reference" })
      : await supabase.from("trip_feedback").insert(row);

    // A failed write must never take the confirmation screen down with it: the
    // trip is booked either way, and losing one rating is not worth showing an
    // error to someone who just paid.
    if (error) {
      console.error("Trip feedback not saved", error);
      return { saved: false };
    }
    return { saved: true };
  });
