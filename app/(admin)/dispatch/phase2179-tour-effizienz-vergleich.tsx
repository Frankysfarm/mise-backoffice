'use client';

/**
 * Phase 2179 – Tour-Effizienz-Vergleichsmatrix
 * Vergleicht alle aktiven Touren nach Stoppeffizienz, Pünktlichkeit
 * und Rückgabeprognose — sortiert nach Gesamt-Score.
 */

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { ArrowUpDown, Bike, CheckCircle2, Clock, Timer, TrendingDown, TrendingUp, Zap } from 'lucide-react';

interface TourRow {
  id: string;
  driverName: string;
  totalStops: number;
  doneStops: number;
  elapsedMin: number;
  onTimeRate: number;
  etaMin: number | null;
}

function efficiencyScore(t: TourRow): number {
  const completionPct = t.totalStops > 0 ? t.doneStops / t.totalStops : 0;
  const pace = t.totalStops > 0 && t.elapsedMin > 0
    ? Math.min(1, (t.doneStops / t.elapsedMin) / 0.15)
    : 0.5;
  return Math.round((completionPct * 0.4 + t.onTimeRate * 0.4 + pace * 0.2) * 100);
}

const MOCK_TOURS: TourRow[] = [
  { id: 't1', driverName: 'Max M.', totalStops: 5, doneStops: 3, elapsedMin: 28, onTimeRate: 0.95, etaMin: 12 },
  { id: 't2', driverName: 'Sarah K.', totalStops: 4, doneStops: 1, elapsedMin: 10, onTimeRate: 0.8, etaMin: 35 },
  { id: 't3', driverName: 'Ali R.', totalStops: 3, doneStops: 3, elapsedMin: 40, onTimeRate: 1.0, etaMin: 5 },
  { id: 't4', driverName: 'Tom S.', totalStops: 4, doneStops: 2, elapsedMin: 22, onTimeRate: 0.65, etaMin: 20 },
];

