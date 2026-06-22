'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  AlertTriangle, CheckCircle2, Clock, MapPin, Navigation, Phone, Route,
} from 'lucide-react';

type Stop = {
  id: string;
  reihenfolge: number;
  angekommen_am: string | null;
  geliefert_am: string | null;
  order: {
    id: string;
    bestellnummer: string;
    kunde_name: string;
    kunde_adresse: string | null;
    kunde_lat: number | null;
    kunde_lng: number | null;
    eta_earliest: string | null;
    eta_latest: string | null;
    kunde_telefon?: string | null;
    zahlungsart?: string | null;
    gesamtbetrag: number;
  };
};

interface Props {
  stops: Stop[];
  tourStartedAt: string | null;
  totalEtaMin: number | null;
}

function useTick() {
  const [, set] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => set(n => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);
}

function fmtSecs(secs: number): string {
  const abs = Math.abs(secs);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function mapsUrl(lat: number | null, lng: number | null, address: string | null): string {
  if (lat != null && lng != null) {
    return `https://maps.google.com/?q=${lat},${lng}`;
  }
  if (address) {
    return `https://maps.google.com/?q=${encodeURIComponent(address)}`;
  }
  return '#';
}

export function TourSequenzNavigatorPro({ stops, tourStartedAt, totalEtaMin }: Props) {
  useTick();

  const sorted = [...stops].sort((a, b) => a.reihenfolge - b.reihenfolge);
  const completed = sorted.filter(s => s.geliefert_am != null);
  const remaining = sorted.filter(s => s.geliefert_am == null);
  const current = remaining[0] ?? null;
  const upcoming = remaining.slice(1, 3);

  const progress = sorted.length > 0 ? (completed.length / sorted.length) * 100 : 0;

  const elapsedMin = tourStartedAt
    ? Math.floor((Date.now() - new Date(tourStartedAt).getTime()) / 60_000)
    : 0;
  const remainingMin = totalEtaMin != null ? Math.max(0, totalEtaMin - elapsedMin) : null;

  if (sorted.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-matcha-900/5">
        <Route className="h-4 w-4 text-matcha-600" />
        <span className="text-xs font-bold uppercase tracking-wider">Tour-Navigation</span>
        <div className="ml-auto flex items-center gap-2">
          {remainingMin !== null && (
            <span className="flex items-center gap-1 rounded-full bg-matcha-100 px-2.5 py-0.5 text-[11px] font-bold text-matcha-700">
              <Clock className="h-3 w-3" />
              ~{remainingMin} Min
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">
            {completed.length}/{sorted.length} Stopps
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-muted">
        <div
          className="h-full bg-matcha-500 transition-all duration-700"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="p-3 space-y-2.5">
        {/* Current stop — highlighted */}
        {current && (() => {
          const o = current.order;
          const etaIso = o.eta_latest ?? o.eta_earliest ?? null;
          const secsLeft = etaIso
            ? Math.floor((new Date(etaIso).getTime() - Date.now()) / 1000)
            : null;
          const isOverdue = secsLeft !== null && secsLeft < -60;
          const isTight = secsLeft !== null && secsLeft < 600 && secsLeft >= -60;
          const navUrl = mapsUrl(o.kunde_lat, o.kunde_lng, o.kunde_adresse);

          return (
            <div className={cn(
              'rounded-xl border-2 p-4 space-y-3',
              isOverdue ? 'border-red-400 bg-red-50' :
              isTight   ? 'border-amber-400 bg-amber-50' :
                          'border-matcha-400 bg-matcha-50',
            )}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={cn(
                      'text-[10px] font-bold uppercase tracking-wider',
                      isOverdue ? 'text-red-600' : isTight ? 'text-amber-600' : 'text-matcha-600',
                    )}>
                      Aktueller Stop #{current.reihenfolge}
                    </span>
                    {isOverdue && (
                      <AlertTriangle className="h-3.5 w-3.5 text-red-500 animate-pulse" />
                    )}
                  </div>
                  <div className="font-bold text-base text-foreground">{o.kunde_name}</div>
                  {o.kunde_adresse && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{o.kunde_adresse}</span>
                    </div>
                  )}
                </div>

                {/* Countdown */}
                {secsLeft !== null && (
                  <div className={cn(
                    'shrink-0 flex flex-col items-center justify-center rounded-xl px-3 py-2 min-w-[56px]',
                    isOverdue ? 'bg-red-500 text-white' :
                    isTight   ? 'bg-amber-500 text-white' :
                                'bg-matcha-600 text-white',
                  )}>
                    <span className="font-mono font-black text-lg tabular-nums leading-none">
                      {isOverdue ? `+${fmtSecs(Math.abs(secsLeft))}` : fmtSecs(secsLeft)}
                    </span>
                    <span className="text-[9px] opacity-80 mt-0.5">
                      {isOverdue ? 'überfällig' : 'ETA'}
                    </span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <a
                  href={navUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-bold text-white',
                    isOverdue ? 'bg-red-500' : isTight ? 'bg-amber-500' : 'bg-matcha-600',
                  )}
                >
                  <Navigation className="h-4 w-4" />
                  Navigieren
                </a>
                {o.kunde_telefon && (
                  <a
                    href={`tel:${o.kunde_telefon}`}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-bold"
                  >
                    <Phone className="h-4 w-4" />
                  </a>
                )}
              </div>

              {/* Payment info */}
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>#{o.bestellnummer.slice(-6)}</span>
                <span className="font-bold text-foreground">
                  {o.gesamtbetrag.toFixed(2)} €
                  {o.zahlungsart === 'bar' && ' · Bar'}
                  {o.zahlungsart === 'karte' && ' · Karte'}
                </span>
              </div>
            </div>
          );
        })()}

        {/* Upcoming stops */}
        {upcoming.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1">
              Nächste Stopps
            </div>
            {upcoming.map((stop, idx) => {
              const o = stop.order;
              const etaIso = o.eta_latest ?? o.eta_earliest ?? null;
              const minLeft = etaIso
                ? Math.floor((new Date(etaIso).getTime() - Date.now()) / 60_000)
                : null;

              return (
                <div key={stop.id} className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted border border-border text-[11px] font-black text-muted-foreground">
                    {stop.reihenfolge}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-foreground truncate">{o.kunde_name}</div>
                    {o.kunde_adresse && (
                      <div className="text-[10px] text-muted-foreground truncate">{o.kunde_adresse}</div>
                    )}
                  </div>
                  {minLeft !== null && (
                    <span className={cn(
                      'shrink-0 text-[10px] font-bold tabular-nums',
                      minLeft < 0 ? 'text-red-500' : minLeft < 10 ? 'text-amber-600' : 'text-muted-foreground',
                    )}>
                      {minLeft < 0 ? `+${Math.abs(minLeft)}m` : `${minLeft}m`}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Completed stops */}
        {completed.length > 0 && (
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground pt-1 border-t border-border">
            <CheckCircle2 className="h-3.5 w-3.5 text-matcha-500" />
            <span>{completed.length} Stopp{completed.length !== 1 ? 's' : ''} abgeschlossen</span>
          </div>
        )}
      </div>
    </div>
  );
}
