/**
 * lib/delivery/tour-direction.ts
 *
 * Richtungs-/Nähe-Regel für die Touren-Bündelung.
 * Selbes Restaurant allein reicht nicht: das neue Ziel muss nah an einem
 * bestehenden Ziel liegen ODER in derselben Fahrtrichtung vom Restaurant aus.
 * (Livefall 12.08.2026: Vaalser-Str.-Ziel landete in einer Trierer/Eilendorf-Tour.)
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export const MAX_DROPOFF_SPREAD_KM = 2.5;
export const MAX_HEADING_DIFF_DEG = 50;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineKmPure(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Kompass-Kurs vom Startpunkt zum Ziel in Grad (0–360). */
export function bearingDeg(from: LatLng, to: LatLng): number {
  const dLng = toRad(to.lng - from.lng);
  const y = Math.sin(dLng) * Math.cos(toRad(to.lat));
  const x =
    Math.cos(toRad(from.lat)) * Math.sin(toRad(to.lat)) -
    Math.sin(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function headingDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

export interface TourFitResult {
  fits: boolean;
  reason: string;
}

/**
 * Passt das neue Ziel zur bestehenden Tour?
 * - Leere Tour: immer ja (Seed).
 * - Nah an einem bestehenden Ziel (< MAX_DROPOFF_SPREAD_KM): ja.
 * - Gleiche Richtung vom Restaurant wie ALLE bestehenden Ziele (≤ MAX_HEADING_DIFF_DEG): ja.
 * - Sonst: nein.
 */
export function dropoffFitsTour(
  restaurant: LatLng,
  existingDropoffs: LatLng[],
  candidate: LatLng,
): TourFitResult {
  if (existingDropoffs.length === 0) {
    return { fits: true, reason: 'Erste Bestellung der Tour' };
  }

  const near = existingDropoffs.find(
    (d) => haversineKmPure(d, candidate) < MAX_DROPOFF_SPREAD_KM,
  );
  if (near) {
    return { fits: true, reason: `Ziel < ${MAX_DROPOFF_SPREAD_KM} km an bestehendem Stopp` };
  }

  const candidateHeading = bearingDeg(restaurant, candidate);
  const allSameDirection = existingDropoffs.every(
    (d) => headingDiff(bearingDeg(restaurant, d), candidateHeading) <= MAX_HEADING_DIFF_DEG,
  );
  if (allSameDirection) {
    return { fits: true, reason: `Gleiche Richtung (≤ ${MAX_HEADING_DIFF_DEG}°)` };
  }

  return { fits: false, reason: 'Ziel liegt in anderer Richtung — eigene Tour' };
}
