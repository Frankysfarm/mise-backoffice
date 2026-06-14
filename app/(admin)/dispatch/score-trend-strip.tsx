'use client';

/**
 * DispatchScoreTrendStrip — Zeigt den Verlauf des Dispatch-Scores in der aktuellen Schicht.
 * Ruft dispatch_scores aus Supabase ab und visualisiert den Trend als Sparkline.
 * Farb-coded: ≥75 = grün, ≥55 = amber, <55 = rot.
 */

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Award, TrendingDown, TrendingUp, Minus } from 'lucide-react';

type ScorePoint = {
  hour: number;
  avg: number;
  count: number;
};

function scoreColor(score: number) {
  if (score >= 75) return 'text-matcha-700 bg-matcha-50 border-matcha-200';
  if (score >= 55) return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-red-700 bg-red-50 border-red-200';
}

function barColor(score: number) {
  if (score >= 75) return 'bg-matcha-500';
  if (score >= 55) return 'bg-amber-400';
  return 'bg-red-400';
}

export function DispatchScoreTrendStrip({
  locationId,
}: {
  locationId?: string | null;
}) {
  const supabase = createClient();
  const [points, setPoints] = useState<ScorePoint[]>([]);
  const [overallAvg, setOverallAvg] = useState<number | null>(null);
  const [prevHourAvg, setPrevHourAvg] = useState<number | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    const load = async () => {
      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);

      let q = supabase
        .from('dispatch_scores')
        .select('total_score, created_at')
        .gte('created_at', todayStart.toISOString())
        .not('total_score', 'is', null)
        .order('created_at', { ascending: true });

      if (locationId) q = q.eq('location_id', locationId);

      const { data } = await q;
      if (!data || !mountedRef.current) return;

      // Bucket by hour
      const byHour: Record<number, number[]> = {};
      for (const row of data) {
        const h = new Date(row.created_at).getHours();
        if (!byHour[h]) byHour[h] = [];
        byHour[h].push(row.total_score as number);
      }

      const nowH = now.getHours();
      const buckets: ScorePoint[] = [];
      for (let h = Math.max(0, nowH - 7); h <= nowH; h++) {
        const vals = byHour[h] ?? [];
        buckets.push({
          hour: h,
          avg: vals.length > 0 ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : 0,
          count: vals.length,
        });
      }

      setPoints(buckets);

      // Overall avg
      const allScores = data.map((r) => r.total_score as number);
      if (allScores.length > 0) {
        setOverallAvg(Math.round(allScores.reduce((s, v) => s + v, 0) / allScores.length));
      }

      // Previous hour avg vs current hour avg
      const prevH = nowH - 1;
      const prevVals = byHour[prevH] ?? [];
      const curVals = byHour[nowH] ?? [];
      if (prevVals.length > 0 && curVals.length > 0) {
        setPrevHourAvg(Math.round(prevVals.reduce((s, v) => s + v, 0) / prevVals.length));
      } else {
        setPrevHourAvg(null);
      }
    };

    load();
    const iv = setInterval(load, 5 * 60_000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const validPoints = points.filter((p) => p.count > 0);
  if (validPoints.length === 0) return null;

  const maxScore = Math.max(100, ...validPoints.map((p) => p.avg));
  const currentHourAvg = validPoints[validPoints.length - 1]?.avg ?? null;
  const trend =
    prevHourAvg !== null && currentHourAvg !== null ? currentHourAvg - prevHourAvg : null;

  return (
    <div className={cn('rounded-xl border px-4 py-3 space-y-2', overallAvg != null ? scoreColor(overallAvg) : 'border-stone-200 bg-white')}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Award className="h-3.5 w-3.5 shrink-0" />
          <span className="text-[10px] font-black uppercase tracking-wider opacity-70">
            Dispatch-Score Trend heute
          </span>
        </div>
        <div className="flex items-center gap-2">
          {trend !== null && (
            <span className="flex items-center gap-0.5 text-[10px] font-bold">
              {trend > 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : trend < 0 ? (
                <TrendingDown className="h-3 w-3" />
              ) : (
                <Minus className="h-3 w-3" />
              )}
              {trend > 0 ? '+' : ''}{trend} vs. letzte Std
            </span>
          )}
          {overallAvg !== null && (
            <span className="text-lg font-black tabular-nums leading-none">
              {overallAvg}
            </span>
          )}
        </div>
      </div>

      {/* Sparkline bars */}
      <div className="flex items-end gap-1 h-10">
        {points.map((p) => {
          const hasData = p.count > 0;
          const height = hasData ? Math.max(6, Math.round((p.avg / maxScore) * 100)) : 4;
          return (
            <div
              key={p.hour}
              className="flex-1 flex flex-col items-center justify-end gap-0.5"
              title={hasData ? `${p.hour}:00 — Score ⌀${p.avg} (${p.count} Entscheidungen)` : `${p.hour}:00 — keine Daten`}
            >
              <div
                className={cn(
                  'w-full rounded-t-sm transition-all',
                  hasData ? barColor(p.avg) : 'bg-stone-100',
                )}
                style={{ height: `${height}%` }}
              />
              <span className="text-[8px] tabular-nums font-bold opacity-60">{p.hour}</span>
            </div>
          );
        })}
      </div>

      {/* Count summary */}
      <div className="text-[10px] opacity-60 text-right">
        {validPoints.reduce((s, p) => s + p.count, 0)} Dispatch-Entscheidungen heute
      </div>
    </div>
  );
}
