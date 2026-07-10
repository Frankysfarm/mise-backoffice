'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Trophy, Star, TrendingUp, Bike, Clock, MapPin, Zap } from 'lucide-react';

interface Driver {
  id: string;
  name?: string;
  full_name?: string;
  status?: { ist_online?: boolean; state?: string } | string;
  score?: number;
}

interface Batch {
  id: string;
  driver_id?: string | null;
  driver?: { id: string; name?: string };
  status?: string;
  zone?: string | null;
  total_orders?: number;
  created_at?: string;
  dispatched_at?: string;
  estimated_return_at?: string;
}

interface Props {
  drivers: Driver[];
  batches: Batch[];
  locationId?: string | null;
}

interface DriverScore {
  id: string;
  score: number;
  deliveries_today: number;
  on_time_pct: number;
}

function ScoreBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="h-1.5 rounded-full bg-stone-100 overflow-hidden flex-1">
      <div className={cn('h-full rounded-full transition-all duration-700', color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

function scoreColor(score: number): string {
  if (score >= 85) return 'text-matcha-700';
  if (score >= 70) return 'text-amber-600';
  return 'text-red-600';
}

function scoreBarColor(score: number): string {
  if (score >= 85) return 'bg-matcha-500';
  if (score >= 70) return 'bg-amber-400';
  return 'bg-red-400';
}

export function DispatchPhase1090TourScoreLiveBoard({ drivers, batches, locationId }: Props) {
  const [scores, setScores] = useState<DriverScore[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!locationId) return;
    setLoading(true);
    fetch(`/api/delivery/dispatch/scores?location_id=${locationId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.scores) setScores(d.scores);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [locationId]);

  const onlineDrivers = drivers.filter(d => {
    const s = d.status;
    if (!s) return false;
    if (typeof s === 'string') return s !== 'offline';
    return s.ist_online !== false && s.state !== 'offline';
  });

  const activeBatches = batches.filter(b =>
    b.status && !['delivered', 'completed', 'cancelled'].includes(b.status)
  );

  if (onlineDrivers.length === 0 && activeBatches.length === 0) return null;

  // Build rows: merge driver list with score data
  const rows = onlineDrivers.slice(0, 8).map(driver => {
    const scoreData = scores.find(s => s.id === driver.id);
    const activeTour = activeBatches.find(b => b.driver_id === driver.id || b.driver?.id === driver.id);
    const score = scoreData?.score ?? driver.score ?? 0;
    const name = driver.name ?? driver.full_name ?? `Fahrer ${driver.id.slice(-4)}`;

    let tourElapsedMin: number | null = null;
    if (activeTour?.dispatched_at) {
      tourElapsedMin = Math.round((Date.now() - new Date(activeTour.dispatched_at).getTime()) / 60_000);
    }

    return { driver, name, score, scoreData, activeTour, tourElapsedMin };
  }).sort((a, b) => b.score - a.score);

  const avgScore = rows.length > 0
    ? Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length)
    : 0;

  return (
    <div className="mx-4 my-2 rounded-2xl border border-stone-200 bg-white overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-stone-50 border-b border-stone-200">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-500" />
          <span className="text-xs font-black uppercase tracking-wider text-stone-600">Tour Score — Fahrer Live-Rangliste</span>
        </div>
        <div className="flex items-center gap-3">
          {avgScore > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-stone-500">
              <Star className="w-3 h-3" /> Ø {avgScore}
            </span>
          )}
          <span className="text-[10px] text-stone-400">{onlineDrivers.length} online · {activeBatches.length} Touren</span>
        </div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-stone-100">
        {rows.map(({ driver, name, score, scoreData, activeTour, tourElapsedMin }, idx) => (
          <div key={driver.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-stone-50 transition-colors">
            {/* Rank */}
            <div className={cn(
              'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0',
              idx === 0 ? 'bg-amber-400 text-white' :
              idx === 1 ? 'bg-stone-300 text-stone-700' :
              idx === 2 ? 'bg-orange-300 text-white' :
              'bg-stone-100 text-stone-500'
            )}>
              {idx + 1}
            </div>

            {/* Name + Tour Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-stone-800 truncate">{name}</span>
                {activeTour && (
                  <span className="flex items-center gap-0.5 text-[9px] font-bold bg-blue-50 text-blue-600 border border-blue-200 rounded-full px-1.5 py-0.5 shrink-0">
                    <Bike className="w-2.5 h-2.5" />
                    {activeTour.zone ? `Zone ${activeTour.zone}` : 'Unterwegs'}
                    {tourElapsedMin !== null && ` · ${tourElapsedMin}m`}
                  </span>
                )}
                {!activeTour && (
                  <span className="text-[9px] text-matcha-600 bg-matcha-50 border border-matcha-200 rounded-full px-1.5 py-0.5 shrink-0">Verfügbar</span>
                )}
              </div>
              {/* Score bar */}
              <div className="flex items-center gap-2 mt-1">
                <ScoreBar value={score} color={scoreBarColor(score)} />
                {scoreData?.on_time_pct !== undefined && (
                  <span className="text-[8px] text-stone-400 shrink-0 tabular-nums">
                    {Math.round(scoreData.on_time_pct)}% pünktl.
                  </span>
                )}
              </div>
            </div>

            {/* Score badge */}
            <div className="shrink-0 text-right">
              <div className={cn('text-base font-black tabular-nums leading-none', scoreColor(score))}>
                {score > 0 ? score : '—'}
              </div>
              <div className="text-[8px] text-stone-400">Punkte</div>
              {scoreData?.deliveries_today !== undefined && (
                <div className="text-[8px] text-stone-400 tabular-nums">{scoreData.deliveries_today}×</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Active Tours Summary */}
      {activeBatches.length > 0 && (
        <div className="px-4 py-2 bg-blue-50 border-t border-blue-100 flex items-center gap-2 flex-wrap">
          <TrendingUp className="w-3 h-3 text-blue-500 shrink-0" />
          <span className="text-[10px] font-bold text-blue-700">{activeBatches.length} aktive Tour{activeBatches.length !== 1 ? 'en' : ''} gerade unterwegs</span>
          {activeBatches.map(b => (
            <span key={b.id} className="text-[9px] bg-white border border-blue-200 text-blue-600 rounded-full px-2 py-0.5 font-medium">
              {b.zone ? `Zone ${b.zone}` : b.id.slice(-5)}
              {b.total_orders ? ` (${b.total_orders}×)` : ''}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
