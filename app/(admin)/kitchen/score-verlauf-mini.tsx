'use client';

/**
 * KitchenScoreVerlaufMini — Phase 359
 * Mini-Bar-Chart (last 4 weeks team avg score), 10-Min-Polling
 * Shows trend arrow (up/down/neutral) and delta vs. 4 weeks ago
 */

import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface HistoryRow {
  driverId: string;
  periodStart: string;
  compositeScore: number;
}

interface WeekAvg {
  week: string;
  avg: number;
}

export function KitchenScoreVerlaufMini() {
  const [weekAvgs, setWeekAvgs] = useState<WeekAvg[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch('/api/delivery/admin/driver-score?action=history&weeks=4');
        if (!res.ok) return;
        const d = await res.json();
        const rows: HistoryRow[] = d.rows ?? [];
        if (rows.length === 0) { setLoaded(true); return; }

        const byWeek = new Map<string, number[]>();
        for (const r of rows) {
          const arr = byWeek.get(r.periodStart) ?? [];
          arr.push(r.compositeScore);
          byWeek.set(r.periodStart, arr);
        }
        const avgs: WeekAvg[] = [...byWeek.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([week, scores]) => ({
            week: week.slice(5),
            avg: scores.reduce((s, v) => s + v, 0) / scores.length,
          }));

        if (!cancelled) { setWeekAvgs(avgs); setLoaded(true); }
      } catch { setLoaded(true); }
    };

    load();
    const iv = setInterval(load, 10 * 60 * 1000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  if (!loaded || weekAvgs.length === 0) return null;

  const first = weekAvgs[0]?.avg ?? 0;
  const last = weekAvgs[weekAvgs.length - 1]?.avg ?? 0;
  const delta = last - first;
  const maxAvg = Math.max(...weekAvgs.map((w: WeekAvg) => w.avg), 1);

  const TrendIcon = delta > 1 ? TrendingUp : delta < -1 ? TrendingDown : Minus;
  const trendColor = delta > 1 ? 'text-green-600' : delta < -1 ? 'text-red-600' : 'text-muted-foreground';

  return (
    <div className="mt-3 rounded-xl border bg-card p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-muted-foreground">Score-Verlauf (4 Wochen)</span>
        <div className={`flex items-center gap-1 text-xs font-bold ${trendColor}`}>
          <TrendIcon className="h-3.5 w-3.5" />
          <span>{delta >= 0 ? '+' : ''}{delta.toFixed(1)}</span>
        </div>
      </div>
      <div className="flex items-end gap-1 h-12">
        {weekAvgs.map((w: WeekAvg) => {
          const pct = Math.max(8, (w.avg / maxAvg) * 100);
          return (
            <div key={w.week} className="flex-1 flex flex-col items-center gap-0.5">
              <div
                className="w-full rounded-sm bg-matcha-400 transition-all"
                style={{ height: `${pct}%` }}
                title={`KW ${w.week}: ø ${w.avg.toFixed(1)}`}
              />
              <span className="text-[9px] text-muted-foreground">{w.week}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-1 text-[10px] text-muted-foreground text-right">
        Aktuell: ø {last.toFixed(1)} Punkte
      </div>
    </div>
  );
}

export default KitchenScoreVerlaufMini;