export function DispatchPhase2179TourEffizienzVergleich() {
  const supabase = createClient();
  const [tours, setTours] = useState<TourRow[]>([]);
  const [useMock, setUseMock] = useState(false);
  const [sortBy, setSortBy] = useState<'score' | 'eta'>('score');

  useEffect(() => {
    async function load() {
      const { data: batches, error } = await supabase
        .from('mise_delivery_batches')
        .select('id, started_at, state, driver:mise_drivers(name)')
        .in('state', ['active', 'returning'])
        .limit(8);

      if (error || !batches || batches.length === 0) {
        setUseMock(true);
        setTours(MOCK_TOURS);
        return;
      }

      const { data: orders } = await supabase
        .from('customer_orders')
        .select('mise_batch_id, status, verspaetungs_minuten')
        .in('mise_batch_id', batches.map((b) => b.id));

      const rows: TourRow[] = batches.map((b) => {
        const bOrders = (orders ?? []).filter((o) => o.mise_batch_id === b.id);
        const total = bOrders.length;
        const done = bOrders.filter((o) => ['geliefert', 'abgeholt_extern'].includes(o.status)).length;
        const elapsed = b.started_at
          ? Math.round((Date.now() - new Date(b.started_at).getTime()) / 60_000)
          : 0;
        const onTime = total > 0
          ? bOrders.filter((o) => !o.verspaetungs_minuten || o.verspaetungs_minuten <= 0).length / total
          : 0.8;
        const driver = Array.isArray(b.driver) ? b.driver[0] : b.driver;

        return {
          id: b.id,
          driverName: driver?.name ?? 'Fahrer',
          totalStops: total,
          doneStops: done,
          elapsedMin: elapsed,
          onTimeRate: onTime,
          etaMin: total > done ? Math.round(((total - done) * 8) * (1 - onTime * 0.2)) : 5,
        };
      });

      setTours(rows);
      setUseMock(false);
    }

    load();
    const channel = supabase
      .channel('phase2179-tours')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mise_delivery_batches' }, load)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabase]);

  const sorted = [...tours].sort((a, b) =>
    sortBy === 'score'
      ? efficiencyScore(b) - efficiencyScore(a)
      : (a.etaMin ?? 99) - (b.etaMin ?? 99),
  );

  return (
    <div className="rounded-2xl border border-matcha-100 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-matcha-100 bg-matcha-50/50">
        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4 text-matcha-600" />
          <span className="text-sm font-semibold text-matcha-800">Tour-Effizienz-Vergleich</span>
        </div>
        <div className="flex items-center gap-1.5">
          {useMock && <span className="text-xs text-matcha-400 italic">Demo</span>}
          <button
            onClick={() => setSortBy(sortBy === 'score' ? 'eta' : 'score')}
            className="text-xs text-matcha-500 bg-matcha-100 hover:bg-matcha-200 px-2 py-0.5 rounded-full transition-colors"
          >
            {sortBy === 'score' ? 'nach Score' : 'nach ETA'}
          </button>
        </div>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-5 gap-2 px-4 py-2 text-[10px] font-semibold text-matcha-400 uppercase tracking-wide border-b border-matcha-50">
        <span className="col-span-2">Fahrer</span>
        <span className="text-center">Stopps</span>
        <span className="text-center">Pünktl.</span>
        <span className="text-center">Score</span>
      </div>

      {/* Rows */}
      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-matcha-400">
          <Bike className="h-7 w-7 mb-2 opacity-30" />
          <p className="text-sm">Keine aktiven Touren</p>
        </div>
      ) : (
        <div className="divide-y divide-matcha-50">
          {sorted.map((t, idx) => {
            const score = efficiencyScore(t);
            const scoreColor = score >= 80 ? 'text-emerald-600' : score >= 60 ? 'text-amber-600' : 'text-red-600';
            const scoreBg = score >= 80 ? 'bg-emerald-50' : score >= 60 ? 'bg-amber-50' : 'bg-red-50';
            const progressPct = t.totalStops > 0 ? (t.doneStops / t.totalStops) * 100 : 0;

            return (
              <div key={t.id} className="grid grid-cols-5 gap-2 px-4 py-3 items-center">
                {/* Rank + Name */}
                <div className="col-span-2 flex items-center gap-2 min-w-0">
                  <span className={cn(
                    'text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0',
                    idx === 0 ? 'bg-amber-100 text-amber-700' : 'bg-matcha-100 text-matcha-600',
                  )}>
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-matcha-800 truncate">{t.driverName}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <div className="flex-1 h-1 bg-matcha-100 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-amber-400' : 'bg-red-500',
                          )}
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stopps */}
                <div className="text-center">
                  <span className="text-xs font-semibold text-matcha-700 tabular-nums">
                    {t.doneStops}/{t.totalStops}
                  </span>
                  {t.etaMin !== null && (
                    <div className="flex items-center justify-center gap-0.5 mt-0.5">
                      <Clock className="h-2.5 w-2.5 text-matcha-400" />
                      <span className="text-[10px] text-matcha-400">{t.etaMin} min</span>
                    </div>
                  )}
                </div>

                {/* Pünktlichkeit */}
                <div className="text-center">
                  <span className={cn(
                    'text-xs font-semibold tabular-nums',
                    t.onTimeRate >= 0.9 ? 'text-emerald-600' :
                    t.onTimeRate >= 0.75 ? 'text-amber-600' : 'text-red-600',
                  )}>
                    {Math.round(t.onTimeRate * 100)}%
                  </span>
                  <div className="flex justify-center mt-0.5">
                    {t.onTimeRate >= 0.9
                      ? <TrendingUp className="h-3 w-3 text-emerald-500" />
                      : t.onTimeRate >= 0.75
                      ? <CheckCircle2 className="h-3 w-3 text-amber-500" />
                      : <TrendingDown className="h-3 w-3 text-red-500" />}
                  </div>
                </div>

                {/* Score */}
                <div className="text-center">
                  <span className={cn(
                    'text-sm font-bold tabular-nums px-1.5 py-0.5 rounded',
                    scoreColor, scoreBg,
                  )}>
                    {score}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-matcha-100 bg-matcha-50/30 flex items-center gap-2">
        <Timer className="h-3 w-3 text-matcha-400" />
        <span className="text-xs text-matcha-500">Echtzeit-Aktualisierung</span>
        <Zap className="h-3 w-3 text-matcha-400 ml-auto" />
      </div>
    </div>
  );
}
