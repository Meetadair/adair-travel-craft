import { useState } from "react";

import {
  FEEDBACK_COPY,
  feedbackOptions,
  needsFollowUp,
  type FeedbackCopy,
  type FeedbackKey,
} from "@/lib/trip/feedback";

/**
 * The last thing on the confirmation screen: whether the trip we just booked is
 * the trip they wanted.
 *
 * Asked here rather than by email a week later, because this is the moment the
 * traveller is still looking at what we chose for them and can say why. One tap
 * is a complete answer; the box for their own words appears only after the tap,
 * so the question never looks like a form.
 */
export function TripFeedback({
  copy,
  onSubmit,
  className = "",
}: {
  copy?: Partial<FeedbackCopy>;
  onSubmit: (answer: { rating: FeedbackKey; comment: string | null }) => void;
  className?: string;
}) {
  const text: FeedbackCopy = { ...FEEDBACK_COPY, ...(copy ?? {}) };
  const [rating, setRating] = useState<FeedbackKey | null>(null);
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState(false);

  // The rating is sent the moment it is tapped. Waiting for the comment box
  // would mean losing every answer from someone who rates the trip and closes
  // the tab, which is most of them.
  const choose = (key: FeedbackKey) => {
    setRating(key);
    onSubmit({ rating: key, comment: null });
  };

  const send = () => {
    if (!rating) return;
    onSubmit({ rating, comment: comment.trim() || null });
    setSent(true);
  };

  if (sent && rating) {
    return (
      <div className={`border-t border-border pt-4 ${className}`}>
        <p className="text-sm text-muted-foreground">
          {needsFollowUp(rating) ? text.thanksPoor : text.thanks}
        </p>
      </div>
    );
  }

  return (
    <div className={`border-t border-border pt-4 ${className}`}>
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {text.question}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {feedbackOptions(text).map((option) => (
          <button
            key={option.key}
            type="button"
            aria-pressed={rating === option.key}
            onClick={() => choose(option.key)}
            className={
              rating === option.key
                ? "rounded-lg border border-primary bg-primary/5 px-3 py-1.5 text-xs text-foreground"
                : "rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground transition-colors hover:border-primary/40"
            }
          >
            {option.label}
          </button>
        ))}
      </div>

      {rating && (
        <div className="mt-4">
          <label htmlFor="trip-feedback-comment" className="text-sm text-muted-foreground">
            {text.commentPrompt}
          </label>
          <textarea
            id="trip-feedback-comment"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={2}
            maxLength={2000}
            placeholder={text.commentPlaceholder}
            className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-primary/60"
          />
          <button
            type="button"
            onClick={send}
            className="mt-2 rounded-lg border border-border px-3 py-1.5 text-xs text-foreground hover:border-primary/40"
          >
            {text.send}
          </button>
        </div>
      )}
    </div>
  );
}
