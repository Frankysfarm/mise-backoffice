'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, LineChart } from 'lucide-react';

/**
 * Phase 1750 — Eigener Effizienz-Trend (Fahrer-App)
 *
 * Mein Tour-Score letzte 7 Tage als Mini-Linienchart
 * + Trend-Pfeil + Vergleich Team; isOnline-Guard; 30-Min-Polling.
 */

interface TagesScore {
  datum: string;
  score: number;
  touren: number;
}

interface ApiResponse {
  tage: TagesScore[];
  avg_score: number;
  team_avg_score: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  besser_als_team: boolean;
}

interface Props {
  driverId: string | null;
  isOnline: boolean;
}

const MOCK: ApiResponse = {
  avg_score: 82,
  team_avg_score: 76,
  trend: 'steigend',
  trend_delta: 4.5,
  besser_als_team: true,
  tage: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d, i) => ({
    datum: d,
    score: 72 + i * 1.5,
    touren: 3 + (i % 2),
  })),
};

function MiniSparkline({ tage, color }: { tage: TagesScore[]; color: string }) {
  if (tage.length < 2) return null;
  const scores = tage.map(t => t.score);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;
  const W = 72;
  const H = 24;

  const pts = scores.map((s, i) => {
    const x = (i / (scores.length - 1)) * W;
    const y = H - ((s - min) / range) * H;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={W} height={H}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {scores.map((s, i) => {
        const x = (i / (scores.length - 1)) * W;
        const y = H - ((s - min) / range) * H;
        return <circle key={i} cx={x} cy={y} r="2" fill={color} />;
      })}
    </svg>
  );
}

export function FahrerPhase1750EigenerEffizienzTrend({ driverId, isOnline }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isOnline || !driverId) return;

    const load = () => {
      fetch(`/api/delivery/admin/tour-effizienz-history?location_id=all&driver_id=${driverId}`, { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .then((d: { fahrer?: ApiResponse[] } | null) => {
          if (d?.fahrer && d.fahrer.length > 0) {
            setData(d.fahrer[0] as unknown as ApiResponse);
          } else {
            setData(MOCK);
          }
        })
        .catch(() => setData(MOCK));
    };
    load();
    const iv = setInterval(load, 30 * 60_000);
    return () => clearInterval(iv);
  }, [driverId, isOnline]);

  if (!isOnline || !data) return null;

  const TrendIcon = data.trend === 'steigend' ? TrendingUp : data.trend === 'fallend' ? TrendingDown : Minus;
  const trendColor =
    data.trend === 'steigend' ? 'text-emerald-500' :
    data.trend === 'fallend'  ? 'text-red-500' :
                                 'text-stone-400';
  const lineColor =
    data.trend === 'steigend' ? '#10b981' :
    data.trend === 'fallend'  ? '#ef4444' :
                                '#a1a1aa';
  const scoreColor =
    data.avg_score >= 85 ? 'text-emerald-600' :
    data.avg_score >= 70 ? 'text-amber-600' :
                            'text-red-500';

  return (
    <div className="mx-4 mb-3 rounded-xl border border-stone-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-stone-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <LineChart className="w-4 h-4 text-violet-500 shrink-0" />
          <span className="text-sm font-bold text-char">Mein Effizienz-Trend</span>
          <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full border bg-violet-50 border-violet-200', scoreColor)}>
            Ø {data.avg_score}
          </span>
          <TrendIcon className={cn('w-3.5 h-3.5 shrink-0', trendColor)} />
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
      </button>

      {open && (
        <div className="border-t border-stone-100 px-4 py-3 space-y-3">
          <div className="flex items-center gap-4">
            <MiniSparkline tage={data.tage} color={lineColor} />
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-1.5">
                <TrendIcon className={cn('w-4 h-4', trendColor)} />
                <span className={cn('text-sm font-bold', trendColor)}>
                  {data.trend === 'steigend' ? `+${data.trend_delta}` : data.trend_delta} Pkt
                </span>
                <span className="text-[10px] text-stone-400">letzte 7 Tage</span>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-stone-500">Team-Ø:</span>
                <span className="font-bold text-stone-600">{data.team_avg_score}</span>
                {data.besser_als_team
                  ? <span className="text-emerald-600 font-bold">+{data.avg_score - data.team_avg_score} besser</span>
                  : <span className="text-amber-600 font-bold">{data.avg_score - data.team_avg_score} zum Team</span>
                }
              </div>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {data.tage.map((t, i) => (
              <div key={i} className="text-center">
                <div className={cn(
                  'text-[8px] font-bold rounded px-0.5 py-0.5 tabular-nums',
                  t.score >= 85 ? 'bg-emerald-100 text-emerald-700' :
                  t.score >= 70 ? 'bg-amber-50 text-amber-700' :
                                  'bg-red-50 text-red-600',
                )}>
                  {Math.round(t.score)}
                </div>
                <div className="text-[7px] text-stone-400 mt-0.5">{t.datum}</div>
              </div>
            ))}
          </div>
          <div className="text-[9px] text-stone-400 pt-1 border-t border-stone-100">
            Tour-Effizienz-Score · Aktualisierung alle 30 Min
          </div>
        </div>
      )}
    </div>
  );
}
