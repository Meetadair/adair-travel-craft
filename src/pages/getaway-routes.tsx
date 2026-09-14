/**
 * Routes — journeys you browse by reason to go, not by destination.
 *
 * The index is the shop window: a route is chosen because someone wants
 * mountains, or water, or a week of wine, long before they have picked a
 * country. The detail page reads day by day, with the drive between stops
 * stated plainly so nobody discovers on day three that it is four hours.
 *
 * Rendered from the published route data. Where they sleep is not on this
 * page: "Plan this route" hands the whole sequence to the assistant, which
 * searches real availability for their dates.
 */
import { lazy, Suspense, useMemo, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";
import { MapPin, Moon, Car, ArrowRight } from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import { AppFooter } from "@/components/app-footer";
import { ASSISTANT_PREFILL_KEY } from "@/lib/trips/prefill";
import { GetawayDayImage, GetawayHero } from "@/components/getaway-image";
import { localeHref, useLocale } from "@/lib/i18n";
import {
  ROUTE_THEMES,
  SEED_ROUTES,
  drivingKmOf,
  drivingMinutesOf,
  stopSummary,
  stopsOf,
  themeLabel,
  type SeedRoute,
} from "@/lib/getaway/routes";
import { routeShape } from "@/lib/getaway/route-shape";

const RouteMap = lazy(() => import("@/components/trip/route-map"));

function hours(minutes: number): string {
  const h = Math.round(minutes / 60);
  return h <= 1 ? "about an hour" : `about ${h} hours`;
}

function Meta({ route }: { route: SeedRoute }) {
  const driving = drivingMinutesOf(route.days);
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <MapPin className="size-3.5" />
        {stopsOf(route.days)} stops
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Moon className="size-3.5" />
        {route.nights} nights
      </span>
      {driving > 0 && (
        <span className="inline-flex items-center gap-1.5">
          <Car className="size-3.5" />
          {drivingKmOf(route.days).toLocaleString("en-GB")} km · {hours(driving)}
        </span>
      )}
    </p>
  );
}

export function RoutesIndexPage() {
  const [theme, setTheme] = useState<string | null>(null);

  const shown = useMemo(
    () => (theme ? SEED_ROUTES.filter((route) => route.themes.includes(theme)) : SEED_ROUTES),
    [theme],
  );

  // Only offer filters that would actually return something.
  const available = ROUTE_THEMES.filter((candidate) =>
    SEED_ROUTES.some((route) => route.themes.includes(candidate.id)),
  );

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="font-display text-4xl font-semibold tracking-tight">
          {SEED_ROUTES.length} routes, chosen by reason to go
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Journeys between places worth stopping in, written day by day. Pick one and Adair plans it
          around your dates.
        </p>

        <div className="mt-8 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTheme(null)}
            className={theme === null ? "tag-pill bg-secondary" : "tag-pill hover:bg-secondary"}
          >
            Everything
          </button>
          {available.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              onClick={() => setTheme(candidate.id)}
              className={
                theme === candidate.id ? "tag-pill bg-secondary" : "tag-pill hover:bg-secondary"
              }
            >
              {candidate.label}
            </button>
          ))}
        </div>

        <div className="mt-8 space-y-4">
          {shown.map((route) => (
            <Link
              key={route.slug}
              to="/getaway/routes/$slug"
              params={{ slug: route.slug }}
              className="hairline-card block p-5 transition-colors hover:bg-secondary/40 sm:p-6"
            >
              <h2 className="font-display text-xl font-semibold tracking-tight">{route.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{route.summary}</p>
              <div className="mt-3">
                <Meta route={route} />
              </div>
              <p className="mt-3 flex flex-wrap gap-2">
                {route.themes.map((id) => (
                  <span key={id} className="tag-pill text-xs">
                    {themeLabel(id)}
                  </span>
                ))}
              </p>
            </Link>
          ))}
        </div>

        {shown.length === 0 && (
          <p className="mt-8 text-sm text-muted-foreground">
            Nothing under that heading yet. Try another.
          </p>
        )}
      </main>
      <AppFooter />
    </div>
  );
}

/**
 * The route at a glance, drawn to scale.
 *
 * The dots sit where the places actually are, so a long leg looks long. An
 * evenly spaced bar would be tidier and would say nothing true about the week.
 */
function StopLine({ route }: { route: SeedRoute }) {
  const stops = stopSummary(route.days).map((stop) => {
    const day = route.days.find((candidate) => candidate.city === stop.city)!;
    return {
      city: stop.city,
      nights: stop.nights,
      latitude: day.latitude,
      longitude: day.longitude,
    };
  });

  const shape = routeShape(stops, { width: 640, padding: 40, minHeight: 150, maxHeight: 360 });
  if (!shape) return null;

  return (
    <figure className="mt-6">
      <svg
        viewBox={`0 0 ${shape.width} ${shape.height}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Route shape: ${stops.map((stop) => stop.city).join(", ")}`}
      >
        <path
          d={shape.path}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="5 5"
          className="text-border"
        />
        {shape.points.map((point, index) => (
          <g key={`${point.city}-${index}`}>
            <circle
              cx={point.x}
              cy={point.y}
              r={index === 0 || index === shape.points.length - 1 ? 6 : 5}
              className="fill-primary"
              stroke="currentColor"
              strokeWidth="2"
              style={{ color: "var(--background)" }}
            />
            <text
              x={point.x}
              y={point.labelBelow ? point.y + 22 : point.y - 14}
              textAnchor="middle"
              className="fill-current text-[13px]"
            >
              {point.city}
            </text>
            <text
              x={point.x}
              y={point.labelBelow ? point.y + 36 : point.y}
              textAnchor="middle"
              className="fill-current text-[11px] text-muted-foreground opacity-70"
            >
              {point.nights} {point.nights === 1 ? "night" : "nights"}
            </text>
          </g>
        ))}
      </svg>
      <figcaption className="sr-only">
        Stops drawn to scale — the spacing matches the real distance between them.
      </figcaption>
    </figure>
  );
}

