/**
 * The city map on a booked trip.
 *
 * Browser-only Leaflet. The hotel is the anchor and everything else is measured
 * from it, so the question the map answers is always "how far is that from
 * where I'm sleeping".
 *
 * Map data carries no opening hours and no prices, so neither does this. A pin
 * says where something is, nothing more.
 */
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import { PIN_COLOUR, type MapPin } from "@/lib/trips/map-pins";

const RING: Record<string, string> = {
  hotel: "#FBF8F2",
  meeting: "#FBF8F2",
  eat: "#FBF8F2",
  drink: "#FBF8F2",
  see: "#FBF8F2",
};

function markerHtml(pin: MapPin): string {
  const colour = PIN_COLOUR[pin.kind];
  const size = pin.kind === "hotel" || pin.kind === "meeting" ? 18 : 13;
  return `<span style="display:block;width:${size}px;height:${size}px;border-radius:9999px;background:${colour};border:2px solid ${RING[pin.kind] ?? "#FBF8F2"};box-shadow:0 1px 4px rgba(0,0,0,.3)"></span>`;
}

function popupHtml(pin: MapPin): string {
  const escape = (value: string) =>
    value.replace(/[&<>"]/g, (character) =>
      character === "&"
        ? "&amp;"
        : character === "<"
          ? "&lt;"
          : character === ">"
            ? "&gt;"
            : "&quot;",
    );
  const lines = [`<strong>${escape(pin.name)}</strong>`];
  if (pin.detail) lines.push(escape(pin.detail));
  if (pin.distanceKm !== null) {
    const walk = Math.max(1, Math.round((pin.distanceKm / 4.8) * 60));
    lines.push(
      pin.distanceKm <= 3
        ? `${pin.distanceKm} km from the hotel · about ${walk} min on foot`
        : `${pin.distanceKm} km from the hotel`,
    );
  }
  return lines.join("<br>");
}

export default function TripCityMap({ pins }: { pins: MapPin[] }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = container.current;
    if (!node || pins.length === 0) return;
    let disposed = false;
    let cleanup: (() => void) | undefined;

    void (async () => {
      const L = await import("leaflet");
      if (disposed || !container.current) return;

      const map = L.map(node, { scrollWheelZoom: false, attributionControl: true });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap contributors",
      }).addTo(map);

      for (const pin of pins) {
        L.marker([pin.lat, pin.lon], {
          title: pin.name,
          icon: L.divIcon({
            className: "",
            html: markerHtml(pin),
            iconSize: [18, 18],
            iconAnchor: [9, 9],
          }),
        })
          .addTo(map)
          .bindPopup(popupHtml(pin));
      }

      const latlngs = pins.map((pin) => [pin.lat, pin.lon] as [number, number]);
      if (latlngs.length > 1) map.fitBounds(L.latLngBounds(latlngs).pad(0.15));
      else map.setView(latlngs[0]!, 15);

      cleanup = () => map.remove();
    })();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [pins]);

  if (pins.length === 0) return null;

  return (
    <div
      ref={container}
      className="h-72 w-full overflow-hidden rounded-xl border border-border sm:h-96"
      role="application"
      aria-label="Map of your trip"
    />
  );
}
