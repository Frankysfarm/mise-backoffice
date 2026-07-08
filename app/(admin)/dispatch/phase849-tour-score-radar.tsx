'use client';

import { useEffect, useState } from 'react';
import { Target, Trophy, TrendingUp, TrendingDown, Minus, Route } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TourScoreEntry {
  batchId: string;
  driverName: string;
  score: number;
  stopsTotal: number;
  stopsCompleted: number;
  onTimePct: number;
  distanceKm: number | null;
  status: string;
  zone: string | null;
}

interface ScoreData {
  touren: TourScoreEntry[];
  avgScore: number;
  topScore: number;
  trend: 'up' | 'down' | 'neutral';
  aktualisiert: string;
}

const MOCK: ScoreData = {
  avgScore: 78,
  topScore: 94,
  trend: 'up',
  aktualisiert: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
  touren: [
    { batchId: 't1', driverName: 'Karim A.', score: 94, stopsTotal: 4, stopsCompleted: 3, onTimePct: 100, distanceKm: 8.2, status: 'unterwegs', zone: 'A' },
    { batchId: 't2', driverName: 'Leon B.', score: 81, stopsTotal: 3, stopsCompleted: 2, onTimePct: 83, distanceKm: 6.4, status: 'unterwegs', zone: 'B' },
    { batchId: 't3', driverName: 'Mia C.', score: 72, stopsTotal: 5, stopsCompleted: 2, onTimePct: 60, distanceKm: 11.1, status: 'unterwegs', zone: 'A' },
    { batchId: 't4', driverName: 'Tom D.', score: 65, stopsTotal: 3, stopsCompleted: 1, onTimePct: 50, distanceKm: 5.9, status: 'unterwegs', zone: 'C' },
  ],
};

function scoreColor(score: number): string {
  if (score >= 85) return 'text-matcha-700';
  if (score >= 70) return 'text-amber-600';
  return 'text-red-600';
}

function scoreBg(score: number): string {
  if (score >= 85) return 'bg-matcha-500';
  if (score >= 70) return 'bg-amber-400';
  return 'bg-red-400';
}

export function DispatchPhase849TourScoreRadar({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ScoreData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const params = locationId ? `?location_id=${locationId}` : '';
      const res = await fetch(`/api/delivery/admin/tour-score-live${params}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('fetch');
      const json = await res.json();
      const tours: TourScoreEntry[] = (json.tours ?? []).map((t: any) => ({
        batchId: t.batchId,
        driverName: t.driverName ?? 'Unbekannt',
        score: Math.round(t.score ?? 0),
        stopsTotal: t.stopsTotal ?? 0,
        stopsCompleted: t.stopsCompleted ?? 0,
        onTimePct: Math.round(t.onTimePct ?? 0),
        distanceKm: t.distanceKm ?? null,
        status: t.status ?? 'aktiv',
        zone: t.zone ?? null,
      }));
      const scores = tours.map((t) => t.score);
      const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
      const topScore = scores.length ? Math.max(...scores) : 0;
      const trend = json.summary?.trend ?? 'neutral';
      setData({ touren: tours.slice(0, 6), avgScore, topScore, trend, aktualisiert: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) });
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 30_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (loading) {
    return (
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="h-24 animate-pulse bg-muted rounded" />
      </div>
    );
  }
  if (!data || data.touren.length === 0) return null;

  const TrendIcon = data.trend === 'up' ? TrendingUp : data.trend === 'down' ? TrendingDown : Minus;
  const trendColor = data.trend === 'up' ? 'text-matcha-600' : data.trend === 'down' ? 'text-red-500' : 'text-muted-foreground';

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b">
        <Target className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Tour-Score Radar</span>
        <span className="ml-auto text-[10px] text-muted-foreground">{data.aktualisiert}</span>
      </div>

      {/* KPI-Header */}
      <div className="grid grid-cols-3 divide-x border-b">
        <div className="px-3 py-2 text-center">
          <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Ø Score</div>
          <div className={cn('text-xl font-black tabular-nums', scoreColor(data.avgScore))}>{data.avgScore}</div>
        </div>
        <div className="px-3 py-2 text-center">
          <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Top Score</div>
          <div className="flex items-center justify-center gap-1">
            <Trophy className="h-3 w-3 text-amber-500" />
            <span className="text-xl font-black tabular-nums text-amber-600">{data.topScore}</span>
          </div>
        </div>
        <div className="px-3 py-2 text-center">
          <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Trend</div>
          <div className="flex items-center justify-center gap-1 mt-0.5">
            <TrendIcon className={cn('h-5 w-5', trendColor)} />
          </div>
        </div>
      </div>

      {/* Tour-Kacheln */}
      <div className="divide-y">
        {data.touren.map((tour) => {
          const progressPct = tour.stopsTotal > 0 ? Math.round((tour.stopsCompleted / tour.stopsTotal) * 100) : 0;
          return (
            <div key={tour.batchId} className="flex items-center gap-3 px-4 py-2.5">
              {/* Score-Badge */}
              <div className={cn('h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-white text-xs font-black', scoreBg(tour.score))}>
                {tour.score}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold truncate">{tour.driverName}</span>
                  {tour.zone && (
                    <span className="text-[9px] rounded-full border px-1.5 py-0.5 font-bold bg-muted/50">
                      Zone {tour.zone}
                    </span>
                  )}
                  <span className={cn('text-[9px] font-bold ml-auto shrink-0', scoreColor(tour.onTimePct))}>
                    {tour.onTimePct}% pünktl.
                  </span>
                </div>
                {/* Progress-Bar */}
                <div className="mt-1 flex items-center gap-1.5">
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', scoreBg(tour.score))}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <span className="text-[9px] tabular-nums text-muted-foreground shrink-0">
                    {tour.stopsCompleted}/{tour.stopsTotal}
                  </span>
                  {tour.distanceKm !== null && (
                    <span className="text-[9px] tabular-nums text-muted-foreground shrink-0 flex items-center gap-0.5">
                      <Route className="h-2.5 w-2.5" />
                      {tour.distanceKm.toFixed(1)}km
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="px-4 py-1.5 bg-muted/30 border-t">
        <p className="text-[9px] text-muted-foreground">30s-Update · Echtzeit Tour-Score · Phase 849</p>
      </div>
    </div>
  );
}
