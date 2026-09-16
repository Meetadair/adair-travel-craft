/**
 * "Shopping near your hotel" — public map data around the hotel. No prices,
 * no stock, no guarantee a place is still open; we say so at the bottom.
 */
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, MapPin, ShoppingBag } from "lucide-react";
import { getTripShopping, type TripShopping } from "@/lib/trip-shopping.functions";
import { SHOP_CATEGORY_LABEL } from "@/lib/shopping/types";

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
      {children}
    </span>
  );
}

export function TripShoppingSection({ tripId }: { tripId: string }) {
  const load = useServerFn(getTripShopping);
  const [data, setData] = useState<TripShopping | null>(null);

  useEffect(() => {
    let active = true;
    void load({ data: { tripId } })
      .then((result) => {
        if (active) setData(result);
      })
      .catch(() => {
        if (active) setData(null);
      });
    return () => {
      active = false;
    };
  }, [tripId, load]);

  if (!data || !data.any) return null;

  return (
    <div className="border-t border-border px-5 py-4">
      <div className="flex items-center gap-2">
        <ShoppingBag className="size-3.5 text-primary" />
        <h4 className="text-sm font-medium">Shopping near your hotel</h4>
      </div>

      <ul className="mt-4 space-y-3">
        {data.shops.map((shop) => (
          <li key={shop.id} className="text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-foreground">{shop.name}</span>
              <Chip>{SHOP_CATEGORY_LABEL[shop.category]}</Chip>
            </div>
            <p className="mt-1 leading-relaxed text-muted-foreground">
              {shop.distanceKm != null ? `${shop.distanceKm} km from your hotel` : null}
              {shop.address ? ` · ${shop.address}` : ""}
              {shop.openingHours ? ` · ${shop.openingHours}` : ""}
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              {shop.website ? (
                <a
                  href={shop.website}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-xl border border-border px-2.5 py-1.5 hover:border-primary"
                >
                  <ExternalLink className="size-3.5" />
                  Website
                </a>
              ) : null}
              <a
                href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(shop.name)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-xl border border-border px-2.5 py-1.5 hover:border-primary"
              >
                <MapPin className="size-3.5" />
                Open in maps
              </a>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] text-muted-foreground">
        {data.attribution} — hours and opening status can change; check before you go.
      </p>
    </div>
  );
}
