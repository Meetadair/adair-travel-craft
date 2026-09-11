/** Browser-only Leaflet map: a numbered pin per stop, joined in travel order. */
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { TripStop } from "@/lib/trip/types";

export default function TripMapLeaflet({ stops }: { stops: TripStop[] }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = container.current;
    if (!node) return;
    let disposed = false;
    let cleanup: (() => void) | undefined;

    void (async () => {
      const L = await import("leaflet");
      if (disposed || !container.current) return;

      const points = stops.filter((s) => s.lat !== 0 || s.lon !== 0);
      const map = L.map(node, { scrollWheelZoom: false, attributionControl: true });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: "© OpenStreetMap contributors",
      }).addTo(map);

      const latlngs = points.map((s) => [s.lat, s.lon] as [number, number]);
      points.forEach((stop, index) => {
        L.marker([stop.lat, stop.lon], {
          icon: L.divIcon({
            className: "",
            html: `<span style="display:flex;width:26px;height:26px;align-items:center;justify-content:center;border-radius:9999px;background:#E8623F;color:#FBF8F2;font:600 12px/1 system-ui;box-shadow:0 1px 4px rgba(0,0,0,.25)">${index + 1}</span>`,
            iconSize: [26, 26],
            iconAnchor: [13, 13],
          }),
        })
          .addTo(map)
          .bindPopup(`${index + 1}. ${stop.city} (${stop.iata})`);
      });

      if (latlngs.length > 1) {
        L.polyline(latlngs, { color: "#E8623F", weight: 2, dashArray: "6 6" }).addTo(map);
        map.fitBounds(L.latLngBounds(latlngs).pad(0.2));
      } else if (latlngs.length === 1) {
        map.setView(latlngs[0]!, 9);
      } else {
        map.setView([48.5, 12], 4);
      }

      cleanup = () => map.remove();
    })();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [stops]);

  return (
    <div
      ref={container}
      role="img"
      aria-label="Route map"
      className="h-64 w-full overflow-hidden rounded-xl border border-border sm:h-80"
    />
  );
}
