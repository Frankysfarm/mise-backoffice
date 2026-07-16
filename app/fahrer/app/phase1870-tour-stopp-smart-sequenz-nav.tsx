'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  ChevronDown, ChevronUp, CheckCircle2, Clock, MapPin, Navigation, Phone,
} from 'lucide-react';

/**
 * Phase 1870 — Tour-Stopp-Smart-Sequenz-Navigator (Fahrer-App)
 *
 * Fokus-Karte für den nächsten Stopp + kompakte Sequenz-Liste darunter.
 *  - Großer Next-Stop-Block: Adresse, ETA, Kunden-Name, Tel-Link
 *  - One-Tap Navigation (Google Maps / Apple Maps)
 *  - Kompakte Stopp-Liste (Sequenz-Nr, Status-Indikator, Adresse)
 * Rein client-seitig — keine API-Calls.
 */

interface Stop {
  id: string;
  sequence: number;
  status: string;
  kunde_name?: string | null;
  adresse?: string | null;
  lat?: number | null;
  lng?: number | null;
  telefon?: string | null;
  estimated_arrival?: string | null;
  bestellnummer?: string | null;
}

function isDelivered(s: string) {
  return ['geliefert', 'abgeschlossen', 'delivered'].includes(s);
}

function formatEta(estimated_arrival: string | null | undefined): string {
  if (!estimated_arrival) return '';
  const ms = new Date(estimated_arrival).getTime() - Date.now();
  if (ms <= 0) return 'Jetzt';
  const min = Math.round(ms / 60_000);
  return `~${min} Min`;
}

function buildNavUrl(stop: Stop, app: 'google' | 'apple'): string {
  if (stop.lat && stop.lng) {
    const ll = `${stop.lat},${stop.lng}`;
    return app === 'google'
      ? `https://www.google.com/maps/dir/?api=1&destination=${ll}&travelmode=driving`
      : `maps://?daddr=${ll}&dirflg=d`;
  }
  const q = encodeURIComponent(stop.adresse ?? '');
  return app === 'google'
    ? `https://www.google.com/maps/search/?api=1&query=${q}`
    : `maps://?q=${q}`;
}

interface Props {
  stops: Stop[];
  className?: string;
}

export function FahrerPhase1870TourStoppSmartSequenzNav({ stops, className }: Props) {
  const [open, setOpen] = useState(true);

  const sorted = [...stops].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
  const next = sorted.find((s) => !isDelivered(s.status));
  const doneCount = sorted.filter((s) => isDelivered(s.status)).length;

  if (sorted.length === 0) return null;

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <Navigation className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">
            Tour-Sequenz
          </span>
          <span className="rounded-full bg-matcha-100 text-matcha-700 dark:bg-matcha-900/40 dark:text-matcha-300 px-2 py-0.5 text-[10px] font-bold">
            {doneCount}/{sorted.length} erledigt
          </span>
          {next && (
            <span className="rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 text-[10px] font-bold">
              Nächster: #{next.sequence + 1}
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t px-4 py-4 space-y-3">
          {/* Next stop focus card */}
          {next && (
            <div className="rounded-2xl border-2 border-matcha-400 dark:border-matcha-600 bg-matcha-50 dark:bg-matcha-950/20 p-4">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-matcha-600 mb-0.5">
                    Nächster Stopp · #{next.sequence + 1} von {sorted.length}
                  </div>
                  {next.kunde_name && (
                    <div className="text-base font-black leading-tight">{next.kunde_name}</div>
                  )}
                  {next.bestellnummer && (
                    <div className="text-[11px] text-muted-foreground">Bestellung #{next.bestellnummer}</div>
                  )}
                </div>
                {next.estimated_arrival && (
                  <div className="shrink-0 flex items-center gap-1.5 rounded-xl bg-matcha-100 dark:bg-matcha-900/40 px-3 py-1.5">
                    <Clock className="h-3.5 w-3.5 text-matcha-600" />
                    <span className="text-sm font-black text-matcha-700 dark:text-matcha-300">
                      {formatEta(next.estimated_arrival)}
                    </span>
                  </div>
                )}
              </div>

              {next.adresse && (
                <div className="flex items-start gap-2 mb-3">
                  <MapPin className="h-4 w-4 text-matcha-600 shrink-0 mt-0.5" />
                  <span className="text-sm font-medium leading-snug">{next.adresse}</span>
                </div>
              )}

              <div className="flex gap-2 flex-wrap">
                <a
                  href={buildNavUrl(next, 'google')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-xl bg-blue-600 text-white px-3 py-2 text-xs font-bold hover:bg-blue-700 transition"
                >
                  <Navigation className="h-3.5 w-3.5" />
                  Google Maps
                </a>
                <a
                  href={buildNavUrl(next, 'apple')}
                  className="flex items-center gap-1.5 rounded-xl bg-gray-800 text-white px-3 py-2 text-xs font-bold hover:bg-gray-700 transition"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  Apple Maps
                </a>
                {next.telefon && (
                  <a
                    href={`tel:${next.telefon}`}
                    className="flex items-center gap-1.5 rounded-xl border border-matcha-300 bg-white dark:bg-card text-matcha-700 dark:text-matcha-300 px-3 py-2 text-xs font-bold hover:bg-matcha-50 transition"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    Anrufen
                  </a>
                )}
              </div>
            </div>
          )}

          {!next && (
            <div className="flex items-center gap-2 rounded-xl bg-matcha-50 dark:bg-matcha-950/20 border border-matcha-200 px-4 py-3">
              <CheckCircle2 className="h-5 w-5 text-matcha-600 shrink-0" />
              <span className="text-sm font-bold text-matcha-700 dark:text-matcha-300">
                Alle {sorted.length} Stopps erledigt — gute Arbeit!
              </span>
            </div>
          )}

          {/* Compact stop list */}
          {sorted.length > 1 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Alle Stopps
              </div>
              <div className="space-y-1">
                {sorted.map((stop) => {
                  const done = isDelivered(stop.status);
                  const isNext = stop.id === next?.id;
                  return (
                    <div
                      key={stop.id}
                      className={cn(
                        'flex items-center gap-3 rounded-xl px-3 py-2 border',
                        done ? 'border-matcha-200 dark:border-matcha-800 bg-matcha-50 dark:bg-matcha-950/20 opacity-60'
                          : isNext ? 'border-matcha-400 dark:border-matcha-600 bg-matcha-50 dark:bg-matcha-950/30'
                          : 'border-border bg-muted/20',
                      )}
                    >
                      <div className={cn(
                        'w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black shrink-0',
                        done ? 'bg-matcha-200 text-matcha-700 dark:bg-matcha-800 dark:text-matcha-300'
                          : isNext ? 'bg-matcha-600 text-white'
                          : 'bg-muted text-muted-foreground',
                      )}>
                        {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : stop.sequence + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold truncate">
                          {stop.kunde_name ?? `Stopp ${stop.sequence + 1}`}
                        </div>
                        {stop.adresse && (
                          <div className="text-[10px] text-muted-foreground truncate">{stop.adresse}</div>
                        )}
                      </div>
                      {stop.estimated_arrival && !done && (
                        <span className="text-[10px] font-bold text-muted-foreground shrink-0 tabular-nums">
                          {formatEta(stop.estimated_arrival)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
