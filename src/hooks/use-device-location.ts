/**
 * Asking the browser where the traveller is — once, for one answer.
 *
 * Nothing is cached and nothing is stored. If the browser itself is blocking
 * location, we say so and explain how to turn it back on, rather than failing
 * quietly and pretending we simply do not know.
 */
import { useCallback, useState } from "react";

export type DeviceLocationOutcome =
  | { status: "granted"; lat: number; lon: number }
  | { status: "denied" }
  | { status: "blocked" }
  | { status: "unavailable" };

export function useDeviceLocation() {
  const [pending, setPending] = useState(false);

  const request = useCallback(async (): Promise<DeviceLocationOutcome> => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      return { status: "unavailable" };
    }

    // On a PWA the browser remembers a refusal per device; a blocked site never
    // shows the prompt again, so we detect it and explain instead.
    try {
      const permissions = (navigator as Navigator & { permissions?: Permissions }).permissions;
      const state = await permissions?.query({ name: "geolocation" as PermissionName });
      if (state?.state === "denied") return { status: "blocked" };
    } catch {
      // Permissions API is not everywhere; falling through to the prompt is fine.
    }

    setPending(true);
    try {
      return await new Promise<DeviceLocationOutcome>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (position) =>
            resolve({
              status: "granted",
              lat: position.coords.latitude,
              lon: position.coords.longitude,
            }),
          (error) =>
            resolve(error.code === error.PERMISSION_DENIED ? { status: "denied" } : { status: "unavailable" }),
          { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
        );
      });
    } finally {
      setPending(false);
    }
  }, []);

  return { request, pending };
}
