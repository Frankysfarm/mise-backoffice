'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Star, TrendingUp, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TourScore {
  driver_id: string;
  fahrer_name: string;
  score: number;
  touren_heute: number;
  puenktlichkeit_pct: number;
  trend: 'up' | 'down' | 'stable';
}

interface ApiData {
  scores: TourScore[];
  team_avg: number;
}

const MOCK: ApiData = {
  team_avg: 82,
  scores: [
    { driver_id: 'a', fahrer_name: 'Max Müller',   score: 94, touren_heute: 5, puenktlichkeit_pct: 96, trend: 'up' },
    { driver_id: 'b', fahrer_name: 'Anna Schmidt',  score: 81, touren_heute: 4, puenktlichkeit_pct: 80, trend: 'stable' },
    { driver_id: 'c', fahrer_name: 'Klaus Weber',   score: 67, touren_heute: 3, puenktlichkeit_pct: 65, trend: 'down' },
    { driver_id: 'd', fahrer_name: 'Sara Yılmaz',   score: 88, touren_heute: 6, puenktlichkeit_pct: 90, trend: 'up' },
  ],
};

function ScoreBar({ value, avg }: { value: number; avg: number }) {
  const color = value >= 90 ? 'bg-matcha-500' : value >= 75 ? 'bg-amber-400' : 'bg-red-500';
  return (
    <div className="relative flex-1 h-2 rounded-full bg-black/10 overflow-hidden">
      <div className={cn('h-full rounded-full transition-all duration-700', color)} style={{ width: `${value}%` }} />
      <div
        className="absolute top-0 h-full w-0.5 bg-stone-400/60"
        style={{ left: `${avg}%` }}
        title={`Team-Ø ${avg}`}
      />
    </div>
  );
}

interface Props { locationId: string | null }

export function DispatchPhase2130TourScoreVisualisierungsMatrix({ locationId }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/tour-scores?location_id=${locationId}`, { cache: 'no-store' });
      if (r.ok) setData(await r.json());
    } catch { /* use mock */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, 5 * 60_000);
    return () => clearInterval(id);
  }, [load]);

  const sorted = [...(data.scores ?? [])].sort((a, b) => b.score - a.score);
  const lowPerformers = sorted.filter(s => s.score < 75);

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <Star className="h-4 w-4 text-yellow-500 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1 text-left">
          Tour-Score · Visualisierung
        </span>
        <span className="text-[9px] text-muted-foreground bg-muted rounded-full px-2 py-0.5">
          Team-Ø {data.team_avg}
        </span>
        {lowPerformers.length > 0 && (
          <span className="flex items-center gap-1 text-[9px] font-bold text-amber-700 bg-amber-100 border border-amber-200 rounded-full px-2 py-0.5">
            <AlertTriangle className="h-2.5 w-2.5" />{lowPerformers.length} unter Ziel
          </span>
        )}
        {loading && <span className="text-[9px] text-muted-foreground">…</span>}
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-3 space-y-2">
          {sorted.map((s, i) => {
            const isTop    = i === 0;
            const isLow    = s.score < 75;
            const trendIcon = s.trend === 'up' ? '↑' : s.trend === 'down' ? '↓' : '→';
            const trendColor = s.trend === 'up' ? 'text-matcha-600' : s.trend === 'down' ? 'text-red-500' : 'text-muted-foreground';
            return (
              <div
                key={s.driver_id}
                className={cn('rounded-lg border p-2.5 space-y-1.5', isTop ? 'bg-matcha-50 border-matcha-200' : isLow ? 'bg-red-50 border-red-200' : 'bg-muted/20')}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-black text-muted-foreground w-4 tabular-nums">{i + 1}</span>
                  <span className="text-[11px] font-bold flex-1 truncate">{s.fahrer_name}</span>
                  <span className={cn('text-[10px] font-bold', trendColor)}>{trendIcon}</span>
                  <span className={cn('text-sm font-black tabular-nums', isTop ? 'text-matcha-700' : isLow ? 'text-red-600' : 'text-foreground')}>
                    {s.score}
                  </span>
                </div>
                <div className="flex items-center gap-2 ml-6">
                  <ScoreBar value={s.score} avg={data.team_avg} />
                  <span className="text-[9px] text-muted-foreground tabular-nums shrink-0">
                    {s.touren_heute} Tour{s.touren_heute !== 1 ? 'en' : ''} · {s.puenktlichkeit_pct}% pünktl.
                  </span>
                </div>
              </div>
            );
          })}
          <p className="text-[9px] text-muted-foreground text-center pt-1">
            <TrendingUp className="inline h-2.5 w-2.5 mr-0.5" />
            Grauer Strich = Team-Ø ({data.team_avg}) · 5-Min-Polling
          </p>
        </div>
      )}
    </div>
  );
}
