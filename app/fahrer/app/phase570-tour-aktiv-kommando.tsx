'use client';

/**
 * Phase 570 — Fahrer-App: Tour-Aktiv-Kommando
 *
 * Kompakter Navigations-Hub für den aktiven Tour-Schritt.
 * Zeigt:
 *   - Nächster Stopp mit Adresse + Bestellnummer
 *   - ETA-Countdown bis zum Zeitfenster (eta_earliest/latest)
 *   - Fortschritts-Balken (erledigte Stopps / gesamt)
 *   - Schnell-Navigations-Links (Google Maps / Apple Maps)
 *   - Stopp-Abschluss-Zähler
 *
 * Mobile-first, deutsch, Matcha-Theme
 */

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, ChevronDown, ChevronUp, Clock, MapPin, Navigation, Package } from 'lucide-react';

interface OrderStop {
  id: string;
  batch_id: string;
  order_id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  angekommen_am?: string | null;
  order?: {
    id?: string;
    bestellnummer?: string;
    kunde_name?: string;
    kunde_adresse?: string | null;
    kunde_plz?: string | null;
    kunde_lat?: number | null;
    kunde_lng?: number | null;
    eta_earliest?: string | null;
    eta_latest?: string | null;
    gesamtbetrag?: number;
    zahlungsart?: string;
  } | null;
}

interface ActiveBatch {
  id: string;
  status: string;
  started_at?: string | null;
  total_eta_min?: number | null;
  stops: OrderStop[];
}

interface Props {
  activeBatch: ActiveBatch | null;
}

function fmtEta(isoStr: string | null | undefined, now: number): string | null {
  if (!isoStr) return null;
  const ms = new Date(isoStr).getTime() - now;
  const min = Math.round(ms / 60_000);
  if (Math.abs(min) > 120) return null;
  if (min < 0) return `+${Math.abs(min)} Min überfällig`;
  if (min === 0) return 'Jetzt';
  return `in ${min} Min`;
}

function buildNavUrl(order: OrderStop['order']): string | null {
  if (!order) return null;
  const addr = [order.kunde_adresse, order.kunde_plz].filter(Boolean).join(' ');
  if (!addr) return null;
  const encoded = encodeURIComponent(addr);
  // Prefer lat/lng if available
  if (order.kunde_lat && order.kunde_lng) {
    return `https://maps.google.com/?q=${order.kunde_lat},${order.kunde_lng}`;
  }
  return `https://maps.google.com/?q=${encoded}`;
}

