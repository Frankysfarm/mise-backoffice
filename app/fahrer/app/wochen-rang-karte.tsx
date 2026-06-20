'use client';

import { useEffect, useState } from 'react';
import { Trophy, Star, Zap, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

type PerfData = {
  rank?: number | null;
  compositeScore?: number | null;
  grade?: string | null;
  deliveries?: number | null;
  onTimeRate?: number | null;
  avgRating?: number | null;
  totalEarningsEur?: number | null;
  bonusPending?: boolean;
  bonusEur?: number | null;
};

const GRADE_BG: Record<string, string> = {
  'S+': 'bg-amber-400',
  S: 'bg-amber-400',
  A: 'bg-matcha-500',
  B: 'bg-blue-500',
  C: 'bg-stone-400',
  D: 'bg-red-400',
};

const RANK_SUFFIX = (n: number) => {
  if (n === 1) return '🥇';
  if (n === 2) return '🥈';
  if (n === 3) return '🥉';
  return `#${n}`;
};

export function FahrerWochenRangKarte() {
  const [data, setData] = useState<PerfData | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/delivery/driver/my-performance?period=week&days=7');
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) {
          setData({
            rank: json.rank ?? null,
            compositeScore: json.compositeScore ?? json.score ?? null,
            grade: json.grade ?? null,
            deliveries: json.deliveries ?? json.stopsCompleted ?? null,
            onTimeRate: json.onTimeRate ?? null,
            avgRating: json.avgRating ?? null,
            totalEarningsEur: json.totalEarningsEur ?? null,
            bonusPending: json.bonusPending ?? false,
            bonusEur: json.bonusEur ?? null,
          });
        }
      } catch { /* noop */ }
    }
    load();
    const iv = setInterval(load, 10 * 60_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  if (!data) return null;

  const score = data.compositeScore ?? 0;
  const grade = data.grade ?? 'C';
  const gradeBg = GRADE_BG[grade] ?? 'bg-stone-400';

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border-b border-amber-100">
        <Trophy className="h-4 w-4 text-amber-500 shrink-0" />
        <span className="text-xs font-bold text-stone-700 uppercase tracking-wider">Dein Wochen-Rang</span>
        {data.bonusPending && data.bonusEur && (
          <span className="ml-auto text-[10px] font-black text-amber-600 bg-amber-100 rounded-full px-2 py-0.5">
            +{data.bonusEur.toFixed(0)} € Prämie
          </span>
        )}
      </div>

      <div className="px-4 py-4 flex items-center gap-4">
        {/* Rank bubble */}
        <div className="shrink-0 h-16 w-16 rounded-full bg-amber-50 border-2 border-amber-200 flex flex-col items-center justify-center">
          <div className="text-xl leading-none">
            {data.rank != null ? RANK_SUFFIX(data.rank) : '—'}
          </div>
          {data.rank != null && data.rank > 3 && (
            <div className="text-[10px] font-bold text-stone-500 -mt-0.5">Rang</div>
          )}
        </div>

        {/* Score section */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className={cn('rounded-full px-2.5 py-1 text-sm font-black text-white', gradeBg)}>
              {grade}
            </span>
            <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-700',
                  score >= 85 ? 'bg-matcha-500' : score >= 70 ? 'bg-amber-400' : 'bg-red-400',
                )}
                style={{ width: `${Math.min(100, score)}%` }}
              />
            </div>
            <span className="text-sm font-black tabular-nums text-stone-800 shrink-0">{score.toFixed(0)}</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {data.deliveries != null && (
              <div className="text-center">
                <div className="text-sm font-black text-stone-800 tabular-nums">{data.deliveries}</div>
                <div className="text-[9px] text-stone-400">Lieferungen</div>
              </div>
            )}
            {data.onTimeRate != null && (
              <div className="text-center">
                <div className={cn('text-sm font-black tabular-nums',
                  data.onTimeRate >= 90 ? 'text-matcha-600' : data.onTimeRate >= 75 ? 'text-amber-500' : 'text-red-500',
                )}>
                  {data.onTimeRate.toFixed(0)}%
                </div>
                <div className="text-[9px] text-stone-400 flex items-center justify-center gap-0.5">
                  <Zap className="h-2.5 w-2.5" />Pünktlich
                </div>
              </div>
            )}
            {data.avgRating != null && (
              <div className="text-center">
                <div className="text-sm font-black tabular-nums text-amber-500 flex items-center justify-center gap-0.5">
                  <Star className="h-3 w-3 fill-amber-400" />
                  {data.avgRating.toFixed(1)}
                </div>
                <div className="text-[9px] text-stone-400">Bewertung</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {data.totalEarningsEur != null && (
        <div className="mx-4 mb-4 rounded-xl bg-matcha-50 px-3 py-2 flex items-center gap-2">
          <TrendingUp className="h-3.5 w-3.5 text-matcha-600 shrink-0" />
          <span className="text-xs text-matcha-700 font-semibold">
            Diese Woche: <strong>{data.totalEarningsEur.toFixed(2)} €</strong> Einnahmen
          </span>
        </div>
      )}
    </div>
  );
}
