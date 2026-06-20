'use client';

/**
 * FahrerAnalyticsWochenuebersicht — persönliche Wochen-Performance-Karte.
 *
 * Zeigt dem Fahrer seine persönliche Performance der letzten 7 Tage:
 *   - Aktueller Rang + Gesamtzahl Fahrer
 *   - Live-Score (letzte Stunde)
 *   - Lieferungen + ø Lieferzeit (Wochenschnitt aus Driver-History)
 *   - Mini-Trend-Balken der letzten Tage
 *
 * Polling alle 5 Minuten auf /api/delivery/driver/my-performance?period=week&days=7.
 */

import { useEffect, useRef, useState } from 'react';
import { BarChart2, Trophy, TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HistoryPoint {
  date: string;
  liveScore: number | null;
  deliveries: number;
  avgDeliveryMin: number | null;
}

interface PerfData {
  rank: number | null;
  totalDrivers: number | null;
  liveScore: number | null;
  history: HistoryPoint[];
}

function rankBadge(rank: number | null, total: number | null) {
  if (rank == null || total == null) return null;
  const pct = rank / total;
  if (pct <= 0.2) return { label: `#${rank} 🏆`, cls: 'bg-amber-100 text-amber-700' };
  if (pct <= 0.5) return { label: `#${rank}`, cls: 'bg-matcha-100 text-matcha-700' };
  return { label: `#${rank}`, cls: 'bg-muted text-muted-foreground' };
}

export function FahrerAnalyticsWochenuebersicht() {
  const [data, setData] = useState<PerfData | null>(null);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = () => {
    setLoading(true);
    fetch('/api/delivery/driver/my-performance?period=week&days=7')
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        if (!json) return;
        setData({
          rank: json.rank ?? null,
          totalDrivers: json.total ?? null,
          liveScore: (json.rankData?.score ?? null) as number | null,
          history: (json.history ?? []) as HistoryPoint[],
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 5 * 60 * 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  if (loading && !data) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-4 flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Lade Wochenanalyse…</span>
      </div>
    );
  }

  if (!data) return null;

  const badge = rankBadge(data.rank, data.totalDrivers);
  const history = data.history.slice(-7).reverse();
  const maxScore = Math.max(...history.map(h => h.liveScore ?? 0), 1);
  const weekDeliveries = history.reduce((s, h) => s + h.deliveries, 0);
  const avgMin = history.filter(h => h.avgDeliveryMin != null).map(h => h.avgDeliveryMin!);
  const avgDeliveryMin = avgMin.length > 0 ? avgMin.reduce((a, b) => a + b, 0) / avgMin.length : null;

  const trend = history.length >= 2
    ? (history[0]?.liveScore ?? 0) - (history[history.length - 1]?.liveScore ?? 0)
    : null;
  const TrendIcon = trend == null ? Minus : trend > 2 ? TrendingUp : trend < -2 ? TrendingDown : Minus;
  const trendColor = trend == null ? 'text-muted-foreground' : trend > 2 ? 'text-matcha-600' : trend < -2 ? 'text-red-500' : 'text-muted-foreground';

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-stone-100">
        <BarChart2 className="h-4 w-4 text-matcha-600" />
        <span className="text-sm font-bold text-stone-800">Meine Woche</span>
        {badge && (
          <span className={cn('ml-auto rounded-full px-2 py-0.5 text-[11px] font-black', badge.cls)}>
            {badge.label}
            {data.totalDrivers && <span className="font-normal opacity-60"> / {data.totalDrivers}</span>}
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 divide-x border-b border-stone-100">
        <div className="flex flex-col items-center gap-0.5 py-3 px-2">
          <span className="text-lg font-black tabular-nums text-stone-800">{weekDeliveries}</span>
          <span className="text-[9px] font-medium uppercase tracking-wide text-stone-400">Lieferungen</span>
        </div>
        <div className="flex flex-col items-center gap-0.5 py-3 px-2">
          <span className="text-lg font-black tabular-nums text-stone-800">
            {avgDeliveryMin != null ? `${avgDeliveryMin.toFixed(0)}` : '—'}
          </span>
          <span className="text-[9px] font-medium uppercase tracking-wide text-stone-400">Ø Min</span>
        </div>
        <div className="flex flex-col items-center gap-0.5 py-3 px-2">
          <div className="flex items-center gap-1">
            <span className="text-lg font-black tabular-nums text-stone-800">
              {data.liveScore != null ? data.liveScore : '—'}
            </span>
            <TrendIcon className={cn('h-4 w-4', trendColor)} />
          </div>
          <span className="text-[9px] font-medium uppercase tracking-wide text-stone-400">Live-Score</span>
        </div>
      </div>

      {history.length > 0 && (
        <div className="px-4 py-2.5">
          <div className="text-[9px] font-bold uppercase tracking-wider text-stone-400 mb-1.5">Score letzte 7 Tage</div>
          <div className="flex items-end gap-1 h-8">
            {history.map((h, i) => {
              const score = h.liveScore ?? 0;
              const pct = maxScore > 0 ? (score / maxScore) * 100 : 0;
              const barColor = score >= 85 ? 'bg-matcha-500' : score >= 70 ? 'bg-amber-400' : score > 0 ? 'bg-red-400' : 'bg-stone-100';
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                  <div
                    className={cn('w-full rounded-t-sm transition-all', barColor)}
                    style={{ height: `${Math.max(4, pct * 0.32)}rem` }}
                    title={`${score}`}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
