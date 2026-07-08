'use client';

import { useEffect, useState } from 'react';
import { Trophy, TrendingUp, TrendingDown, Minus, Route } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TourScoreEntry {
  batchId: string;
  driverName: string;
  score: number;
  stopsTotal: number;
  stopsCompleted: number;
  avgDeliveryMin: number | null;
  onTimePct: number;
  distanceKm: number | null;
  status: string;
  zone: string | null;
  startedAt: string | null;
}

interface ShiftSummary {
  avgScore: number;
  topScore: number;
  bottomScore: number;
  tourCount: number;
  completedTours: number;
  totalDeliveries: number;
  onTimePct: number;
  trend: 'up' | 'down' | 'neutral';
}

interface Props {
  locationId: string | null;
}

function scoreColor(score: number): { bg: string; text: string; bar: string } {
  if (score >= 80) return { bg: 'bg-matcha-50 dark:bg-matcha-950/30', text: 'text-matcha-700 dark:text-matcha-400', bar: 'bg-matcha-500' };
  if (score >= 60) return { bg: 'bg-amber-50 dark:bg-amber-950/20', text: 'text-amber-700 dark:text-amber-400', bar: 'bg-amber-400' };
  return { bg: 'bg-red-50 dark:bg-red-950/20', text: 'text-red-600 dark:text-red-400', bar: 'bg-red-500' };
}

function ScoreArc({ score }: { score: number }) {
  const r = 18;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(score, 100) / 100;
  const dash = pct * circ;
  const color = score >= 80 ? '#6b9f4e' : score >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <svg width={44} height={44} className="-rotate-90 shrink-0">
      <circle cx={22} cy={22} r={r} fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth={4} />
      <circle
        cx={22} cy={22} r={r}
        fill="none"
        stroke={color}
        strokeWidth={4}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
    </svg>
  );
}

export function DispatchPhase786TourScoreLivePanel({ locationId }: Props) {
  const [tours, setTours] = useState<TourScoreEntry[]>([]);
  const [summary, setSummary] = useState<ShiftSummary | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      try {
        const params = locationId ? `?location_id=${locationId}` : '';
        const res = await fetch(`/api/delivery/admin/tour-score-live${params}`);
        if (!res.ok) return;
        const json = await res.json();
        if (active && json.ok) {
          setTours(json.tours ?? []);
          setSummary(json.summary ?? null);
        }
      } catch {
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    const iv = setInterval(load, 20_000);
    return () => { active = false; clearInterval(iv); };
  }, [locationId]);

  if (!loading && tours.length === 0) return null;

  const TrendIcon = summary?.trend === 'up'
    ? TrendingUp
    : summary?.trend === 'down'
    ? TrendingDown
    : Minus;

  const activeTours = tours.filter((t) => t.status !== 'completed' && t.status !== 'abgeschlossen');

  return (
    <div className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-stone-100 dark:border-stone-800">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">
          <Trophy className="h-3.5 w-3.5" />
        </div>
        <div className="flex-1">
          <div className="text-xs font-black uppercase tracking-wide text-stone-700 dark:text-stone-200">
            Tour-Score Live · Visualisierung
          </div>
          {summary && (
            <div className="text-[10px] text-stone-400 flex items-center gap-1.5">
              <span>Ø Score: <span className="font-bold text-stone-600 dark:text-stone-300">{Math.round(summary.avgScore)}</span></span>
              <span>·</span>
              <span>Pünktlich: <span className="font-bold text-stone-600 dark:text-stone-300">{Math.round(summary.onTimePct)}%</span></span>
              <TrendIcon className={cn(
                'h-3 w-3',
                summary.trend === 'up' ? 'text-matcha-500' : summary.trend === 'down' ? 'text-red-500' : 'text-stone-400',
              )} />
            </div>
          )}
        </div>
        {summary && (
          <div className="text-right shrink-0">
            <div className="text-sm font-black tabular-nums text-stone-800 dark:text-stone-100">
              {summary.totalDeliveries}
            </div>
            <div className="text-[9px] text-stone-400">Lieferungen</div>
          </div>
        )}
      </div>

      {/* Summary row */}
      {summary && (
        <div className="grid grid-cols-3 gap-0 divide-x divide-stone-100 dark:divide-stone-800 border-b border-stone-100 dark:border-stone-800">
          {[
            { label: 'Top Score', value: Math.round(summary.topScore), color: 'text-matcha-600 dark:text-matcha-400' },
            { label: 'Ø Score', value: Math.round(summary.avgScore), color: 'text-amber-600 dark:text-amber-400' },
            { label: 'Min Score', value: Math.round(summary.bottomScore), color: 'text-red-500 dark:text-red-400' },
          ].map((kpi) => (
            <div key={kpi.label} className="flex flex-col items-center py-2 px-1">
              <div className={cn('text-base font-black tabular-nums', kpi.color)}>{kpi.value}</div>
              <div className="text-[9px] text-stone-400 font-semibold text-center">{kpi.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tour rows */}
      {loading && tours.length === 0 ? (
        <div className="space-y-2 p-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-14 bg-stone-100 dark:bg-stone-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="divide-y divide-stone-100 dark:divide-stone-800">
          {(activeTours.length > 0 ? activeTours : tours).slice(0, 8).map((t) => {
            const sc = scoreColor(t.score);
            const progress = t.stopsTotal > 0 ? (t.stopsCompleted / t.stopsTotal) * 100 : 0;

            return (
              <div key={t.batchId} className={cn('flex items-center gap-3 px-4 py-2.5', sc.bg)}>
                {/* Score arc */}
                <div className="relative shrink-0">
                  <ScoreArc score={t.score} />
                  <div className="absolute inset-0 flex items-center justify-center rotate-90">
                    <span className={cn('text-[10px] font-black tabular-nums', sc.text)}>
                      {Math.round(t.score)}
                    </span>
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-stone-800 dark:text-stone-100 truncate">
                      {t.driverName}
                    </span>
                    {t.zone && (
                      <span className="rounded-full bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 px-1.5 py-0.5 text-[9px] font-bold text-stone-600 dark:text-stone-300">
                        Zone {t.zone}
                      </span>
                    )}
                    {t.avgDeliveryMin !== null && (
                      <span className="text-[10px] text-stone-500 dark:text-stone-400">
                        Ø {Math.round(t.avgDeliveryMin)} Min
                      </span>
                    )}
                  </div>
                  {/* Progress */}
                  <div className="mt-1 flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-stone-200 dark:bg-stone-700 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-500', sc.bar)}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <span className="text-[9px] font-bold tabular-nums shrink-0 text-stone-500 dark:text-stone-400">
                      {t.stopsCompleted}/{t.stopsTotal}
                    </span>
                  </div>
                </div>

                {/* On-time */}
                <div className="shrink-0 text-right">
                  <div className={cn('text-xs font-black tabular-nums', sc.text)}>
                    {Math.round(t.onTimePct)}%
                  </div>
                  <div className="text-[9px] text-stone-400">pünktlich</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
