/**
 * Picture control for /admin/getaway. Upload the team's own photo (resized in
 * the browser to a sensible width, WebP plus a JPEG fallback and a small email
 * copy), or take one from Unsplash when we have none. Own photo always wins.
 */
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { resizeForGetaway } from "@/lib/getaway/resize";
import {
  clearGetawayImage,
  fetchGetawayStockImage,
  uploadGetawayImage,
} from "@/lib/getaway/upload.functions";

type Target = { kind: "destination" | "day"; id: string };

export function GetawayImageEditor({
  target,
  query,
  imageUrl,
  credit,
  source,
  onChanged,
  compact,
}: {
  target: Target;
  /** What to look for on Unsplash — the destination or day description. */
  query: string;
  imageUrl: string | null;
  credit: string | null;
  source: string | null;
  onChanged: () => void;
  compact?: boolean;
}) {
  const upload = useServerFn(uploadGetawayImage);
  const stock = useServerFn(fetchGetawayStockImage);
  const clear = useServerFn(clearGetawayImage);
  const fileInput = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState<string | null>(null);
  const [creditDraft, setCreditDraft] = useState(credit ?? "");

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const sized = await resizeForGetaway(file);
      return upload({
        data: {
          target,
          webp: sized.webp,
          jpeg: sized.jpeg,
          emailJpeg: sized.emailJpeg,
          credit: creditDraft.trim() || null,
        },
      });
    },
    onSuccess: () => {
      setNote("Photo saved.");
      onChanged();
    },
    onError: (e: Error) => setNote(e.message),
  });

  const stockMutation = useMutation({
    mutationFn: () => stock({ data: { target, query } }),
    onSuccess: (result) => {
      setNote(
        result.ok
          ? `Stock photo added — ${result.credit ?? "credited"}.`
          : "No stock photo available (no key, or nothing matched). The page shows a typographic header instead.",
      );
      onChanged();
    },
    onError: (e: Error) => setNote(e.message),
  });

  const clearMutation = useMutation({
    mutationFn: () => clear({ data: { target } }),
    onSuccess: () => {
      setNote("Picture removed.");
      onChanged();
    },
  });

  const busy = uploadMutation.isPending || stockMutation.isPending || clearMutation.isPending;

  return (
    <div className={compact ? "mt-2" : "mt-3"}>
      <div className="flex flex-wrap items-start gap-3">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            width={160}
            height={100}
            loading="lazy"
            className="h-20 w-28 rounded-xl border border-border object-cover"
          />
        ) : (
          <p className="text-xs text-muted-foreground">
            No picture yet — the page shows the name in type instead.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadMutation.mutate(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
            className="min-h-9 rounded-lg border border-border px-3 py-1.5 text-xs disabled:opacity-50"
          >
            {uploadMutation.isPending ? "Uploading…" : "Upload own photo"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => stockMutation.mutate()}
            className="min-h-9 rounded-lg border border-border px-3 py-1.5 text-xs disabled:opacity-50"
          >
            {stockMutation.isPending ? "Looking…" : "Use a stock photo"}
          </button>
          {imageUrl && (
            <button
              type="button"
              disabled={busy}
              onClick={() => clearMutation.mutate()}
              className="min-h-9 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground disabled:opacity-50"
            >
              Remove
            </button>
          )}
        </div>
      </div>

      <label className="mt-2 block">
        <span className="text-xs font-medium text-muted-foreground">
          Credit line for our own photo — optional
        </span>
        <input
          value={creditDraft}
          onChange={(e) => setCreditDraft(e.target.value)}
          placeholder="Photo: Adair, March 2026"
          className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
      </label>

      {source === "unsplash" && (
        <p className="mt-1 text-xs text-muted-foreground">
          Stock photo, credited as required. Uploading our own replaces it.
        </p>
      )}
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}
