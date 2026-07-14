'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Trophy, TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';

// Phase 1469 — Tour-Score-Benchmark-Live (Dispatch)
// Vergleich aktueller Schicht-Score vs. Vorwoche; Trend-Ampel;
// Mock-Fallback + API-Polling 5 Min; nach Phase1468.

interface Props {
  locationId: string | null;
}

interface BenchmarkData {
  score_heute: number;
  score_vorwoche: number;
  delta_pct: number;
  trend: 'besser' | 'gleich' | 'schlechter';
  tours_heute: number;
  avg_lieferzeit_min: number;
  avg_lieferzeit_vorwoche: number;
}

function buildMock(): BenchmarkData {
  return {
    score_heute: 84,
    score_vorwoche: 79,
    delta_pct: 6.3,
    trend: 'besser',
    tours_heute: 23,
    avg_lieferzeit_min: 28,
    avg_lieferzeit_vorwoche: 31,
  };
}

const TREND_CFG = {
  besser:     { icon: TrendingUp,   cls: 'text-emerald-600 dark:text-emerald-400', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', label: 'Besser' },
  gleich:     { icon: Minus,        cls: 'text-amber-500 dark:text-amber-400',     badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',         label: 'Gleich' },
  schlechter: { icon: TrendingDown, cls: 'text-rose-600 dark:text-rose-400',       badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',             label: 'Schlechter' },
};

export function DispatchPhase1469TourScoreBenchmarkLive({ locationId }: Props) {
  const [data, setData] = useState<BenchmarkData>(buildMock());
  const [loading, setLoading] = useState(false);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  async function fetchData() {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/stats?location_id=${locationId}&type=benchmark`, { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json?.score_heute != null) setData(json);
      }
    } catch {
      // fallback mock already set
    } finally {
      setLoading(false);
      setLastFetch(new Date());
    }
  }

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 5 * 60_000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const trendCfg = TREND_CFG[data.trend];
  const TrendIcon = trendCfg.icon;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b">
        <Trophy className="h-4 w-4 shrink-0 text-amber-500" />
        <span className="text-xs font-bold uppercase tracking-wider">Score-Benchmark</span>
        <span className={cn('ml-2 flex items-center gap-1 text-[10px] font-bold rounded-full px-2 py-0.5', trendCfg.badge)}>
          <TrendIcon className="h-3 w-3" />
          {trendCfg.label}
        </span>
        <button
          onClick={fetchData}
          disabled={loading}
          className="ml-auto p-1 rounded hover:bg-muted/40 transition"
          title="Aktualisieren"
        >
          <RefreshCw className={cn('h-3 w-3 text-muted-foreground', loading && 'animate-spin')} />
        </button>
      </div>
      <div className="px-5 py-4 grid grid-cols-2 gap-4">
        {/* Heute */}
        <div className="space-y-0.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Heute</div>
          <div className="text-3xl font-black tabular-nums leading-none">{data.score_heute}</div>
          <div className="text-[11px] text-muted-foreground">{data.tours_heute} Touren</div>
          <div className="text-[11px] font-bold text-matcha-600 dark:text-matcha-400">∅ {data.avg_lieferzeit_min} Min</div>
        </div>
        {/* Vorwoche */}
        <div className="space-y-0.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Vorwoche</div>
          <div className="text-3xl font-black tabular-nums leading-none text-muted-foreground">{data.score_vorwoche}</div>
          <div className="text-[11px] text-muted-foreground">—</div>
          <div className="text-[11px] text-muted-foreground">∅ {data.avg_lieferzeit_vorwoche} Min</div>
        </div>
        {/* Delta bar */}
        <div className="col-span-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-muted-foreground">Verbesserung vs. Vorwoche</span>
            <span className={cn('text-[11px] font-bold', trendCfg.cls)}>
              {data.delta_pct > 0 ? '+' : ''}{data.delta_pct.toFixed(1)}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-700',
                data.trend === 'besser' ? 'bg-emerald-500' :
                data.trend === 'gleich' ? 'bg-amber-400' : 'bg-rose-500'
              )}
              style={{ width: `${Math.min(100, 50 + data.delta_pct * 2)}%` }}
            />
          </div>
        </div>
      </div>
      {lastFetch && (
        <div className="px-5 pb-3 text-[10px] text-muted-foreground">
          Aktualisiert: {lastFetch.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
        </div>
      )}
    </Card>
  );
}
