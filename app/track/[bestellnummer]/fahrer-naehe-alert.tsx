'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Navigation, Clock, MapPin } from 'lucide-react';

// Fahrer-Nähe-Alert (Track)
// Zeigt ein prominentes Banner wenn der Fahrer weniger als 5 Minuten entfernt ist.
// Berechnet anhand von eta_latest und fahrer_last_update.
// Verschwindet wenn die Lieferung als "geliefert" markiert wurde.

interface Props {
  status: string;
  etaLatest: string | null;
  fahrerLat: number | null;
  fahrerLng: number | null;
  kundeLat: number | null;
  kundeLng: number | null;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatMsLeft(ms: number): string {
  const totalSek = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(totalSek / 60);
  const s = totalSek % 60;
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  if (m === 0) return `${s}s`;
  return `${m}:${String(s).padStart(2, '0')} Min`;
}

export function FahrerNaeheAlert({ status, etaLatest, fahrerLat, fahrerLng, kundeLat, kundeLng }: Props) {
  const [, setTick] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Nur zeigen wenn Fahrer unterwegs und Bestellung noch nicht geliefert
  if (['geliefert', 'abgeholt', 'storniert'].includes(status)) return null;
  if (status !== 'unterwegs') return null;

  const now = Date.now();

  // ETA-basierte Nähe
  const etaMs = etaLatest ? new Date(etaLatest).getTime() : null;
  const msLeft = etaMs ? etaMs - now : null;
  const etaNah = msLeft !== null && msLeft >= 0 && msLeft < 5 * 60_000;

  // GPS-basierte Nähe (falls vorhanden)
  let gpsNah = false;
  if (fahrerLat && fahrerLng && kundeLat && kundeLng) {
    const km = haversineKm(fahrerLat, fahrerLng, kundeLat, kundeLng);
    gpsNah = km < 0.8;
  }

  const nah = etaNah || gpsNah;

  useEffect(() => {
    setVisible(nah);
  }, [nah]);

  if (!visible) return null;

  const countdownLabel = msLeft !== null && msLeft >= 0 ? formatMsLeft(msLeft) : null;

  return (
    <div className={cn(
      'rounded-2xl border-2 border-blue-400 bg-blue-600 shadow-lg shadow-blue-500/30 overflow-hidden',
      'animate-pulse',
    )}>
      <div className="px-4 py-4 flex items-center gap-4">
        {/* Puls-Icon */}
        <div className="relative flex-shrink-0">
          <span className="absolute inset-0 rounded-full bg-white opacity-30 animate-ping" />
          <div className="relative w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
            <Navigation className="w-6 h-6 text-white" />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-base font-black text-white leading-tight">
            Fahrer ist gleich da!
          </p>
          {countdownLabel ? (
            <p className="text-sm text-blue-100 mt-0.5">
              <Clock className="w-3.5 h-3.5 inline-block mr-1 text-blue-200" />
              Ankunft in ca. <span className="font-black text-white">{countdownLabel}</span>
            </p>
          ) : (
            <p className="text-sm text-blue-100 mt-0.5">
              <MapPin className="w-3.5 h-3.5 inline-block mr-1 text-blue-200" />
              Fahrer ist in der Nähe
            </p>
          )}
          <p className="text-xs text-blue-200 mt-1">
            Bitte halten Sie sich für die Übergabe bereit
          </p>
        </div>
      </div>
    </div>
  );
}
