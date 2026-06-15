'use client';

import { useEffect, useState } from 'react';
import { Route, TrendingDown, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  batchId: string | null | undefined;
}

interface OptResult {
  improvementKm: number;
  improvementPct: number;
  algorithm: 'google_tsp' | 'nearest_neighbor' | 'two_opt';
  distanceBeforeKm: number;
  distanceAfterKm: number;
}

const ALGO_LABEL: Record<string, string> = {
  google_tsp: 'Google TSP',
  two_opt: '2-opt',
  nearest_neighbor: 'NN-Heuristik',
};

export function TourOptBadge({ batchId }: Props) {
  const [result, setResult] = useState<OptResult | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!batchId) { setChecked(true); return; }
    let active = true;
    fetch(`/api/delivery/admin/route-optimization?batch_id=${batchId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!active) return;
        // history[0] ist das neueste Log für diesen Batch
        const entry = d?.history?.[0];
        if (entry && entry.improvement_km > 0.05) {
          setResult({
            improvementKm: entry.improvement_km,
            improvementPct: entry.improvement_pct,
            algorithm: entry.algorithm,
            distanceBeforeKm: entry.distance_before_km,
            distanceAfterKm: entry.distance_after_km,
          });
        }
        setChecked(true);
      })
      .catch(() => setChecked(true));
    return () => { active = false; };
  }, [batchId]);

  if (!checked || !result) return null;

  const isGreat = result.improvementPct >= 15;
  const isGood = result.improvementPct >= 5;

  return (
    <div className={cn(
      'flex items-center gap-3 rounded-xl border px-3 py-2.5',
      isGreat
        ? 'border-accent/40 bg-accent/8'
        : isGood
        ? 'border-blue-500/30 bg-blue-500/8'
        : 'border-white/10 bg-white/5',
    )}>
      <div className={cn(
        'h-8 w-8 rounded-lg flex items-center justify-center shrink-0',
        isGreat ? 'bg-accent/20' : isGood ? 'bg-blue-500/20' : 'bg-white/10',
      )}>
        <Route size={14} className={isGreat ? 'text-accent' : isGood ? 'text-blue-400' : 'text-matcha-400'} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={cn(
            'text-[11px] font-black',
            isGreat ? 'text-accent' : isGood ? 'text-blue-400' : 'text-matcha-300',
          )}>
            Route optimiert
          </span>
          {isGreat && <Zap size={10} className="text-accent" />}
        </div>
        <div className="text-[9px] text-matcha-500 mt-0.5">
          {result.distanceBeforeKm.toFixed(1)} km → {result.distanceAfterKm.toFixed(1)} km
          {' · '}{ALGO_LABEL[result.algorithm] ?? result.algorithm}
        </div>
      </div>

      <div className="flex flex-col items-end shrink-0">
        <div className={cn(
          'text-sm font-black tabular-nums',
          isGreat ? 'text-accent' : isGood ? 'text-blue-400' : 'text-matcha-400',
        )}>
          −{result.improvementPct.toFixed(0)}%
        </div>
        <div className="flex items-center gap-0.5 text-[9px] text-matcha-500">
          <TrendingDown size={8} />
          {result.improvementKm.toFixed(1)} km
        </div>
      </div>
    </div>
  );
}
