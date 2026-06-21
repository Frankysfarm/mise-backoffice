'use client';

import { useEffect, useState } from 'react';
import { Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';

type Stop = {
  id: string;
  order_id: string;
  reihenfolge: number;
  angekommen_am: string | null;
  geliefert_am: string | null;
  order: {
    id: string;
    bestellnummer: string;
    kunde_name: string;
    kunde_adresse: string | null;
    kunde_plz: string | null;
    kunde_lat: number | null;
    kunde_lng: number | null;
    gesamtbetrag: number;
    zahlungsart?: string | null;
    bezahlt?: boolean | null;
    eta_earliest?: string | null;
  };
};

interface Props {
  stops: Stop[];
  driverPos: { lat: number; lng: number } | null;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function computeBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const rlat1 = lat1 * Math.PI / 180;
  const rlat2 = lat2 * Math.PI / 180;
  const y = Math.sin(dLng) * Math.cos(rlat2);
  const x = Math.cos(rlat1) * Math.sin(rlat2) - Math.sin(rlat1) * Math.cos(rlat2) * Math.cos(dLng);
  const bearing = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  return bearing;
}

function bearingToLabel(bearing: number): string {
  const labels = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
  const idx = Math.round(bearing / 45) % 8;
  return labels[idx];
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

export function TourGPSNavigator({ stops, driverPos }: Props) {
  const [, setT] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setT(n => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const nextStop = stops
    .filter(s => !s.geliefert_am)
    .sort((a, b) => a.reihenfolge - b.reihenfolge)[0];

  if (!nextStop) return null;

  const order = nextStop.order;
  const hasGps = driverPos !== null && order.kunde_lat !== null && order.kunde_lng !== null;

  let distKm: number | null = null;
  let bearing: number | null = null;
  let bearingLabel: string | null = null;
  let isNear = false;

  if (hasGps && driverPos && order.kunde_lat !== null && order.kunde_lng !== null) {
    distKm = haversineKm(driverPos.lat, driverPos.lng, order.kunde_lat, order.kunde_lng);
    bearing = computeBearing(driverPos.lat, driverPos.lng, order.kunde_lat, order.kunde_lng);
    bearingLabel = bearingToLabel(bearing);
    isNear = distKm < 0.15;
  }

  const address = [order.kunde_adresse, order.kunde_plz].filter(Boolean).join(', ');
  const mapsUrl = (order.kunde_lat !== null && order.kunde_lng !== null)
    ? `https://maps.google.com/maps?daddr=${order.kunde_lat},${order.kunde_lng}`
    : `https://maps.google.com/maps?daddr=${encodeURIComponent(address)}`;
  const wazeUrl = (order.kunde_lat !== null && order.kunde_lng !== null)
    ? `https://waze.com/ul?ll=${order.kunde_lat},${order.kunde_lng}&navigate=yes`
    : `https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`;

  return (
    <div className="rounded-xl bg-matcha-900 border border-matcha-700 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Navigation className="h-5 w-5 text-[#4AE68A]" />
        <span className="font-bold text-matcha-50 text-sm">GPS Navigator</span>
        {isNear && (
          <span className="ml-auto text-xs font-bold text-green-400 animate-pulse bg-green-950/60 rounded-full px-2 py-0.5">
            Fast da!
          </span>
        )}
      </div>

      {/* Next stop info */}
      <div>
        <div className="text-sm font-bold text-matcha-100">{order.kunde_name}</div>
        {address && <div className="text-xs text-matcha-400">{address}</div>}
      </div>

      {/* Distance + Direction */}
      {hasGps && distKm !== null && bearing !== null && (
        <div className="flex items-center gap-4">
          <div className="text-2xl font-black text-matcha-50">
            {formatDistance(distKm)}
          </div>
          <div className="flex flex-col items-center">
            {/* Compass arrow */}
            <div
              className="h-8 w-8 flex items-center justify-center"
              style={{ transform: `rotate(${bearing}deg)` }}
            >
              <svg viewBox="0 0 24 24" className="h-7 w-7 fill-[#4AE68A]">
                <path d="M12 2L8 20l4-3 4 3z" />
              </svg>
            </div>
            <span className="text-[10px] text-matcha-400 font-bold">{bearingLabel}</span>
          </div>
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex gap-2">
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-[#4AE68A] text-matcha-900 font-bold text-sm py-2.5 px-3"
        >
          <Navigation className="h-4 w-4" />
          Google Maps
        </a>
        <a
          href={wazeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-matcha-700 text-matcha-100 font-bold text-sm py-2.5 px-3"
        >
          Waze
        </a>
      </div>
    </div>
  );
}
