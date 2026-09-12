/**
 * Getaway pictures. One picture per proposal — never a carousel. WebP with a
 * JPEG fallback, explicit dimensions so nothing shifts as it arrives, and a
 * subtle scrim rather than a heavy overlay so the type stays readable.
 * No Ken Burns, no parallax: nothing here moves.
 */
import type { GetawayImage } from "@/lib/getaway/images";

function Picture({
  image,
  className,
  width,
  height,
  alt,
  eager,
}: {
  image: GetawayImage;
  className: string;
  width: number;
  height: number;
  alt: string;
  eager?: boolean;
}) {
  return (
    <picture>
      <source srcSet={image.url} type="image/webp" />
      <img
        src={image.fallbackUrl ?? image.url}
        alt={alt}
        width={width}
        height={height}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        className={className}
      />
    </picture>
  );
}

function Credit({ image, className }: { image: GetawayImage; className: string }) {
  if (!image.credit) return null;
  return (
    <p className={className}>
      {image.creditUrl ? (
        <a href={image.creditUrl} target="_blank" rel="noreferrer noopener" className="hover:underline">
          {image.credit}
        </a>
      ) : (
        image.credit
      )}
    </p>
  );
}

/**
 * The top of /getaway: the picture leads, the name and theme sit on it. With no
 * picture the same block renders as a calm typographic header.
 */
export function GetawayHero({
  image,
  title,
  subtitle,
}: {
  image: GetawayImage | null;
  title: string;
  subtitle: string;
}) {
  if (!image) {
    return (
      <header className="border-b border-border bg-secondary/40 px-6 py-14 sm:py-20">
        <div className="mx-auto max-w-3xl">
          <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-6xl">{title}</h1>
          <p className="mt-3 text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </header>
    );
  }

  return (
    <header className="relative isolate overflow-hidden bg-secondary">
      <Picture
        image={image}
        alt={title}
        width={1600}
        height={900}
        eager
        className="h-[46vh] min-h-64 w-full object-cover sm:h-[56vh]"
      />
      {/* Scrim only where the type sits, so the photograph stays a photograph. */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 top-1/3 bg-gradient-to-t from-black/70 via-black/35 to-transparent"
      />
      <div className="absolute inset-x-0 bottom-0 px-6 pb-7 sm:pb-10">
        <div className="mx-auto max-w-3xl">
          <h1 className="font-display text-4xl font-semibold tracking-tight text-white drop-shadow-sm sm:text-6xl">
            {title}
          </h1>
          <p className="mt-2 text-sm text-white/85">{subtitle}</p>
        </div>
      </div>
      <div className="absolute right-3 top-3">
        <Credit
          image={image}
          className="rounded-full bg-black/45 px-2.5 py-1 text-[10px] text-white/85"
        />
      </div>
    </header>
  );
}

/** Small picture beside an itinerary day. Optional by design. */
export function GetawayDayImage({ image, alt }: { image: GetawayImage; alt: string }) {
  return (
    <div className="shrink-0">
      <Picture
        image={image}
        alt={alt}
        width={160}
        height={120}
        className="h-20 w-28 rounded-xl border border-border object-cover sm:h-24 sm:w-32"
      />
      <Credit image={image} className="mt-1 w-28 text-[10px] text-muted-foreground sm:w-32" />
    </div>
  );
}
