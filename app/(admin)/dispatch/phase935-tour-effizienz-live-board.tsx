'use client';

import { useMemo } from 'react';
import { cn, euro } from '@/lib/utils';
import { Route, Clock, TrendingUp, MapPin, Star, CheckCircle2, Loader2, Navigation } from 'lucide-react';

interface BatchStop {
  id: string;
  order_id: string;
  reihenfolge: number;
  angekommen_am: string | null;
  geliefert_am: string | null;
  order: {
    bestellnummer: string;
    kunde_name: string;
    kunde_adresse: string | null;
    eta_earliest?: string | null;
    eta_latest?: string | null;
    gesamtbetrag?: number;
  } | null;
}

interface Batch {
  id: string;
  status: string;
  fahrer_id: string | null;
  startzeit?: string | null;
  started_at?: string | null;
  total_distance_km: number | null;
  total_eta_min: number | null;
  zone: string | null;
  fahrer: { vorname: string; nachname: string } | null;
  stops: BatchStop[];
}

interface Props {
  batches: Batch[];
}

type TourHealth = 'top' | 'gut' | 'mäßig' | 'kritisch';

function getTourHealth(batch: Batch, elapsedMin: number): TourHealth {
  const pct = getProgressPct(batch);
  if (pct > 90) return 'top';
  const expectedPct = batch.total_eta_min ? (elapsedMin / batch.total_eta_min) * 100 : 50;
  const diff = pct - expectedPct;
  if (diff >= -5) return 'gut';
  if (diff >= -15) return 'mäßig';
  return 'kritisch';
}

function getProgressPct(batch: Batch): number {
  const total = batch.stops.length;
  if (!total) return 0;
  const done = batch.stops.filter(s => s.geliefert_am).length;
  return Math.round((done / total) * 100);
}

function getElapsedMin(batch: Batch): number {
  const start = batch.startzeit || batch.started_at;
  if (!start) return 0;
  return Math.floor((Date.now() - new Date(start).getTime()) / 60_000);
}

