'use client';

import { useEffect, useState } from 'react';
import { cn, euro } from '@/lib/utils';
import { Route, Clock, Bike, TrendingUp, AlertTriangle, CheckCircle2, Star } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Batch {
  id: string;
  status: string;
  zone?: string | null;
  driver_id?: string | null;
  tour_score?: number | null;
  dispatch_score?: number | null;
  started_at?: string | null;
  eta_min?: number | null;
  gesamtumsatz?: number | null;
}

interface Stop {
  id: string;
  batch_id: string;
  status: string;
  adresse?: string | null;
  position?: number | null;
}

interface Driver {
  id: string;
  name?: string | null;
  vorname?: string | null;
  nachname?: string | null;
}

type ScoreTier = 'excellent' | 'good' | 'warning' | 'critical' | 'unknown';

function scoreTier(score: number | null | undefined): ScoreTier {
  if (score === null || score === undefined) return 'unknown';
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'warning';
  return 'critical';
}

const TIER = {
  excellent: { bar: 'bg-matcha-500',  label: 'bg-matcha-100 text-matcha-800',  border: 'border-matcha-200', text: 'Exzellent' },
  good:      { bar: 'bg-blue-500',    label: 'bg-blue-100 text-blue-800',       border: 'border-blue-200',   text: 'Gut'       },
  warning:   { bar: 'bg-amber-400',   label: 'bg-amber-100 text-amber-800',     border: 'border-amber-300',  text: 'Knapp'     },
  critical:  { bar: 'bg-red-500',     label: 'bg-red-100 text-red-700',         border: 'border-red-200',    text: 'Kritisch'  },
  unknown:   { bar: 'bg-stone-300',   label: 'bg-stone-100 text-stone-600',     border: 'border-stone-200',  text: 'Kein Score'},
} as const;

export function DispatchPhase1432TourScoreLiveCockpitUltra({
  batches,
  stops,
  drivers,
}: {
  batches: Batch[];
  stops: Stop[];
  drivers: Driver[];
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(iv);
  }, []);

  const active = batches.filter((b) => b.status === 'unterwegs' || b.status === 'in_lieferung');
  if (active.length === 0) return null;

  const rows = active.map((b) => {
    const driver = drivers.find((d) => d.id === b.driver_id);
    const driverName = driver?.name ?? [driver?.vorname, driver?.nachname].filter(Boolean).join(' ') ?? 'Fahrer';
    const batchStops = stops.filter((s) => s.batch_id === b.id);
    const totalStops = batchStops.length;
    const donestops = batchStops.filter((s) => s.status === 'zugestellt' || s.status === 'done').length;
    const score = b.tour_score ?? b.dispatch_score ?? null;
    const tier = scoreTier(score);
    const elapsedMin = b.started_at ? Math.floor((now - new Date(b.started_at).getTime()) / 60_000) : null;
    const remainMin = b.eta_min !== null && b.eta_min !== undefined && elapsedMin !== null
      ? Math.max(0, b.eta_min - elapsedMin)
      : null;
    return { b, driverName, totalStops, donestops, score, tier, elapsedMin, remainMin };
  }).sort((a, b) => {
    const ord: ScoreTier[] = ['critical', 'warning', 'unknown', 'good', 'excellent'];
    return ord.indexOf(a.tier) - ord.indexOf(b.tier);
  });

  const avgScore = rows.filter((r) => r.score !== null).length > 0
    ? Math.round(rows.reduce((s, r) => s + (r.score ?? 0), 0) / rows.filter((r) => r.score !== null).length)
    : null;

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-stone-50">
        <Route className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-[11px] font-black uppercase tracking-wider text-stone-600">
          Tour-Score · Live-Cockpit-Ultra
        </span>
        <Badge variant="secondary" className="ml-auto">
          {active.length} Tour{active.length !== 1 ? 'en' : ''}
        </Badge>
        {avgScore !== null && (
          <div className="flex items-center gap-1">
            <Star className="h-3 w-3 text-amber-500" />
            <span className="text-[11px] font-bold text-stone-700 tabular-nums">Ø {avgScore}</span>
          </div>
        )}
      </div>

      {/* Tour rows */}
      <div className="divide-y">
        {rows.map(({ b, driverName, totalStops, donestops, score, tier, elapsedMin, remainMin }) => {
          const cfg = TIER[tier];
          const pct = totalStops > 0 ? Math.round((donestops / totalStops) * 100) : 0;
          return (
            <div key={b.id} className={cn('px-4 py-3 flex flex-col gap-2', tier === 'critical' && 'bg-red-50/50')}>
              <div className="flex items-center gap-3">
                {/* Score badge */}
                <div className={cn('shrink-0 rounded-xl px-2.5 py-1 text-xs font-black min-w-[52px] text-center', cfg.label)}>
                  {score !== null ? score : '—'}
                </div>

                {/* Driver + zone */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Bike className="h-3 w-3 shrink-0 text-stone-500" />
                    <span className="text-sm font-bold truncate">{driverName}</span>
                    {b.zone && (
                      <span className="text-[9px] rounded-full bg-stone-100 border px-1.5 py-0.5 font-bold text-stone-600">
                        Zone {b.zone}
                      </span>
                    )}
                    <span className={cn('text-[10px] font-bold', cfg.label, 'rounded-full px-2 py-0.5')}>
                      {cfg.text}
                    </span>
                  </div>
                </div>

                {/* ETA */}
                <div className="shrink-0 text-right">
                  {remainMin !== null && (
                    <div className={cn(
                      'font-mono text-base font-black tabular-nums',
                      remainMin <= 5 ? 'text-red-600' : remainMin <= 15 ? 'text-amber-600' : 'text-matcha-700',
                    )}>
                      ~{remainMin}m
                    </div>
                  )}
                  {elapsedMin !== null && (
                    <div className="text-[9px] text-stone-400">{elapsedMin}m vergangen</div>
                  )}
                </div>
              </div>

              {/* Score bar + stop progress */}
              <div className="flex items-center gap-3">
                {/* Score bar */}
                <div className="flex-1 flex flex-col gap-0.5">
                  <div className="h-2 w-full rounded-full bg-stone-100 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-700', cfg.bar)}
                      style={{ width: `${score ?? 0}%` }}
                    />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[8px] text-stone-400">Score</span>
                    <span className="text-[8px] font-bold text-stone-500 tabular-nums">{score ?? 0}/100</span>
                  </div>
                </div>

                {/* Stop counter */}
                <div className="shrink-0 flex items-center gap-1.5">
                  <div className="flex gap-0.5">
                    {Array.from({ length: Math.min(totalStops, 6) }).map((_, i) => (
                      <div
                        key={i}
                        className={cn(
                          'h-3 w-3 rounded-full',
                          i < donestops ? 'bg-matcha-500' : 'bg-stone-200',
                        )}
                      />
                    ))}
                    {totalStops > 6 && <span className="text-[8px] text-stone-400">+{totalStops - 6}</span>}
                  </div>
                  <span className="text-[10px] font-bold text-stone-600 tabular-nums">
                    {donestops}/{totalStops}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer summary */}
      <div className="px-4 py-2 border-t bg-stone-50 flex items-center gap-3 flex-wrap">
        {(['excellent', 'good', 'warning', 'critical'] as ScoreTier[]).map((t) => {
          const count = rows.filter((r) => r.tier === t).length;
          if (count === 0) return null;
          return (
            <div key={t} className="flex items-center gap-1">
              <div className={cn('h-2 w-2 rounded-full', TIER[t].bar)} />
              <span className="text-[10px] font-bold text-stone-500">{count}× {TIER[t].text}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
