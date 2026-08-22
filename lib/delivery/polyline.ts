/**
 * lib/delivery/polyline.ts
 *
 * Google Encoded Polyline decoder (Precision 5).
 * https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 *
 * Used to turn the `polyline` field stored in mise_delivery_batches
 * into an array of lat/lng pairs for map display.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Decodes a Google-encoded polyline string into an array of lat/lng points.
 * Returns an empty array for null/empty input.
 */
export function decodePolyline(encoded: string | null | undefined): LatLng[] {
  if (!encoded) return [];

  const result: LatLng[] = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b: number;
    let shift = 0;
    let result_val = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result_val |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlat = result_val & 1 ? ~(result_val >> 1) : result_val >> 1;
    lat += dlat;

    shift = 0;
    result_val = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result_val |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlng = result_val & 1 ? ~(result_val >> 1) : result_val >> 1;
    lng += dlng;

    result.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return result;
}

/**
 * Encodes an array of lat/lng points into a Google polyline string.
 * Used for testing and for constructing Static Map URLs.
 */
export function encodePolyline(points: LatLng[]): string {
  let prevLat = 0;
  let prevLng = 0;
  let output = '';

  for (const { lat, lng } of points) {
    output += encodeValue(Math.round(lat * 1e5) - prevLat);
    output += encodeValue(Math.round(lng * 1e5) - prevLng);
    prevLat = Math.round(lat * 1e5);
    prevLng = Math.round(lng * 1e5);
  }

  return output;
}

function encodeValue(value: number): string {
  let v = value < 0 ? ~(value << 1) : value << 1;
  let result = '';
  while (v >= 0x20) {
    result += String.fromCharCode(((0x20 | (v & 0x1f)) + 63));
    v >>= 5;
  }
  result += String.fromCharCode(v + 63);
  return result;
}
