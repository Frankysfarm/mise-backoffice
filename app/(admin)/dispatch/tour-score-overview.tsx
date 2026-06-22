'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, MapPin, Clock, TrendingUp, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

interface TourEntry {
  tour_id: string;
  driver_name: string;
  driver_id: string;
  score: number;
  stops_done: number;
  stops_total: number;
  elapsed_min: number;
  eta_min: number;
  zone: string;
  status: string;
  health: 'green' | 'amber' | 'red';
}

interface ApiResponse {
  tours: TourEntry[];
}

const MOCK_TOURS: TourEntry[] = [
  {
    tour_id: 'T-001',
    driver_name: 'Markus Hoffmann',
    driver_id: 'D-11',
    score: 91,
    stops_done: 5,
    stops_total: 7,
    elapsed_min: 48,
    eta_min: 22,
    zone: 'Nord',
    status: 'active',
    health: 'green',
  },
  {
    tour_id: 'T-002',
    driver_name: 'Lena Braun',
    driver_id: 'D-07',
    score: 73,
    stops_done: 3,
    stops_total: 6,
    elapsed_min: 35,
    eta_min: 41,
    zone: 'Mitte',
    status: 'active',
    health: 'amber',
  },
  {
    tour_id: 'T-003',
    driver_name: 'Jonas Weber',
    driver_id: 'D-03',
    score: 55,
    stops_done: 2,
    stops_total: 5,
    elapsed_min: 62,
    eta_min: 58,
    zone: 'Süd',
    status: 'active',
    health: 'red',
  },
  {
    tour_id: 'T-004',
    driver_name: 'Sara Klein',
    driver_id: 'D-15',
    score: 84,
    stops_done: 4,
    stops_total: 4,
    elapsed_min: 29,
    eta_min: 8,
    zone: 'West',
    status: 'active',
    health: 'green',
  },
];

function scoreColors(score: number): { bg: string; text: string; border: string; bar: string } {
  if (score >= 80) return { bg: 'bg-matcha-50', text: 'text-matcha-700', border: 'border-matcha-200', bar: 'bg-matcha-500' };
  if (score >= 60) return { bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200',  bar: 'bg-amber-400'  };
  return             { bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200',    bar: 'bg-red-500'    };
}

function healthDot(health: TourEntry['health']): string {
  if (health === 'green') return 'bg-matcha-500';
  if (health === 'amber') return 'bg-amber-400';
  return 'bg-red-500';
}

function formatElapsed(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function DispatchTourScoreOverview() {
  const [tours, setTours] = useState<TourEntry[]>([]);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchScores = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/delivery/dispatch/scores');
      if (!res.ok) throw new Error('fetch failed');
      const data: ApiResponse = await res.json();
      setTours(data.tours);
    } catch {
      setTours(MOCK_TOURS);
    } finally {
      setRefreshing(false);
      setLastRefresh(new Date());
    }
  }, []);

  useEffect(() => {
    fetchScores();
    const id = setInterval(fetchScores, 30_000);
    return () => clearInterval(id);
  }, [fetchScores]);

  const sorted = [...tours].sort((a, b) => b.score - a.score);

  const totalTours = sorted.length;
  const avgScore = totalTours > 0
    ? Math.round(sorted.reduce((s, t) => s + t.score, 0) / totalTours)
    : 0;
  const onTimeCount = sorted.filter((t) => t.health !== 'red').length;
  const onTimeRate = totalTours > 0 ? Math.round((onTimeCount / totalTours) * 100) : 0;
  const totalStopsDone = sorted.reduce((s, t) => s + t.stops_done, 0);

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-matcha-50">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-matcha-600 shrink-0" />
          <span className="text-[11px] font-black uppercase tracking-wider text-matcha-700">
            Tour Score Übersicht
          </span>
        </div>
        <button
          onClick={fetchScores}
          disabled={refreshing}
          className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground hover:text-matcha-700 transition disabled:opacity-50"
        >
          <RefreshCw className={cn('h-3 w-3', refreshing && 'animate-spin')} />
          {lastRefresh
            ? `${lastRefresh.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`
            : 'Laden…'}
        </button>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-4 divide-x border-b bg-muted/10">
        <div className="flex flex-col items-center py-2.5 gap-0.5">
          <span className="text-[18px] font-black text-foreground leading-none">{totalTours}</span>
          <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide">Aktive Touren</span>
        </div>
        <div className="flex flex-col items-center py-2.5 gap-0.5">
          <span className={cn('text-[18px] font-black leading-none', onTimeRate >= 80 ? 'text-matcha-600' : onTimeRate >= 60 ? 'text-amber-600' : 'text-red-600')}>
            {onTimeRate}%
          </span>
          <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide">Pünktlichkeit</span>
        </div>
        <div className="flex flex-col items-center py-2.5 gap-0.5">
          <span className={cn('text-[18px] font-black leading-none', scoreColors(avgScore).text)}>
            {avgScore}
          </span>
          <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide">Ø Score</span>
        </div>
        <div className="flex flex-col items-center py-2.5 gap-0.5">
          <span className="text-[18px] font-black text-foreground leading-none">{totalStopsDone}</span>
          <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide">Stopps erledigt</span>
        </div>
      </div>

      {/* Tour rows */}
      <div className="divide-y divide-border/40">
        {sorted.length === 0 && (
          <div className="py-8 text-center text-[11px] text-muted-foreground">
            Keine aktiven Touren
          </div>
        )}
        {sorted.map((tour) => {
          const c = scoreColors(tour.score);
          const stopPct = tour.stops_total > 0
            ? Math.round((tour.stops_done / tour.stops_total) * 100)
            : 0;
          return (
            <div key={tour.tour_id} className={cn('flex items-center gap-3 px-4 py-2.5', c.bg)}>
              {/* Health dot */}
              <span
                className={cn('h-2 w-2 shrink-0 rounded-full', healthDot(tour.health))}
                title={tour.health}
              />

              {/* Score badge */}
              <div
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 font-mono text-[12px] font-black',
                  c.text, c.border,
                )}
              >
                {tour.score}
              </div>

              {/* Driver + stop progress */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[11px] font-bold text-foreground truncate">
                    {tour.driver_name}
                  </span>
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground shrink-0">
                    {tour.zone}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-muted/60 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full', c.bar)}
                      style={{ width: `${stopPct}%` }}
                    />
                  </div>
                  <span className="text-[9px] font-semibold text-muted-foreground shrink-0 flex items-center gap-0.5">
                    <CheckCircle2 className="h-2.5 w-2.5" />
                    {tour.stops_done}/{tour.stops_total} Stopps
                  </span>
                </div>
              </div>

              {/* Time info */}
              <div className="flex flex-col items-end gap-0.5 shrink-0">
                <div className="flex items-center gap-1 text-[10px] font-semibold text-foreground">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  {formatElapsed(tour.elapsed_min)}
                </div>
                <div className="flex items-center gap-1 text-[9px] font-medium text-muted-foreground">
                  <MapPin className="h-2.5 w-2.5" />
                  ETA {formatElapsed(tour.eta_min)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/10">
        <span className="text-[9px] text-muted-foreground font-semibold">
          {sorted.filter((t) => t.score >= 80).length} exzellent ·{' '}
          {sorted.filter((t) => t.score < 60).length} kritisch
        </span>
        <span className="text-[9px] text-muted-foreground">
          Auto-refresh alle 30s
        </span>
      </div>
    </Card>
  );
}
