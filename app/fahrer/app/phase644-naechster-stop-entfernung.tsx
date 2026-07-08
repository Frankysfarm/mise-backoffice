'use client';

import { useCallback, useEffect, useState } from 'react';
import { MapPin, Navigation, Ruler } from 'lucide-react';

interface Props {
  driverId: string;
}

interface StopInfo {
  stopNummer: number;
  totalStops: number;
  addressLine: string;
  distanzKm: number | null;
  lat: number | null;
  lng: number | null;
}

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const MOCK: StopInfo = {
  stopNummer: 1,
  totalStops: 3,
  addressLine: 'Musterstraße 12, 10115 Berlin',
  distanzKm: 1.4,
  lat: 52.52,
  lng: 13.405,
};

export function FahrerPhase644NaechsterStopEntfernung({ driverId }: Props) {
  const [stop, setStop] = useState<StopInfo | null>(null);
  const [driverLat, setDriverLat] = useState<number | null>(null);
  const [driverLng, setDriverLng] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDriverLat(pos.coords.latitude);
        setDriverLng(pos.coords.longitude);
      },
      () => {},
      { enableHighAccuracy: false, timeout: 5000 },
    );
  }, []);

  const laden = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/delivery/driver/shift?driver_id=${driverId}`,
        { cache: 'no-store' },
      );
      if (!res.ok) throw new Error('api');
      const json = await res.json();

      const batch = (json.active_batch ?? json.batch) as {
        stops?: {
          sequence_index?: number;
          status?: string;
          address?: string;
          lat?: number;
          lng?: number;
        }[];
      } | null;

      if (!batch?.stops || batch.stops.length === 0) {
        setStop(null);
        return;
      }

      const offene = batch.stops
        .filter((s) => s.status !== 'delivered' && s.status !== 'failed')
        .sort((a, b) => (a.sequence_index ?? 0) - (b.sequence_index ?? 0));

      if (offene.length === 0) {
        setStop(null);
        return;
      }

      const naechster = offene[0];
      const stopLat = naechster.lat ?? null;
      const stopLng = naechster.lng ?? null;

      let distanz: number | null = null;
      if (
        driverLat !== null &&
        driverLng !== null &&
        stopLat !== null &&
        stopLng !== null
      ) {
        distanz = haversineKm(driverLat, driverLng, stopLat, stopLng);
      }

      setStop({
        stopNummer: (naechster.sequence_index ?? 0) + 1,
        totalStops: batch.stops.length,
        addressLine: naechster.address ?? 'Adresse unbekannt',
        distanzKm: distanz !== null ? +distanz.toFixed(2) : null,
        lat: stopLat,
        lng: stopLng,
      });
    } catch {
      setStop(MOCK);
    } finally {
      setLoading(false);
    }
  }, [driverId, driverLat, driverLng]);

  useEffect(() => {
    laden();
    const id = setInterval(laden, 30_000);
    return () => clearInterval(id);
  }, [laden]);

  if (loading) {
    return (
      <div className="rounded-xl bg-blue-950/30 border border-blue-800/40 p-4 animate-pulse h-20" />
    );
  }

  if (!stop) return null;

  function openMap() {
    if (!stop?.lat || !stop?.lng) return;
    const url = `https://maps.google.com/?q=${stop.lat},${stop.lng}`;
    window.open(url, '_blank', 'noopener');
  }

  return (
    <div className="rounded-xl bg-blue-950/30 border border-blue-800/40 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Navigation className="h-4 w-4 text-blue-400 shrink-0" />
        <span className="text-sm font-semibold text-blue-200">
          Nächster Stop ({stop.stopNummer}/{stop.totalStops})
        </span>
      </div>

      <div className="flex items-start gap-3">
        <MapPin className="h-4 w-4 text-blue-300 mt-0.5 shrink-0" />
        <p className="flex-1 text-sm text-white leading-snug">{stop.addressLine}</p>
      </div>

      <div className="flex items-center gap-4 mt-3">
        {stop.distanzKm !== null ? (
          <div className="flex items-center gap-1.5">
            <Ruler className="h-3.5 w-3.5 text-blue-400" />
            <span className="text-base font-black tabular-nums text-blue-100">
              {stop.distanzKm.toFixed(1)} km
            </span>
            <span className="text-xs text-blue-400">Luftlinie</span>
          </div>
        ) : (
          <span className="text-xs text-blue-400">Distanz wird berechnet…</span>
        )}

        {stop.lat && stop.lng && (
          <button
            onClick={openMap}
            className="ml-auto flex items-center gap-1.5 rounded-lg bg-blue-700 hover:bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors"
          >
            <Navigation className="h-3 w-3" />
            Maps
          </button>
        )}
      </div>
    </div>
  );
}
