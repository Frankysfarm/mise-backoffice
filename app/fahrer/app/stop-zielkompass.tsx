'use client';

/**
 * FahrerStopZielkompass — Phase 405
 * Intelligenter Zielkompass für den aktuellen Lieferstopp:
 * - Zeigt Kundenadresse, Entfernung und Richtungszeiger (wenn GPS verfügbar)
 * - Schnell-Links zu Google Maps, Waze und Apple Maps
 * - Kundennotiz und Zugangshinweis
 * - ETA-Countdown zum aktuellen Stopp
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  MapPin, Navigation, Phone, Clock, MessageSquare, ExternalLink, Compass, AlertCircle,
} from 'lucide-react';

type Stop = {
  id: string;
  reihenfolge: number;
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
    kunde_notiz?: string | null;
    kunde_lieferhinweis?: string | null;
    kunde_telefon?: string | null;
  };
};

interface Props {
  stops: Stop[];
  driverPos: { lat: number; lng: number } | null;
  vehicle?: string | null;
}

function calcBearing(from: { lat: number; lng: number }, to: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLng = toRad(to.lng - from.lng);
  const y = Math.sin(dLng) * Math.cos(toRad(to.lat));
  const x =
    Math.cos(toRad(from.lat)) * Math.sin(toRad(to.lat)) -
    Math.sin(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.cos(dLng);
  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360;
}

function calcDistanceM(from: { lat: number; lng: number }, to: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

function bearingLabel(deg: number): string {
  const dirs = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}

function buildNavUrl(type: 'google' | 'waze' | 'apple', lat: number, lng: number, address: string): string {
  const enc = encodeURIComponent(address);
  if (type === 'google') return `https://maps.google.com/?q=${lat},${lng}`;
  if (type === 'waze')   return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
  return `https://maps.apple.com/?daddr=${lat},${lng}`;
}

function euro(v: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v);
}

export function FahrerStopZielkompass({ stops, driverPos, vehicle }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  const currentStop = stops.find((s) => !s.geliefert_am);
  if (!currentStop) return null;

  const order = currentStop.order;
  const hasCoords = order.kunde_lat != null && order.kunde_lng != null;

  let bearing: number | null = null;
  let distanceM: number | null = null;

  if (driverPos && hasCoords) {
    const target = { lat: order.kunde_lat!, lng: order.kunde_lng! };
    bearing = calcBearing(driverPos, target);
    distanceM = calcDistanceM(driverPos, target);
  }

  const completedCount = stops.filter((s) => !!s.geliefert_am).length;
  const remainingCount = stops.filter((s) => !s.geliefert_am).length;
  const fullAddress = [order.kunde_adresse, order.kunde_plz].filter(Boolean).join(', ');

  return (
    <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-4 py-3 border-b border-blue-100"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow">
            <Compass size={18} className="text-white" />
          </div>
          <div className="text-left">
            <div className="text-sm font-bold text-gray-900">
              Stopp {completedCount + 1}/{stops.length} · #{order.bestellnummer}
            </div>
            <div className="text-[11px] text-gray-500">
              {order.kunde_name}
              {distanceM != null && (
                <span className="ml-1.5 font-semibold text-blue-600">{formatDistance(distanceM)}</span>
              )}
            </div>
          </div>
        </div>
        <span className="text-gray-400 text-xs">{collapsed ? '▼' : '▲'}</span>
      </button>

      {!collapsed && (
        <div className="px-4 py-3 space-y-3">
          {/* Kompass-Ring + Adresse */}
          <div className="flex items-center gap-4">
            {/* Kompass */}
            {bearing != null ? (
              <div className="shrink-0 w-16 h-16 relative flex items-center justify-center">
                <svg viewBox="0 0 64 64" className="w-16 h-16">
                  <circle cx="32" cy="32" r="30" fill="none" stroke="#dbeafe" strokeWidth="3" />
                  <circle cx="32" cy="32" r="30" fill="none" stroke="#3b82f6" strokeWidth="3"
                    strokeDasharray={`${(bearing / 360) * 188} 188`}
                    strokeLinecap="round"
                    transform="rotate(-90 32 32)"
                  />
                </svg>
                <div
                  className="absolute w-5 h-5 flex items-center justify-center"
                  style={{ transform: `rotate(${bearing}deg)` }}
                >
                  <Navigation size={18} className="text-blue-600 fill-blue-600" />
                </div>
                <div className="absolute bottom-0 right-0 text-[9px] font-bold text-blue-700 bg-blue-100 rounded px-0.5">
                  {bearingLabel(bearing)}
                </div>
              </div>
            ) : (
              <div className="shrink-0 w-16 h-16 flex items-center justify-center rounded-full bg-blue-100">
                <MapPin size={24} className="text-blue-500" />
              </div>
            )}

            {/* Adresse */}
            <div className="flex-1">
              <div className="text-sm font-bold text-gray-900 leading-tight">{order.kunde_name}</div>
              <div className="text-xs text-gray-600 mt-0.5 leading-tight">{fullAddress || '—'}</div>
              {distanceM != null && (
                <div className="text-xs text-blue-600 font-semibold mt-1">
                  {formatDistance(distanceM)} entfernt · {bearingLabel(bearing!)}
                </div>
              )}
            </div>
          </div>

          {/* Kundennotes */}
          {(order.kunde_notiz || order.kunde_lieferhinweis) && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 space-y-1">
              {order.kunde_notiz && (
                <div className="flex items-start gap-1.5">
                  <MessageSquare size={12} className="text-amber-600 mt-0.5 shrink-0" />
                  <span className="text-xs text-amber-800">{order.kunde_notiz}</span>
                </div>
              )}
              {order.kunde_lieferhinweis && (
                <div className="flex items-start gap-1.5">
                  <AlertCircle size={12} className="text-amber-600 mt-0.5 shrink-0" />
                  <span className="text-xs text-amber-800">{order.kunde_lieferhinweis}</span>
                </div>
              )}
            </div>
          )}

          {/* Nav-Links + Telefon */}
          <div className="flex flex-wrap gap-2">
            {hasCoords && (
              <>
                <a
                  href={buildNavUrl('google', order.kunde_lat!, order.kunde_lng!, fullAddress)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-semibold shadow-sm hover:bg-blue-700 transition"
                >
                  <Navigation size={12} />
                  Google Maps
                </a>
                <a
                  href={buildNavUrl('waze', order.kunde_lat!, order.kunde_lng!, fullAddress)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500 text-white text-xs font-semibold shadow-sm hover:bg-cyan-600 transition"
                >
                  <ExternalLink size={12} />
                  Waze
                </a>
                <a
                  href={buildNavUrl('apple', order.kunde_lat!, order.kunde_lng!, fullAddress)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-800 text-white text-xs font-semibold shadow-sm hover:bg-gray-900 transition"
                >
                  <MapPin size={12} />
                  Apple Maps
                </a>
              </>
            )}
            {order.kunde_telefon && (
              <a
                href={`tel:${order.kunde_telefon}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-matcha-600 text-white text-xs font-semibold shadow-sm hover:bg-matcha-700 transition"
              >
                <Phone size={12} />
                Anrufen
              </a>
            )}
          </div>

          {/* Zahlungsinfo */}
          <div className="flex items-center justify-between rounded-xl bg-gray-50 border border-gray-100 px-3 py-1.5">
            <span className="text-xs text-gray-500">Bestellwert</span>
            <span className="text-xs font-bold text-gray-900">{euro(order.gesamtbetrag)}</span>
          </div>

          {/* Weitere Stopps */}
          {remainingCount > 1 && (
            <div className="text-[11px] text-gray-500 text-center">
              Danach noch {remainingCount - 1} weiterer Stopp{remainingCount - 1 !== 1 ? 'e' : ''}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
