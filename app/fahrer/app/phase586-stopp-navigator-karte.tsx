'use client';

/**
 * Phase 586 — Fahrer-App: Einzel-Stopp-Navigator-Karte
 *
 * Kartenansicht des nächsten Stopps mit Adresse + Abstand.
 * Zeigt eine statische Karten-Darstellung (OpenStreetMap-Link + Adressblock).
 * Kein Leaflet/Mapbox (kein externen CDN erlaubt) — Link öffnet native Maps App.
 *
 * Ticker: 60s
 */

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, ChevronUp, MapPin, Navigation, Phone } from 'lucide-react';

interface StopAddress {
  street?: string | null;
  city?: string | null;
  zip?: string | null;
  lat?: number | null;
  lng?: number | null;
}

interface Stop {
  id: string;
  status?: string | null;
  sequence_number?: number | null;
  address?: StopAddress | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  notes?: string | null;
  distance_km?: number | null;
}

interface Props {
  stops?: Stop[] | null;
  currentLat?: number | null;
  currentLng?: number | null;
}

const PENDING_STATUSES = new Set([undefined, null, 'pending', 'assigned', 'next']);

function fmtAddress(addr: StopAddress | null | undefined): string {
  if (!addr) return 'Adresse unbekannt';
  const parts = [addr.street, addr.zip && addr.city ? `${addr.zip} ${addr.city}` : addr.city].filter(Boolean);
  return parts.join(', ') || 'Adresse unbekannt';
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function mapsUrl(addr: StopAddress | null | undefined, query?: string): string {
  if (addr?.lat && addr?.lng) {
    return `https://maps.google.com/?q=${addr.lat},${addr.lng}`;
  }
  if (query) return `https://maps.google.com/?q=${encodeURIComponent(query)}`;
  return '#';
}

export function FahrerPhase586StoppNavigatorKarte({ stops = [], currentLat, currentLng }: Props) {
  const [open, setOpen] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const nextStop = useMemo(() => {
    if (!stops || stops.length === 0) return null;
    const pending = stops
      .filter(s => PENDING_STATUSES.has(s.status as string | null | undefined))
      .sort((a, b) => (a.sequence_number ?? 99) - (b.sequence_number ?? 99));
    return pending[0] ?? null;
  }, [stops, tick]);

  const distanceKm = useMemo(() => {
    if (!nextStop) return null;
    if (nextStop.distance_km != null) return nextStop.distance_km;
    const lat = nextStop.address?.lat;
    const lng = nextStop.address?.lng;
    if (currentLat && currentLng && lat && lng) {
      return Math.round(haversineKm(currentLat, currentLng, lat, lng) * 10) / 10;
    }
    return null;
  }, [nextStop, currentLat, currentLng, tick]);

  const etaMin = distanceKm !== null ? Math.max(1, Math.round(distanceKm / 0.5)) : null;

  if (!nextStop) return null;

  const address = fmtAddress(nextStop.address);
  const navUrl  = mapsUrl(nextStop.address, address);
  const phoneHref = nextStop.customer_phone
    ? `tel:${nextStop.customer_phone.replace(/\s/g, '')}`
    : null;

  return (
    <Card className="overflow-hidden border-matcha-200">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-matcha-50 hover:bg-matcha-100/60 transition"
      >
        <div className="flex items-center gap-2">
          <Navigation className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider text-matcha-800">
            Nächster Stopp
          </span>
          {distanceKm !== null && (
            <Badge className="text-[10px] px-2 py-0.5 bg-matcha-600 text-white">
              {distanceKm} km
            </Badge>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-matcha-600" /> : <ChevronDown className="h-4 w-4 text-matcha-600" />}
      </button>

      {open && (
        <div className="px-4 py-4 space-y-3">
          {/* Address block */}
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-matcha-600 text-white font-black text-sm">
              {nextStop.sequence_number ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              {nextStop.customer_name && (
                <div className="text-sm font-bold text-foreground truncate">{nextStop.customer_name}</div>
              )}
              <div className="text-xs text-muted-foreground mt-0.5 leading-snug">{address}</div>
              {etaMin !== null && (
                <div className="mt-1 text-[11px] font-bold text-matcha-700">
                  ~{etaMin} Min Fahrzeit
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {nextStop.notes && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
              {nextStop.notes}
            </div>
          )}

          {/* Distance bar */}
          {distanceKm !== null && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Entfernung</span>
                <span className="text-xs font-black tabular-nums text-matcha-700">{distanceKm} km</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-matcha-500 transition-all duration-500"
                  style={{ width: `${Math.min(100, (distanceKm / 10) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            <a
              href={navUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white transition',
                'bg-matcha-600 hover:bg-matcha-700',
              )}
            >
              <MapPin className="h-4 w-4" />
              Navigation starten
              <ChevronRight className="h-4 w-4 opacity-70" />
            </a>

            {phoneHref && (
              <a
                href={phoneHref}
                className="flex items-center justify-center w-12 rounded-xl bg-slate-100 hover:bg-slate-200 transition"
              >
                <Phone className="h-4 w-4 text-slate-700" />
              </a>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