/** One thing to do, as a card rather than a line in a list. */
function DoCard({ label, text }: { label: string; text: string }) {
  return (
    <div className="hairline-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm leading-relaxed">{text}</p>
    </div>
  );
}

export function RouteDetailPage({ slug }: { slug: string }) {
  const navigate = useNavigate();
  const locale = useLocale();
  const route = SEED_ROUTES.find((candidate) => candidate.slug === slug);

  if (!route) {
    return (
      <div className="min-h-screen bg-background">
        <SiteNav />
        <main className="mx-auto max-w-3xl px-6 py-16">
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            That route isn't here
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            It may have been renamed.{" "}
            <Link to="/getaway/routes" className="underline underline-offset-4">
              See all routes
            </Link>
            .
          </p>
        </main>
        <AppFooter />
      </div>
    );
  }

  /** Hands the whole sequence to the assistant, which searches real dates. */
  const plan = () => {
    const towns = [...new Set(route.days.map((day) => day.city))].join(", ");
    try {
      window.localStorage.setItem(
        ASSISTANT_PREFILL_KEY,
        `${route.nights} nights: ${towns}. ${route.title}.`,
      );
    } catch {
      /* private browsing — the assistant simply starts empty */
    }
    navigate({ href: localeHref(locale, "/assistant") });
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      {route.hero && (
        <GetawayHero
          image={route.hero}
          title={route.title}
          subtitle={route.countries.join(" · ")}
        />
      )}
      <main className="mx-auto max-w-3xl px-6 py-16">
        {!route.hero && (
          <>
            <p className="text-sm text-muted-foreground">{route.countries.join(" · ")}</p>
            <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">
              {route.title}
            </h1>
          </>
        )}
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
          {route.summary}
        </p>
        <div className="mt-4">
          <Meta route={route} />
        </div>
        <p className="mt-3 text-sm text-muted-foreground">Best time: {route.season}</p>

        <StopLine route={route} />

        <div className="mt-6">
          <ClientOnly fallback={<div className="h-64 w-full rounded-xl border border-border" />}>
            <Suspense fallback={<div className="h-64 w-full rounded-xl border border-border" />}>
              <RouteMap
                stops={stopSummary(route.days).map((stop) => {
                  const day = route.days.find((candidate) => candidate.city === stop.city)!;
                  return {
                    city: stop.city,
                    nights: stop.nights,
                    lat: day.latitude,
                    lon: day.longitude,
                  };
                })}
              />
            </Suspense>
          </ClientOnly>
        </div>

        <button
          type="button"
          onClick={plan}
          className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Plan this route <ArrowRight className="size-4" />
        </button>

        <ol className="mt-10 space-y-8">
          {route.days.map((day) => (
            <li key={day.dayNumber}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-display text-lg font-semibold">
                  Day {day.dayNumber} · {day.city}
                </h2>
                {day.driveMinutes && (
                  <span className="text-sm text-muted-foreground">
                    {day.driveKm ? `${day.driveKm} km · ` : ""}
                    {day.driveMinutes < 60
                      ? `${day.driveMinutes} min`
                      : `${Math.round((day.driveMinutes / 60) * 10) / 10} h`}
                  </span>
                )}
              </div>

              {day.travelNote && (
                <p className="mt-2 text-sm italic leading-relaxed text-muted-foreground">
                  {day.travelNote}
                </p>
              )}

              {day.image && (
                <div className="mt-4">
                  <GetawayDayImage image={day.image} alt={`${day.city}, day ${day.dayNumber}`} />
                </div>
              )}

              {day.onTheRoad && (
                <div className="mt-4">
                  <DoCard label="On the road" text={day.onTheRoad} />
                </div>
              )}

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {day.morning && <DoCard label="Morning" text={day.morning} />}
                {day.afternoon && <DoCard label="Afternoon" text={day.afternoon} />}
                {day.evening && <DoCard label="Evening" text={day.evening} />}
              </div>
            </li>
          ))}
        </ol>

        <p className="mt-8 text-sm leading-relaxed text-muted-foreground">
          Where you sleep isn't fixed here — we search what's actually available for your dates when
          you plan the route.
        </p>

        <p className="mt-8 text-sm">
          <Link
            to="/getaway/routes"
            className="underline decoration-border underline-offset-4 hover:text-foreground"
          >
            All routes
          </Link>
        </p>
      </main>
      <AppFooter />
    </div>
  );
}
