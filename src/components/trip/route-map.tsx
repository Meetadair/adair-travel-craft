/**
 * The route on a map: every stop numbered, joined in travel order.
 *
 * Separate from the trip map, which answers "how far is that from my hotel".
 * This one answers "what shape is this week" — so the line between stops is the
 * point, and nothing else is drawn on it.
 */
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

export type RouteStop = {
  city: string;
  nights: number;
  lat: number;
  lon: number;
};

export default function RouteMap({ stops }: { stops: RouteStop[] }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = container.current;
    if (!node || stops.length === 0) return;
    let disposed = false;
    let cleanup: (() => void) | undefined;

    void (async () => {
      const L = await import("leaflet");
      if (disposed || !container.current) return;

      const map = L.map(node, { scrollWheelZoom: false, attributionControl: true });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: "© OpenStreetMap contributors",
      }).addTo(map);

      const latlngs = stops.map((stop) => [stop.lat, stop.lon] as [number, number]);

      // The line first, so the numbers sit on top of it.
      if (latlngs.length > 1) {
        L.polyline(latlngs, { color: "#E8623F", weight: 2, dashArray: "6 6" }).addTo(map);
      }

      stops.forEach((stop, index) => {
        L.marker([stop.lat, stop.lon], {
          title: stop.city,
          icon: L.divIcon({
            className: "",
            html: `<span style="display:flex;width:26px;height:26px;align-items:center;justify-content:center;border-radius:9999px;background:#E8623F;color:#FBF8F2;font:600 12px/1 system-ui;box-shadow:0 1px 4px rgba(0,0,0,.25)">${index + 1}</span>`,
            iconSize: [26, 26],
            iconAnchor: [13, 13],
          }),
        })
          .addTo(map)
          .bindPopup(
            `<strong>${stop.city}</strong><br>${stop.nights} ${stop.nights === 1 ? "night" : "nights"}`,
          );
      });

      if (latlngs.length > 1) map.fitBounds(L.latLngBounds(latlngs).pad(0.2));
      else map.setView(latlngs[0]!, 10);

      cleanup = () => map.remove();
    })();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [stops]);

  if (stops.length === 0) return null;

  return (
    <div
      ref={container}
      className="h-64 w-full overflow-hidden rounded-xl border border-border sm:h-80"
      role="application"
      aria-label="Map of the route"
    />
  );
}
