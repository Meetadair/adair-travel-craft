import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import hotel1 from "@/assets/hotel-1.jpg";
import hotel2 from "@/assets/hotel-2.jpg";
import hotel3 from "@/assets/hotel-3.jpg";

const SAMPLE_PHOTOS = [hotel1, hotel2, hotel3];

type Props = {
  /** Provider photos; falls back to sample property photos when empty. */
  images?: string[];
  alt: string;
};

export function HotelGallery({ images, alt }: Props) {
  const photos = images && images.length > 0 ? images : SAMPLE_PHOTOS;
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  const go = (next: number) => {
    const clamped = Math.max(0, Math.min(photos.length - 1, next));
    setIndex(clamped);
    const track = trackRef.current;
    if (track) {
      track.scrollTo({ left: clamped * track.clientWidth, behavior: "smooth" });
    }
  };

  return (
    <div className="relative mt-3 overflow-hidden rounded-xl border border-border">
      <div
        ref={trackRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
        }}
        className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {photos.map((src, i) => (
          <img
            key={src}
            src={src}
            alt={`${alt} — photo ${i + 1}`}
            loading="lazy"
            width={1024}
            height={640}
            className="aspect-[16/10] w-full shrink-0 snap-center object-cover"
          />
        ))}
      </div>

      {photos.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous photo"
            onClick={() => go(index - 1)}
            disabled={index === 0}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full border border-border bg-background/85 p-1.5 backdrop-blur transition-opacity disabled:opacity-0"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Next photo"
            onClick={() => go(index + 1)}
            disabled={index === photos.length - 1}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-border bg-background/85 p-1.5 backdrop-blur transition-opacity disabled:opacity-0"
          >
            <ChevronRight className="size-4" />
          </button>
          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
            {photos.map((src, i) => (
              <button
                key={src}
                type="button"
                aria-label={`Photo ${i + 1}`}
                onClick={() => go(i)}
                className={`size-1.5 rounded-full transition-colors ${
                  i === index ? "bg-primary" : "bg-background/70"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
