'use client';

/**
 * LieferdienstTeamScoreTrend — Phase 359
 * Team average score trend over 8 weeks, Recharts AreaChart
 * 10-Min-Polling, shows team avg + top driver avg + bottom driver avg
 */

import React, { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface HistoryRow {
  driverId: string;
  periodStart: string;
  compositeScore: number;
}

interface ChartPoint {
  week: string;
  teamAvg: number;
  topAvg: number;
  bottomAvg: number;
}

export function LieferdienstTeamScoreTrend({ locationId }: { locationId?: string | null }) {
  const [points, setPoints] = useState<ChartPoint[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const params = new URLSearchParams({ action: 'history', weeks: '8' });
        if (locationId) params.set('location_id', locationId);
        const res = await fetch(`/api/delivery/admin/driver-score?${params}`);
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

        const pts: ChartPoint[] = [...byWeek.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([week, scores]) => {
            const sorted = [...scores].sort((a, b) => a - b);
            const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
            // top 25% avg
            const topCount = Math.max(1, Math.ceil(sorted.length * 0.25));
            const topAvg = sorted.slice(-topCount).reduce((s, v) => s + v, 0) / topCount;
            // bottom 25% avg
            const bottomAvg = sorted.slice(0, topCount).reduce((s, v) => s + v, 0) / topCount;
            return {
              week: week.slice(5),
              teamAvg: Math.round(avg * 10) / 10,
              topAvg: Math.round(topAvg * 10) / 10,
              bottomAvg: Math.round(bottomAvg * 10) / 10,
            };
          });

        if (!cancelled) { setPoints(pts); setLoaded(true); }
      } catch { setLoaded(true); }
    };

    load();
    const iv = setInterval(load, 10 * 60 * 1000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  if (!loaded || points.length < 2) return null;

  const last2 = points.slice(-2);
  const delta = last2.length === 2 ? last2[1].teamAvg - last2[0].teamAvg : 0;
  const TrendIcon = delta > 1 ? TrendingUp : delta < -1 ? TrendingDown : Minus;
  const trendColor = delta > 1 ? 'text-green-600' : delta < -1 ? 'text-red-600' : 'text-muted-foreground';
  const trendLabel = delta > 1 ? 'Verbesserung' : delta < -1 ? 'Rückgang' : 'Stabil';
  const trendBadge = delta > 1
    ? 'bg-green-100 text-green-800'
    : delta < -1
    ? 'bg-red-100 text-red-800'
    : 'bg-gray-100 text-gray-700';

  return (
    <div className="mt-3 rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <TrendIcon className={`h-4 w-4 ${trendColor}`} />
          <span className="text-sm font-semibold">Team-Score-Trend (8 Wochen)</span>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${trendBadge}`}>
          {trendLabel} {delta !== 0 && `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}`}
        </span>
      </div>
      <div className="p-4">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={points} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
            <defs>
              <linearGradient id="teamGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="week" tick={{ fontSize: 10 }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
            <Tooltip formatter={(value) => typeof value === 'number' ? `${value.toFixed(1)}` : String(value ?? '')} />
            <Legend wrapperStyle={{ fontSize: '11px' }} />
            <Area type="monotone" dataKey="topAvg" name="Top 25%" stroke="#22c55e" strokeWidth={1.5} fill="url(#teamGrad)" strokeDasharray="4 2" />
            <Area type="monotone" dataKey="teamAvg" name="Team Ø" stroke="#3b82f6" strokeWidth={2} fill="none" />
            <Area type="monotone" dataKey="bottomAvg" name="Bottom 25%" stroke="#f59e0b" strokeWidth={1.5} fill="none" strokeDasharray="4 2" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default LieferdienstTeamScoreTrend;
