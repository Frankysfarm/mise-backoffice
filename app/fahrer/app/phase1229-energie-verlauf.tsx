'use client';

// Phase 1229 — Energie-Verlauf (Fahrer-App)
// Letzte 5 Energie-Checks + Mini-Trendlinie (SVG 5 Punkte) + Ø-Energie + Vergleich zu gestern
// 10-Min-Polling; isOnline-Guard

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  driverId: string;
  isOnline: boolean;
}

interface EnergieCheck {
  id: string;
  created_at: string;
  energie_level: number;
  kommentar?: string | null;
}

interface ApiResponse {
  checks: EnergieCheck[];
  avg_energie: number;
  avg_energie_gestern: number;
  trend: 'steigend' | 'stabil' | 'fallend';
}

const LEVEL_COLORS: Record<number, string> = {
  1: 'text-red-600',
  2: 'text-orange-500',
  3: 'text-amber-500',
  4: 'text-emerald-500',
  5: 'text-emerald-600',
};

const LEVEL_LABELS: Record<number, string> = {
  1: 'Erschöpft',
  2: 'Müde',
  3: 'Ok',
  4: 'Fit',
  5: 'Topform',
};

function TrendlinieSVG({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const W = 80;
  const H = 28;
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const range = Math.max(maxV - minV, 1);

  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W;
    const y = H - ((v - minV) / range) * H;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const last = values[values.length - 1];
  const dotColor = last >= 4 ? '#10b981' : last === 3 ? '#f59e0b' : '#ef4444';

  return (
    <svg width={W} height={H} className="overflow-visible">
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke="#6366f1"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity="0.7"
      />
      {values.map((v, i) => {
        const x = (i / (values.length - 1)) * W;
        const y = H - ((v - minV) / range) * H;
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={i === values.length - 1 ? 4 : 2.5}
            fill={i === values.length - 1 ? dotColor : '#6366f1'}
            opacity={i === values.length - 1 ? 1 : 0.5}
          />
        );
      })}
    </svg>
  );
}

export function FahrerPhase1229EnergieVerlauf({ driverId, isOnline }: Props) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (!isOnline) return null;

  function load() {
    setLoading(true);
    fetch(`/api/delivery/driver/energie-verlauf?driver_id=${encodeURIComponent(driverId)}`)
      .then((r) => r.json())
      .then((d: ApiResponse) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 10 * 60 * 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId]);

  const checks = data?.checks ?? [];
  const levels = checks.map((c) => c.energie_level);
  const avg = data?.avg_energie ?? 0;
  const avgGestern = data?.avg_energie_gestern ?? 0;
  const trend = data?.trend ?? 'stabil';
  const delta = Math.round((avg - avgGestern) * 10) / 10;

  const TrendIcon = trend === 'steigend' ? TrendingUp : trend === 'fallend' ? TrendingDown : Minus;
  const trendColor = trend === 'steigend' ? 'text-emerald-500' : trend === 'fallend' ? 'text-red-500' : 'text-stone-400';

  return (
    <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition"
      >
        <Zap className="h-4 w-4 text-indigo-500 shrink-0" />
        <span className="font-bold text-sm text-foreground flex-1">Energie-Verlauf</span>
        {avg > 0 && (
          <span className={cn('text-[11px] font-bold tabular-nums', LEVEL_COLORS[Math.round(avg)] ?? 'text-foreground')}>
            Ø {avg.toFixed(1)}
          </span>
        )}
        <TrendIcon className={cn('h-3.5 w-3.5', trendColor)} />
        {loading && <span className="text-[10px] text-muted-foreground">…</span>}
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          {checks.length === 0 && !loading && (
            <p className="text-xs text-muted-foreground italic">Noch keine Energie-Checks heute</p>
          )}

          {/* Mini-Trendlinie + Summary */}
          {levels.length >= 2 && (
            <div className="flex items-end gap-4">
              <TrendlinieSVG values={levels} />
              <div className="space-y-0.5">
                <div className="text-[10px] font-semibold text-muted-foreground">Heute Ø</div>
                <div className={cn('text-lg font-black tabular-nums', LEVEL_COLORS[Math.round(avg)] ?? 'text-foreground')}>
                  {avg.toFixed(1)} / 5
                </div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <TrendIcon className={cn('h-3 w-3', trendColor)} />
                  {delta >= 0 ? '+' : ''}{delta.toFixed(1)} vs. gestern
                </div>
              </div>
            </div>
          )}

          {/* Einzel-Checks */}
          {checks.length > 0 && (
            <div className="space-y-1.5">
              {[...checks].reverse().map((c) => {
                const lvl = c.energie_level;
                const time = new Date(c.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                return (
                  <div key={c.id} className="flex items-center gap-2">
                    <span className="w-10 text-[10px] text-muted-foreground tabular-nums">{time}</span>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div
                          key={i}
                          className={cn(
                            'h-3 w-3 rounded-sm',
                            i <= lvl
                              ? lvl >= 4 ? 'bg-emerald-500' : lvl === 3 ? 'bg-amber-400' : 'bg-red-400'
                              : 'bg-stone-200 dark:bg-stone-700',
                          )}
                        />
                      ))}
                    </div>
                    <span className={cn('text-[10px] font-semibold', LEVEL_COLORS[lvl] ?? 'text-foreground')}>
                      {LEVEL_LABELS[lvl] ?? `Level ${lvl}`}
                    </span>
                    {c.kommentar && (
                      <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">· {c.kommentar}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="text-[10px] text-muted-foreground">10-Min-Polling · Schicht heute</div>
        </div>
      )}
    </div>
  );
}