function getEtaScore(batch: Batch, elapsedMin: number): number {
  if (!batch.total_eta_min) return 75;
  const expectedDone = (elapsedMin / batch.total_eta_min) * batch.stops.length;
  const actualDone = batch.stops.filter(s => s.geliefert_am).length;
  const raw = 50 + ((actualDone - expectedDone) / Math.max(1, batch.stops.length)) * 50;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

const healthStyle: Record<TourHealth, { bg: string; badge: string; text: string; bar: string }> = {
  top: { bg: 'bg-matcha-50 border-matcha-200', badge: 'bg-matcha-600 text-white', text: 'text-matcha-700', bar: 'bg-matcha-500' },
  gut: { bg: 'bg-blue-50 border-blue-200', badge: 'bg-blue-600 text-white', text: 'text-blue-700', bar: 'bg-blue-500' },
  mäßig: { bg: 'bg-amber-50 border-amber-200', badge: 'bg-amber-500 text-white', text: 'text-amber-700', bar: 'bg-amber-500' },
  kritisch: { bg: 'bg-red-50 border-red-200', badge: 'bg-red-600 text-white', text: 'text-red-700', bar: 'bg-red-500' },
};

export function DispatchPhase935TourEffizienzLiveBoard({ batches }: Props) {
  const activeBatches = useMemo(
    () => batches.filter(b => ['on_route', 'unterwegs', 'at_restaurant', 'pickup', 'assigned', 'zugewiesen'].includes(b.status)),
    [batches],
  );

  if (activeBatches.length === 0) return null;

  const rows = activeBatches.map(batch => {
    const elapsedMin = getElapsedMin(batch);
    const pct = getProgressPct(batch);
    const health = getTourHealth(batch, elapsedMin);
    const etaScore = getEtaScore(batch, elapsedMin);
    const completedStops = batch.stops.filter(s => s.geliefert_am).length;
    const pendingStops = batch.stops.filter(s => !s.geliefert_am);
    const nextStop = pendingStops[0] ?? null;
    const driverName = batch.fahrer
      ? `${batch.fahrer.vorname} ${batch.fahrer.nachname}`
      : 'Unbekannt';
    const remainMin = batch.total_eta_min ? Math.max(0, batch.total_eta_min - elapsedMin) : null;

    return { batch, elapsedMin, pct, health, etaScore, completedStops, pendingStops, nextStop, driverName, remainMin };
  }).sort((a, b) => {
    const order: Record<TourHealth, number> = { kritisch: 0, mäßig: 1, gut: 2, top: 3 };
    return order[a.health] - order[b.health];
  });

  const avgScore = Math.round(rows.reduce((s, r) => s + r.etaScore, 0) / rows.length);

  return (
    <div className="rounded-xl border border-stone-200 bg-white shadow-subtle overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 bg-gradient-to-r from-blue-50 to-white">
        <div className="flex items-center gap-2">
          <Route className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-bold text-stone-800">Tour-Effizienz Live</span>
          <span className="text-xs text-stone-400">· Score & Fortschritt</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Star className="w-3 h-3 text-amber-500" />
            <span className="text-sm font-black tabular-nums text-stone-800">{avgScore}</span>
            <span className="text-xs text-stone-400">Ø Score</span>
          </div>
          <span className="text-xs text-stone-400">{activeBatches.length} aktive Touren</span>
        </div>
      </div>

      {/* Tour rows */}
      <div className="divide-y divide-stone-100">
        {rows.map(({ batch, elapsedMin, pct, health, etaScore, completedStops, pendingStops, nextStop, driverName, remainMin }) => {
          const hs = healthStyle[health];
          return (
            <div key={batch.id} className={cn('px-4 py-3', hs.bg, 'border-l-2', hs.badge.includes('matcha') ? 'border-matcha-500' : hs.badge.includes('blue') ? 'border-blue-500' : hs.badge.includes('amber') ? 'border-amber-500' : 'border-red-500')}>
              <div className="flex items-start gap-3">
                {/* Score ring */}
                <div className="shrink-0 flex flex-col items-center gap-1">
                  <div className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center text-sm font-black',
                    etaScore >= 80 ? 'bg-matcha-100 text-matcha-700' :
                    etaScore >= 60 ? 'bg-blue-100 text-blue-700' :
                    etaScore >= 40 ? 'bg-amber-100 text-amber-700' :
                    'bg-red-100 text-red-700'
                  )}>
                    {etaScore}
                  </div>
                  <span className={cn('text-[9px] font-bold rounded-full px-1.5 py-0.5', hs.badge)}>
                    {health === 'top' ? 'TOP' : health === 'gut' ? 'GUT' : health === 'mäßig' ? 'MÄßIG' : 'KRIT.'}
                  </span>
                </div>

                {/* Main content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-bold text-stone-800 truncate">{driverName}</span>
                    {batch.zone && (
                      <span className="text-[9px] font-bold bg-stone-100 text-stone-600 rounded px-1.5 py-0.5">
                        Zone {batch.zone}
                      </span>
                    )}
                    <span className="text-[10px] text-stone-500">
                      {completedStops}/{batch.stops.length} Stopps
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex-1 h-2 rounded-full bg-stone-200 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-700', hs.bar)}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-black tabular-nums text-stone-700 shrink-0">{pct}%</span>
                  </div>

                  {/* Next stop */}
                  {nextStop?.order && (
                    <div className="flex items-center gap-1.5 text-[11px] text-stone-600">
                      <Navigation className="w-3 h-3 text-blue-500 shrink-0" />
                      <span className="truncate">
                        Nächster: {nextStop.order.kunde_adresse ?? nextStop.order.kunde_name}
                      </span>
                    </div>
                  )}

                  {/* Stops detail */}
                  {pendingStops.length > 0 && (
                    <div className="mt-1.5 flex gap-1 flex-wrap">
                      {batch.stops.map((stop, idx) => (
                        <div
                          key={stop.id}
                          className={cn(
                            'w-5 h-5 rounded-full text-[9px] font-black flex items-center justify-center',
                            stop.geliefert_am
                              ? 'bg-matcha-500 text-white'
                              : idx === completedStops
                              ? 'bg-blue-500 text-white animate-pulse'
                              : 'bg-stone-200 text-stone-500'
                          )}
                        >
                          {idx + 1}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Time */}
                <div className="shrink-0 text-right">
                  <div className="font-mono text-lg font-black tabular-nums text-stone-800">
                    {elapsedMin}m
                  </div>
                  {remainMin !== null && (
                    <div className={cn('text-[10px] font-bold tabular-nums', hs.text)}>
                      ~{remainMin}m übrig
                    </div>
                  )}
                  {batch.total_distance_km && (
                    <div className="text-[9px] text-stone-400 tabular-nums mt-0.5">
                      {batch.total_distance_km.toFixed(1)} km
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-stone-50 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-matcha-500" />
            {rows.filter(r => r.health === 'top' || r.health === 'gut').length} im Plan
          </span>
          {rows.filter(r => r.health === 'kritisch').length > 0 && (
            <span className="text-red-600 font-semibold">
              ⚠ {rows.filter(r => r.health === 'kritisch').length} kritisch
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <TrendingUp className="w-3 h-3" />
          <span>Effizienz-Score</span>
        </div>
      </div>
    </div>
  );
}
