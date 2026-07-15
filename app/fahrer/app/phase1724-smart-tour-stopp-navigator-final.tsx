'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, Navigation, Phone, ChevronDown, ChevronUp, CheckCircle2, Clock, Package } from 'lucide-react';

/**
 * Phase 1724 — Smart-Tour-Stopp-Navigator-Final (Fahrer-App)
 *
 * Aktueller Stopp mit prominenter Navigations-CTA + ETA-Countdown.
 * Nächster Stopp als Vorschau. Alle Stopps aufklappbar.
 * Akzeptiert stops, batchId, totalEtaMin, startedAt, isOnline.
 */

interface Stop {
  id: string;
  order_id?: string | null;
  address?: string | null;
  adresse?: string | null;
  kunde_name?: string | null;
  customer_name?: string | null;
  geliefert_am?: string | null;
  delivered_at?: string | null;
  notiz?: string | null;
  phone?: string | null;
  telefon?: string | null;
  sequence?: number | null;
  position?: number | null;
  eta_min?: number | null;
}

interface Props {
  stops: Stop[];
  batchId: string;
  totalEtaMin?: number | null;
  startedAt?: string | null;
  isOnline: boolean;
}

function getAddress(s: Stop): string {
  return s.address ?? s.adresse ?? '';
}

function getName(s: Stop): string {
  return s.kunde_name ?? s.customer_name ?? 'Kunde';
}

function isDelivered(s: Stop): boolean {
  return !!(s.geliefert_am ?? s.delivered_at);
}

function getPhone(s: Stop): string | null {
  return s.phone ?? s.telefon ?? null;
}

function getSeq(s: Stop): number {
  return s.sequence ?? s.position ?? 0;
}

export function FahrerPhase1724SmartTourStoppNavigatorFinal({
  stops,
  totalEtaMin,
  startedAt,
  isOnline,
}: Props) {
  const [showAll, setShowAll] = useState(false);
  const [tick, setTick] = useState(0);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    ref.current = setInterval(() => setTick(t => t + 1), 10_000);
    return () => { if (ref.current) clearInterval(ref.current); };
  }, []);

  const sorted = useMemo(
    () => [...stops].sort((a, b) => getSeq(a) - getSeq(b)),
    [stops],
  );

  const currentStop = useMemo(
    () => sorted.find(s => !isDelivered(s)) ?? null,
    [sorted],
  );

  const nextStop = useMemo(
    () => sorted.filter(s => !isDelivered(s))[1] ?? null,
    [sorted],
  );

  const completedCount = useMemo(
    () => sorted.filter(s => isDelivered(s)).length,
    [sorted],
  );

  const remainingMin = useMemo(() => {
    if (!totalEtaMin || !startedAt) return null;
    const elapsedMin = Math.floor((Date.now() - new Date(startedAt).getTime()) / 60_000);
    return Math.max(0, totalEtaMin - elapsedMin);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalEtaMin, startedAt, tick]);

  if (!isOnline || sorted.length === 0) return null;

  const addr = currentStop ? getAddress(currentStop) : '';
  const mapsUrl = addr ? `https://maps.google.com/?q=${encodeURIComponent(addr)}` : '#';

  return (
    <div className="mx-4 mb-3 rounded-xl border border-matcha-200 dark:border-matcha-800 bg-matcha-50/50 dark:bg-matcha-950/20 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 bg-matcha-500 px-3 py-2">
        <span className="flex items-center gap-2 text-sm font-black text-white">
          <Package className="h-4 w-4" />
          Tour-Navigator
        </span>
        <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold text-white">
          {completedCount}/{sorted.length} Stopps
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-matcha-100 dark:bg-matcha-900/30">
        <div
          className="h-full bg-matcha-500 transition-all duration-700"
          style={{ width: `${sorted.length > 0 ? (completedCount / sorted.length) * 100 : 0}%` }}
        />
      </div>

      <div className="p-3">
        {currentStop ? (
          <>
            {/* Current stop */}
            <div className="rounded-lg border border-matcha-300 dark:border-matcha-700 bg-white dark:bg-black/20 p-3 mb-2">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-matcha-500 text-white text-xs font-black shrink-0">
                    {completedCount + 1}
                  </div>
                  <div>
                    <div className="text-xs font-bold">{getName(currentStop)}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{getAddress(currentStop)}</div>
                  </div>
                </div>
                {remainingMin !== null && (
                  <div className="shrink-0 text-right">
                    <div className="flex items-center gap-1 text-matcha-600 dark:text-matcha-400">
                      <Clock className="h-3 w-3" />
                      <span className="text-xs font-black tabular-nums">{remainingMin} Min</span>
                    </div>
                    <div className="text-[9px] text-muted-foreground">verbleibend</div>
                  </div>
                )}
              </div>

              {currentStop.notiz && (
                <div className="mb-2 rounded bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-2 py-1">
                  <span className="text-[10px] text-amber-700 dark:text-amber-300">{currentStop.notiz}</span>
                </div>
              )}

              <div className="flex gap-2">
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-matcha-500 px-3 py-2 text-xs font-black text-white active:bg-matcha-600"
                >
                  <Navigation className="h-3.5 w-3.5" />
                  Navigieren
                </a>
                {getPhone(currentStop) && (
                  <a
                    href={`tel:${getPhone(currentStop)}`}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-matcha-300 dark:border-matcha-700 bg-white dark:bg-black/20 px-3 py-2 text-xs font-bold text-matcha-700 dark:text-matcha-300"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    Anrufen
                  </a>
                )}
              </div>
            </div>

            {/* Next stop preview */}
            {nextStop && (
              <div className="rounded-lg border border-muted bg-muted/30 px-3 py-2 mb-2 flex items-center gap-2">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-muted-foreground text-[9px] font-black shrink-0">
                  {completedCount + 2}
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-bold truncate text-muted-foreground">
                    Nächster: {getName(nextStop)}
                  </div>
                  <div className="text-[9px] text-muted-foreground truncate">{getAddress(nextStop)}</div>
                </div>
                <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center gap-2 rounded-lg bg-matcha-50 dark:bg-matcha-950/20 border border-matcha-200 dark:border-matcha-800 px-3 py-2">
            <CheckCircle2 className="h-5 w-5 text-matcha-500" />
            <span className="text-sm font-bold text-matcha-700 dark:text-matcha-300">
              Alle {sorted.length} Stopps erledigt!
            </span>
          </div>
        )}

        {/* All stops toggle */}
        <button
          onClick={() => setShowAll(v => !v)}
          className="flex w-full items-center justify-between text-[10px] font-bold text-muted-foreground mt-1 px-1"
        >
          <span>Alle Stopps anzeigen ({sorted.length})</span>
          {showAll ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>

        {showAll && (
          <div className="mt-2 space-y-1">
            {sorted.map((s, i) => {
              const done = isDelivered(s);
              return (
                <div key={s.id} className={cn(
                  'flex items-center gap-2 rounded-lg border px-2 py-1.5',
                  done
                    ? 'border-muted bg-muted/20 opacity-60'
                    : 'border-matcha-200 dark:border-matcha-800 bg-white dark:bg-black/10',
                )}>
                  <div className={cn(
                    'flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-black shrink-0',
                    done ? 'bg-matcha-100 text-matcha-600' : 'bg-matcha-500 text-white',
                  )}>
                    {done ? '✓' : i + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold truncate">{getName(s)}</div>
                    <div className="text-[9px] text-muted-foreground truncate">{getAddress(s)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
