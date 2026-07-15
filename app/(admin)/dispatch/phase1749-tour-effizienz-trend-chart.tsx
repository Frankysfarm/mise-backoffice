'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, BarChart2 } from 'lucide-react';

/**
 * Phase 1749 — Tour-Effizienz-Trend-Chart (Dispatch)
 *
 * Phase1747-API: Linienchart Score-Verlauf je Fahrer letzte 7 Tage
 * + Trend-Ampel; 30-Min-Polling; in dispatch/client.tsx.
 */

interface TagesScore {
  datum: string;
  score: number;
  touren: number;
}

interface FahrerHistory {
  driver_id: string;
  fahrer_name: string;
  tage: TagesScore[];
  avg_score: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
}

interface ApiResponse {
  fahrer: FahrerHistory[];
  zeitraum_tage: number;
}

interface Props {
  locationId: string | null;
}

const MOCK: ApiResponse = {
  zeitraum_tage: 7,
  fahrer: [
    { driver_id: 'drv-1', fahrer_name: 'Mehmet A.', avg_score: 80, trend: 'steigend',  trend_delta: 4.5,
      tage: ['Mo','Di','Mi','Do','Fr','Sa','So'].map((d, i) => ({ datum: d, score: 72 + i * 2.5, touren: 4 })) },
    { driver_id: 'drv-2', fahrer_name: 'Julia S.',  avg_score: 83, trend: 'fallend',   trend_delta: -5.0,
      tage: ['Mo','Di','Mi','Do','Fr','Sa','So'].map((d, i) => ({ datum: d, score: 90 - i * 2,   touren: 3 })) },
    { driver_id: 'drv-3', fahrer_name: 'Kevin R.',  avg_score: 71, trend: 'stabil',    trend_delta: 0.5,
      tage: ['Mo','Di','Mi','Do','Fr','Sa','So'].map((d, i) => ({ datum: d, score: 68 + (i % 3), touren: 3 })) },
    { driver_id: 'drv-4', fahrer_name: 'Lena T.',   avg_score: 85, trend: 'steigend',  trend_delta: 2.5,
      tage: ['Mo','Di','Mi','Do','Fr','Sa','So'].map((d, i) => ({ datum: d, score: 82 + i,        touren: 5 })) },
  ],
};

function MiniLineChart({ tage, color }: { tage: TagesScore[]; color: string }) {
  if (tage.length < 2) return null;
  const scores = tage.map(t => t.score);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;
  const W = 80;
  const H = 28;

  const points = scores.map((s, i) => {
    const x = (i / (scores.length - 1)) * W;
    const y = H - ((s - min) / range) * H;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={W} height={H} className="shrink-0">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {scores.map((s, i) => {
        const x = (i / (scores.length - 1)) * W;
        const y = H - ((s - min) / range) * H;
        return <circle key={i} cx={x} cy={y} r="2.5" fill={color} />;
      })}
    </svg>
  );
}

export function DispatchPhase1749TourEffizienzTrendChart({ locationId }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }

    const load = () => {
      fetch(`/api/delivery/admin/tour-effizienz-history?location_id=${locationId}`, { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .then(d => setData(d ?? MOCK))
        .catch(() => setData(MOCK));
    };
    load();
    const iv = setInterval(load, 30 * 60_000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (!data) return null;

  const anyFallend = data.fahrer.some(f => f.trend === 'fallend');

  return (
    <div className={cn(
      'mx-4 mb-3 rounded-xl border overflow-hidden',
      anyFallend ? 'border-red-200 bg-red-50' : 'border-stone-200 bg-white',
    )}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-black/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-violet-500 shrink-0" />
          <span className="text-sm font-bold text-char">Tour-Effizienz Trend · 7 Tage</span>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full border bg-violet-50 border-violet-200 text-violet-700">
            {data.fahrer.length} Fahrer
          </span>
          {anyFallend && (
            <span className="text-[10px] font-bold text-red-600 flex items-center gap-0.5">
              <TrendingDown className="w-3 h-3" />
              Abfall erkannt
            </span>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
      </button>

      {open && (
        <div className="border-t border-stone-200 px-4 py-3 space-y-3">
          {data.fahrer.map(f => {
            const TrendIcon = f.trend === 'steigend' ? TrendingUp : f.trend === 'fallend' ? TrendingDown : Minus;
            const trendColor =
              f.trend === 'steigend' ? 'text-emerald-600' :
              f.trend === 'fallend'  ? 'text-red-500' :
                                       'text-stone-400';
            const lineColor =
              f.trend === 'steigend' ? '#10b981' :
              f.trend === 'fallend'  ? '#ef4444' :
                                       '#a1a1aa';
            const scoreColor =
              f.avg_score >= 85 ? 'text-emerald-600' :
              f.avg_score >= 70 ? 'text-amber-600' :
                                   'text-red-500';

            return (
              <div key={f.driver_id} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendIcon className={cn('w-3.5 h-3.5 shrink-0', trendColor)} />
                    <span className="text-xs font-semibold text-char truncate">{f.fahrer_name}</span>
                    <span className={cn('text-[10px] font-bold font-mono ml-auto shrink-0', scoreColor)}>
                      Ø {f.avg_score}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MiniLineChart tage={f.tage} color={lineColor} />
                    <div className="flex flex-col gap-0.5">
                      <span className={cn('text-[9px] font-bold', trendColor)}>
                        {f.trend === 'steigend' ? `+${f.trend_delta}` : f.trend_delta} Pkt
                      </span>
                      <span className="text-[8px] text-stone-400">letzte 7 Tage</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          <div className="text-[9px] text-stone-400 pt-1 border-t border-stone-100">
            Ø Tour-Score je Fahrer · Aktualisierung alle 30 Min
          </div>
        </div>
      )}
    </div>
  );
}