export function FahrerPhase570TourAktivKommando({ activeBatch }: Props) {
  const [open, setOpen] = useState(true);
  const [, setTick] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setTick(n => n + 1), 10_000);
    return () => clearInterval(iv);
  }, []);

  const { sortedStops, completedStops, nextStop, progressPct } = useMemo(() => {
    if (!activeBatch) return { sortedStops: [], completedStops: 0, nextStop: null, progressPct: 0 };
    const sorted = [...activeBatch.stops].sort((a, b) => a.reihenfolge - b.reihenfolge);
    const done = sorted.filter(s => s.geliefert_am);
    const next = sorted.find(s => !s.geliefert_am) ?? null;
    const pct = sorted.length > 0 ? Math.round((done.length / sorted.length) * 100) : 0;
    return { sortedStops: sorted, completedStops: done.length, nextStop: next, progressPct: pct };
  }, [activeBatch]);

  if (!activeBatch || sortedStops.length === 0) return null;

  const now = Date.now();
  const totalStops = sortedStops.length;
  const nextOrder = nextStop?.order ?? null;
  const navUrl = buildNavUrl(nextOrder);
  const etaLabel = fmtEta(nextOrder?.eta_earliest, now);
  const etaEnd = fmtEta(nextOrder?.eta_latest, now);

  const etaTier = (() => {
    if (!nextOrder?.eta_latest) return 'normal';
    const ms = new Date(nextOrder.eta_latest).getTime() - now;
    if (ms < 0) return 'late';
    if (ms < 5 * 60_000) return 'tight';
    return 'normal';
  })();

  return (
    <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
      >
        <div className={cn(
          'flex h-9 w-9 items-center justify-center rounded-full shrink-0',
          etaTier === 'late'  ? 'bg-red-100 text-red-700'
          : etaTier === 'tight' ? 'bg-amber-100 text-amber-700'
          : 'bg-matcha-100 text-matcha-700',
        )}>
          <Navigation className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-black text-foreground">
            Stopp {completedStops + 1} von {totalStops}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {completedStops} erledigt · {totalStops - completedStops} ausstehend
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {/* Progress bar */}
      <div className="h-1.5 bg-muted/30 mx-4 rounded-full overflow-hidden">
        <div
          className="h-full bg-matcha-500 rounded-full transition-all duration-700"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {open && nextStop && (
        <div className="p-4 space-y-3">
          {/* Next stop card */}
          <div className={cn(
            'rounded-xl border p-3 space-y-2',
            etaTier === 'late'  ? 'bg-red-50 border-red-200'
            : etaTier === 'tight' ? 'bg-amber-50 border-amber-200'
            : 'bg-matcha-50 border-matcha-200',
          )}>
            <div className="flex items-start gap-2">
              <MapPin className={cn('h-4 w-4 shrink-0 mt-0.5',
                etaTier === 'late' ? 'text-red-600' : etaTier === 'tight' ? 'text-amber-600' : 'text-matcha-600',
              )} />
              <div className="flex-1 min-w-0">
                {nextOrder?.bestellnummer && (
                  <div className={cn('text-xs font-black font-mono',
                    etaTier === 'late' ? 'text-red-800' : etaTier === 'tight' ? 'text-amber-800' : 'text-matcha-800',
                  )}>
                    #{nextOrder.bestellnummer}
                  </div>
                )}
                {nextOrder?.kunde_name && (
                  <div className="text-sm font-bold text-foreground">{nextOrder.kunde_name}</div>
                )}
                {nextOrder?.kunde_adresse && (
                  <div className="text-xs text-muted-foreground">
                    {nextOrder.kunde_adresse}
                    {nextOrder.kunde_plz && `, ${nextOrder.kunde_plz}`}
                  </div>
                )}
              </div>
            </div>

            {/* ETA */}
            {(etaLabel || etaEnd) && (
              <div className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold',
                etaTier === 'late'  ? 'bg-red-100 text-red-800'
                : etaTier === 'tight' ? 'bg-amber-100 text-amber-800'
                : 'bg-matcha-100 text-matcha-800',
              )}>
                <Clock className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {etaLabel && `Von ${etaLabel}`}
                  {etaLabel && etaEnd && ' – '}
                  {etaEnd && `Bis ${etaEnd}`}
                </span>
              </div>
            )}

            {/* Navigate button */}
            {navUrl && (
              <a
                href={navUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white transition-opacity active:opacity-80',
                  etaTier === 'late' ? 'bg-red-600' : etaTier === 'tight' ? 'bg-amber-500' : 'bg-matcha-600',
                )}
              >
                <Navigation className="h-4 w-4" />
                Navigation starten
              </a>
            )}
          </div>

          {/* Stop list */}
          <div className="space-y-1.5">
            {sortedStops.map((stop, idx) => {
              const done = !!stop.geliefert_am;
              const isCurrent = !done && idx === completedStops;
              return (
                <div
                  key={stop.id}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-xs',
                    done       ? 'bg-matcha-50 border border-matcha-200 opacity-70'
                    : isCurrent ? 'bg-blue-50 border border-blue-200 font-bold'
                    : 'bg-muted/20 border border-transparent text-muted-foreground',
                  )}
                >
                  <div className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full shrink-0 text-[10px] font-black border-2',
                    done       ? 'bg-matcha-500 border-matcha-600 text-white'
                    : isCurrent ? 'bg-blue-500 border-blue-600 text-white'
                    : 'bg-muted border-muted-foreground/30 text-muted-foreground',
                  )}>
                    {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className={cn('truncate block', done && 'line-through')}>
                      {stop.order?.kunde_name ?? stop.order?.bestellnummer ?? `Stopp ${idx + 1}`}
                    </span>
                    {stop.order?.kunde_adresse && (
                      <span className="text-[10px] text-muted-foreground truncate block">
                        {stop.order.kunde_adresse}
                      </span>
                    )}
                  </div>
                  {done && (
                    <CheckCircle2 className="h-4 w-4 text-matcha-500 shrink-0" />
                  )}
                  {isCurrent && (
                    <span className="text-[10px] font-black text-blue-600 shrink-0">JETZT</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {open && !nextStop && (
        <div className="p-4 text-center space-y-2">
          <CheckCircle2 className="h-10 w-10 text-matcha-500 mx-auto" />
          <div className="text-sm font-black text-matcha-700">Alle Stopps erledigt!</div>
          <div className="text-xs text-muted-foreground">Tour abgeschlossen · Rückkehr zur Basis</div>
        </div>
      )}
    </div>
  );
}
