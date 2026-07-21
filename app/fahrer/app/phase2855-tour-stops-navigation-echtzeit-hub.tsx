'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, Phone, Navigation, CheckCircle2, Clock, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';

/**
 * Phase 2855 — Tour-Stops Navigation Echtzeit-Hub
 *
 * Kompakter Echtzeit-Navigator: Nächster Stopp hero + One-Tap Navigation
 * Google Maps/Waze + Kunden-Anruf + Stopp-Fortschritts-Dots + ETA-Countdown.
 * 15-Sek-Polling + 1-Sek-Tick. Mobile-first.
 */

interface Order {
  id: string;
  bestellnummer?: string | null;
  kunde_adresse?: string | null;
  kunde_lat?: number | null;
  kunde_lng?: number | null;
  kunde_telefon?: string | null;
  kunde_name?: string | null;
  kunde_lieferhinweis?: string | null;
}

interface Stop {
  id: string;
  reihenfolge: number;
  geliefert_am?: string | null;
  angekommen_am?: string | null;
  eta_min?: number | null;
  order?: Order | null;
}

interface Props {
  stops: Stop[];
  onMarkDelivered?: (stopId: string) => void;
  onMarkArrived?: (stopId: string) => void;
}

function fmtEta(sec: number): string {
  if (sec <= 0) return 'Jetzt';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function mapsUrl(lat: number | null | undefined, lng: number | null | undefined, addr: string | null | undefined): string {
  if (lat && lng) return `https://maps.google.com/?q=${lat},${lng}`;
  if (addr) return `https://maps.google.com/?q=${encodeURIComponent(addr)}`;
  return 'https://maps.google.com/';
}

function wazeUrl(lat: number | null | undefined, lng: number | null | undefined): string {
  if (lat && lng) return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
  return 'https://waze.com/';
}

export function FahrerPhase2855TourStopsNavigationEchtzeitHub({ stops, onMarkDelivered, onMarkArrived }: Props) {
  const [tick, setTick] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const sorted = useMemo(() =>
    [...stops].sort((a, b) => a.reihenfolge - b.reihenfolge),
    [stops],
  );

  const current = useMemo(() =>
    sorted.find(s => !s.geliefert_am) ?? null,
    [sorted],
  );

  const done = sorted.filter(s => s.geliefert_am).length;
  const total = sorted.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const etaSec = useMemo(() => {
    if (!current?.eta_min) return null;
    return current.eta_min * 60 - tick;
  }, [current, tick]);

  if (total === 0) return null;

  const nextStops = sorted.filter(s => !s.geliefert_am && s.id !== current?.id).slice(0, 3);
  const o = current?.order;

  return (
    <div className="rounded-2xl border-2 border-matcha-300 dark:border-matcha-700 bg-matcha-50 dark:bg-matcha-900/20 overflow-hidden shadow-lg">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-matcha-600 text-white">
        <Navigation className="h-4 w-4 shrink-0" />
        <span className="font-display font-bold text-sm flex-1">Tour-Navigation</span>
        <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full">
          {done}/{total} Stopps
        </span>
      </div>

      {/* Progress Bar */}
      <div className="h-1.5 bg-matcha-200 dark:bg-matcha-800">
        <div className="h-full bg-matcha-500 transition-all" style={{ width: `${pct}%` }} />
      </div>

      {/* Current Stop Hero */}
      {current ? (
        <div className="p-4 space-y-3">
          <div className="flex items-start gap-2">
            <div className="h-8 w-8 rounded-xl bg-matcha-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
              {current.reihenfolge}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wide text-matcha-600 dark:text-matcha-400">
                Nächster Stopp
              </div>
              <div className="font-bold text-sm leading-tight truncate">
                {o?.kunde_name ?? 'Kunde'}
              </div>
              <div className="text-[11px] text-muted-foreground truncate">
                {o?.kunde_adresse ?? 'Keine Adresse'}
              </div>
              {o?.kunde_lieferhinweis && (
                <div className="flex items-start gap-1 mt-1">
                  <AlertCircle className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" />
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 leading-tight">{o.kunde_lieferhinweis}</span>
                </div>
              )}
            </div>
            {etaSec != null && (
              <div className="text-right shrink-0">
                <div className={cn(
                  'font-mono font-bold text-lg leading-none',
                  etaSec > 0 ? 'text-matcha-700 dark:text-matcha-300' : 'text-red-600',
                )}>
                  {fmtEta(Math.max(0, etaSec))}
                </div>
                <div className="text-[8px] text-muted-foreground">ETA</div>
              </div>
            )}
          </div>

          {/* Navigation Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <a
              href={mapsUrl(o?.kunde_lat, o?.kunde_lng, o?.kunde_adresse)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 text-white text-[11px] font-bold hover:bg-blue-700 active:scale-95 transition"
            >
              <MapPin className="h-3.5 w-3.5" />
              Google Maps
            </a>
            <a
              href={wazeUrl(o?.kunde_lat, o?.kunde_lng)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-cyan-500 text-white text-[11px] font-bold hover:bg-cyan-600 active:scale-95 transition"
            >
              <Navigation className="h-3.5 w-3.5" />
              Waze
            </a>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2">
            {o?.kunde_telefon && (
              <a
                href={`tel:${o.kunde_telefon}`}
                className="flex items-center justify-center gap-2 py-2 rounded-xl border border-muted-foreground/30 text-[11px] font-medium hover:bg-muted/50 transition"
              >
                <Phone className="h-3.5 w-3.5 text-matcha-600" />
                Anrufen
              </a>
            )}
            {onMarkArrived && !current.angekommen_am && (
              <button
                disabled={acting === current.id}
                onClick={async () => {
                  setActing(current.id);
                  await onMarkArrived?.(current.id);
                  setActing(null);
                }}
                className="flex items-center justify-center gap-2 py-2 rounded-xl border border-amber-300 text-amber-700 text-[11px] font-bold hover:bg-amber-50 dark:hover:bg-amber-900/20 transition active:scale-95"
              >
                <Clock className="h-3.5 w-3.5" />
                Angekommen
              </button>
            )}
            {onMarkDelivered && (
              <button
                disabled={acting === current.id}
                onClick={async () => {
                  setActing(current.id);
                  await onMarkDelivered?.(current.id);
                  setActing(null);
                }}
                className={cn(
                  'flex items-center justify-center gap-2 py-2 rounded-xl text-[11px] font-bold transition active:scale-95',
                  !o?.kunde_telefon
                    ? 'col-span-2'
                    : '',
                  'bg-matcha-600 text-white hover:bg-matcha-700',
                )}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Zugestellt ✓
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 p-4">
          <CheckCircle2 className="h-8 w-8 text-matcha-500" />
          <div>
            <div className="font-bold text-sm">Tour abgeschlossen!</div>
            <div className="text-[11px] text-muted-foreground">Alle {total} Stopps erledigt</div>
          </div>
        </div>
      )}

      {/* Stop Dots + Weitere Stopps */}
      {sorted.length > 0 && (
        <div className="px-4 pb-3 space-y-2">
          {/* Dots */}
          <div className="flex gap-1.5 items-center">
            {sorted.map(s => (
              <div
                key={s.id}
                className={cn(
                  'h-2.5 w-2.5 rounded-full border transition-colors',
                  s.geliefert_am
                    ? 'bg-matcha-500 border-matcha-600'
                    : s.id === current?.id
                      ? 'bg-amber-400 border-amber-500 scale-125'
                      : 'bg-muted-foreground/20 border-muted-foreground/30',
                )}
              />
            ))}
            <span className="text-[9px] text-muted-foreground ml-1">{pct}%</span>
          </div>

          {/* Nächste Stopps aufklappbar */}
          {nextStops.length > 0 && (
            <>
              <button
                onClick={() => setExpanded(v => !v)}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition"
              >
                {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {nextStops.length} weitere {nextStops.length === 1 ? 'Stopp' : 'Stopps'}
              </button>
              {expanded && (
                <div className="space-y-1.5">
                  {nextStops.map(s => (
                    <div key={s.id} className="flex items-center gap-2 text-[10px] bg-muted/40 rounded-lg px-2.5 py-1.5">
                      <span className="font-bold text-muted-foreground w-4 shrink-0">{s.reihenfolge}</span>
                      <span className="flex-1 truncate text-muted-foreground">{s.order?.kunde_adresse ?? 'Adresse fehlt'}</span>
                      {s.eta_min && <span className="text-matcha-600 font-mono shrink-0">~{s.eta_min}m</span>}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
