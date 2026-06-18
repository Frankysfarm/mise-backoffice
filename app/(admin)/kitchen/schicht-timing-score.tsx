'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Clock, ChevronDown, ChevronUp, Target } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface TimingStats {
  onTimeCount: number;
  lateCount: number;
  avgPrepMin: number;
  targetPrepMin: number;
  score: number; // 0–100
  trend: 'up' | 'down' | 'stable';
  buckets: { label: string; pct: number; count: number }[];
}

const MOCK: TimingStats = {
  onTimeCount: 31,
  lateCount: 7,
  avgPrepMin: 8.4,
  targetPrepMin: 10,
  score: 82,
  trend: 'up',
  buckets: [
    { label: '< 7 Min', pct: 38, count: 15 },
    { label: '7–10 Min', pct: 41, count: 16 },
    { label: '10–14 Min', pct: 13, count: 5 },
    { label: '> 14 Min', pct: 8, count: 3 },
  ],
};

function scoreColor(s: number) {
  if (s >= 80) return { ring: 'stroke-matcha-500', text: 'text-matcha-700', bg: 'bg-matcha-50' };
  if (s >= 60) return { ring: 'stroke-amber-400', text: 'text-amber-700', bg: 'bg-amber-50' };
  return { ring: 'stroke-red-500', text: 'text-red-700', bg: 'bg-red-50' };
}

function ScoreRing({ score }: { score: number }) {
  const r = 26;
  const circ = 2 * Math.PI * r;
  const filled = circ * (score / 100);
  const { ring, text } = scoreColor(score);
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={64} height={64} className="-rotate-90">
        <circle cx={32} cy={32} r={r} fill="none" stroke="currentColor" strokeWidth={5} className="text-muted/20" />
        <circle
          cx={32} cy={32} r={r} fill="none" strokeWidth={5}
          strokeDasharray={`${filled} ${circ}`}
          strokeLinecap="round"
          className={cn('transition-all duration-700', ring)}
        />
      </svg>
      <span className={cn('absolute text-sm font-black tabular-nums', text)}>{score}</span>
    </div>
  );
}

export function KitchenSchichtTimingScore({
  locationId,
}: {
  locationId?: string | null;
}) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<TimingStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!locationId) {
      setData(MOCK);
      return;
    }
    setLoading(true);
    fetch(`/api/delivery/admin/kitchen-timing-score?location_id=${encodeURIComponent(locationId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.score !== undefined) setData(d as TimingStats);
        else setData(MOCK);
      })
      .catch(() => setData(MOCK))
      .finally(() => setLoading(false));
  }, [locationId]);

  const d = data ?? MOCK;
  const { text, bg } = scoreColor(d.score);
  const totalOrders = d.onTimeCount + d.lateCount;
  const onTimePct = totalOrders > 0 ? Math.round((d.onTimeCount / totalOrders) * 100) : 0;

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-matcha-600 shrink-0" />
          <span className="text-xs font-bold uppercase tracking-wider">Schicht-Timing-Score</span>
          <span className={cn('ml-1 rounded-full px-2 py-0.5 text-[9px] font-black', bg, text)}>
            {d.score}/100
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t px-4 py-3 space-y-3">
          {/* Score + KPIs */}
          <div className="flex items-center gap-4">
            <ScoreRing score={d.score} />
            <div className="flex-1 grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-matcha-50 p-2 text-center">
                <div className="text-sm font-black text-matcha-700 tabular-nums">{onTimePct}%</div>
                <div className="text-[9px] font-semibold text-muted-foreground">Pünktlich</div>
              </div>
              <div className="rounded-xl bg-amber-50 p-2 text-center">
                <div className="text-sm font-black text-amber-700 tabular-nums">{d.avgPrepMin.toFixed(1)}m</div>
                <div className="text-[9px] font-semibold text-muted-foreground">Ø Prep</div>
              </div>
              <div className="rounded-xl bg-muted p-2 text-center">
                <div className={cn('text-sm font-black tabular-nums flex items-center justify-center gap-0.5', d.trend === 'up' ? 'text-matcha-700' : d.trend === 'down' ? 'text-red-600' : 'text-foreground')}>
                  {d.trend === 'up' ? <TrendingUp className="h-3 w-3" /> : d.trend === 'down' ? <TrendingDown className="h-3 w-3" /> : null}
                  {d.trend === 'up' ? '↑' : d.trend === 'down' ? '↓' : '→'}
                </div>
                <div className="text-[9px] font-semibold text-muted-foreground">Trend</div>
              </div>
            </div>
          </div>

          {/* Distribution buckets */}
          <div>
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Prep-Zeit-Verteilung · {totalOrders} Bestellungen
            </div>
            <div className="space-y-1">
              {d.buckets.map((b) => (
                <div key={b.label} className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-[10px] text-muted-foreground">{b.label}</span>
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-matcha-400 transition-all duration-700"
                      style={{ width: `${b.pct}%` }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right text-[10px] font-bold tabular-nums">{b.pct}%</span>
                  <span className="w-6 shrink-0 text-right text-[9px] text-muted-foreground">n={b.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Target */}
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3 shrink-0" />
            <span>Ziel-Prep-Zeit: <strong className="text-foreground">{d.targetPrepMin} Min</strong></span>
            {d.lateCount > 0 && (
              <span className="ml-auto text-red-500 font-bold">{d.lateCount} spät</span>
            )}
          </div>

          {!locationId && (
            <div className="text-[10px] text-muted-foreground">⚠ Demo-Daten — Echtdaten benötigen Kitchen-Timing-API</div>
          )}
        </div>
      )}
    </Card>
  );
}
