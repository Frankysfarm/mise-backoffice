'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, Navigation, Clock, CheckCircle2, Package, ChevronDown, ChevronUp, Phone } from 'lucide-react';

/**
 * Phase 1526 — Smart-Tour-Stopp-Cockpit (Fahrer-App)
 *
 * Zeigt alle Tour-Stops in priorisierter Reihenfolge:
 *   - Aktueller Stop mit großem CTA (Navigation öffnen)
 *   - Nächste Stops als kompakte Liste
 *   - ETA-Countdown je Stop
 *   - Kunden-Kontakt (Telefon)
 *
 * Props-basiert — kein eigener API-Aufruf.
 */

interface TourStop {
  id: string;
  sequence?: number | null;
  status?: string | null;
  estimated_arrival_at?: string | null;
  kunde_name?: string | null;
  kunde_telefon?: string | null;
  adresse?: string | null;
  lat?: number | null;
  lng?: number | null;
}

interface Props {
  stops: TourStop[];
  onNavigate?: (stop: TourStop) => void;
  onComplete?: (stopId: string) => void;
}

const DONE_STATUSES = new Set(['geliefert', 'delivered', 'abgeschlossen', 'abgeholt']);

function etaDiff(eta: string | null | undefined): { label: string; color: string } {
  if (!eta) return { label: '–', color: 'text-muted-foreground' };
  const diff = Math.round((new Date(eta).getTime() - Date.now()) / 60_000);
  if (diff <= 0)  return { label: 'Jetzt!', color: 'text-matcha-600 font-bold' };
  if (diff <= 5)  return { label: `${diff} Min`, color: 'text-red-600 font-bold' };
  if (diff <= 15) return { label: `${diff} Min`, color: 'text-amber-600' };
  return               { label: `${diff} Min`, color: 'text-muted-foreground' };
}

function buildNavUrl(stop: TourStop): string {
  if (stop.lat && stop.lng) {
    return `https://maps.google.com/maps?daddr=${stop.lat},${stop.lng}`;
  }
  if (stop.adresse) {
    return `https://maps.google.com/maps?q=${encodeURIComponent(stop.adresse)}`;
  }
  return '';
}

export function FahrerPhase1526SmartTourStoppCockpit({ stops, onNavigate, onComplete }: Props) {
  const [open, setOpen] = useState(true);

  const sorted = useMemo(() =>
    [...stops].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0)),
    [stops],
  );

  const pending = sorted.filter(s => !DONE_STATUSES.has(s.status ?? ''));
  const done    = sorted.filter(s =>  DONE_STATUSES.has(s.status ?? ''));
  const current = pending[0];

  if (stops.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-matcha-600" />
          <span className="text-sm font-semibold">Tour-Stopps</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
            {done.length}/{sorted.length}
          </span>
          {pending.length > 0 && (
            <span className="rounded-full bg-matcha-100 dark:bg-matcha-900/30 border border-matcha-300 px-2 py-0.5 text-[10px] font-bold text-matcha-700 dark:text-matcha-300">
              {pending.length} offen
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t space-y-2 p-3">
          {current && (
            <div className="rounded-xl bg-matcha-50 dark:bg-matcha-900/20 border border-matcha-300 p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-matcha-600 text-[10px] font-black text-white">
                      {current.sequence ?? '?'}
                    </span>
                    <span className="text-sm font-bold text-matcha-800 dark:text-matcha-200 truncate">
                      {current.kunde_name ?? 'Kunde'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="truncate">{current.adresse ?? 'Adresse unbekannt'}</span>
                  </div>
                  {current.estimated_arrival_at && (() => {
                    const eta = etaDiff(current.estimated_arrival_at);
                    return (
                      <div className={cn('flex items-center gap-1 text-xs', eta.color)}>
                        <Clock className="h-3 w-3" />
                        ETA {eta.label}
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div className="flex gap-2">
                {buildNavUrl(current) && (
                  <a
                    href={buildNavUrl(current)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-matcha-600 px-3 py-2 text-xs font-bold text-white hover:bg-matcha-700 transition"
                    onClick={() => onNavigate?.(current)}
                  >
                    <Navigation className="h-3.5 w-3.5" />
                    Navigation starten
                  </a>
                )}
                {current.kunde_telefon && (
                  <a
                    href={`tel:${current.kunde_telefon}`}
                    className="flex items-center justify-center gap-1 rounded-lg border border-muted px-3 py-2 text-xs font-semibold hover:bg-muted/40 transition"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    Anrufen
                  </a>
                )}
                {onComplete && (
                  <button
                    onClick={() => onComplete(current.id)}
                    className="flex items-center justify-center gap-1 rounded-lg border border-matcha-400 bg-matcha-100 dark:bg-matcha-900/30 px-3 py-2 text-xs font-bold text-matcha-700 dark:text-matcha-300 hover:bg-matcha-200 transition"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Geliefert
                  </button>
                )}
              </div>
            </div>
          )}

          {pending.length > 1 && (
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1">
                Nächste Stopps
              </p>
              {pending.slice(1).map(stop => {
                const eta = etaDiff(stop.estimated_arrival_at);
                return (
                  <div
                    key={stop.id}
                    className="flex items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2"
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold">
                      {stop.sequence ?? '?'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold truncate">{stop.kunde_name ?? 'Kunde'}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{stop.adresse ?? ''}</p>
                    </div>
                    <span className={cn('shrink-0 text-[11px] tabular-nums', eta.color)}>
                      {eta.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {done.length > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg bg-muted/20 border border-dashed px-3 py-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-matcha-500 shrink-0" />
              <span className="text-[11px] text-muted-foreground">
                {done.length} Stop{done.length !== 1 ? 's' : ''} abgeschlossen
              </span>
              <Package className="h-3 w-3 text-muted-foreground ml-auto" />
            </div>
          )}

          {pending.length === 0 && (
            <div className="flex items-center gap-2 rounded-xl bg-matcha-50 dark:bg-matcha-900/20 border border-matcha-300 px-3 py-3">
              <CheckCircle2 className="h-5 w-5 text-matcha-600" />
              <div>
                <p className="text-sm font-bold text-matcha-700 dark:text-matcha-300">Tour abgeschlossen!</p>
                <p className="text-xs text-muted-foreground">Alle {done.length} Stopps geliefert.</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
