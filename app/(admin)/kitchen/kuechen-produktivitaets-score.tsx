'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Gauge, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';

interface Factors {
  throughputScore: number;
  queueHealthScore: number;
  timingScore: number;
  ordersLast60Min: number;
  historicAvgPerHour: number;
  overdueCount: number;
  totalActiveCount: number;
  onTimePct: number;
}

interface ApiResponse {
  ok: boolean;
  score: number;
  label: 'exzellent' | 'gut' | 'mittel' | 'schwach';
  factors: Factors;
  trend: 'up' | 'down' | 'flat';
  recommendation: string;
  generatedAt: string;
}

interface Props {
  locationId?: string | null;
}

const LABEL_STYLE: Record<string, { bg: string; badge: string; bar: string }> = {
  exzellent: { bg: 'bg-matcha-50 border-matcha-200', badge: 'bg-matcha-600 text-white', bar: 'bg-matcha-500' },
  gut:       { bg: 'bg-blue-50 border-blue-200',     badge: 'bg-blue-600 text-white',   bar: 'bg-blue-500'   },
  mittel:    { bg: 'bg-amber-50 border-amber-200',   badge: 'bg-amber-500 text-white',  bar: 'bg-amber-400'  },
  schwach:   { bg: 'bg-red-50 border-red-200',       badge: 'bg-red-600 text-white',    bar: 'bg-red-500'    },
};

const LABEL_DE: Record<string, string> = {
  exzellent: 'Exzellent', gut: 'Gut', mittel: 'Mittel', schwach: 'Schwach',
};

export function KitchenProduktivitaetsScore({ locationId }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!locationId) { setLoading(false); return; }
    const load = () => {
      fetch(`/api/delivery/admin/kuechen-produktivitaets-score?location_id=${encodeURIComponent(locationId)}`)
        .then(r => r.json())
        .then((d: ApiResponse) => { if (d.ok) setData(d); })
        .catch(() => {})
        .finally(() => setLoading(false));
    };
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (loading) {
    return (
      <Card className="border p-4">
        <div className="h-4 w-48 bg-stone-100 animate-pulse rounded mb-3" />
        <div className="h-12 bg-stone-100 animate-pulse rounded" />
      </Card>
    );
  }
  if (!data || !locationId) return null;

  const style = LABEL_STYLE[data.label] ?? LABEL_STYLE.mittel;
  const scorePct = data.score;
  const f = data.factors;

  const TrendIcon = data.trend === 'up' ? TrendingUp : data.trend === 'down' ? TrendingDown : Minus;
  const trendColor = data.trend === 'up' ? 'text-matcha-600' : data.trend === 'down' ? 'text-red-500' : 'text-muted-foreground';

  const subScores = [
    { label: 'Durchsatz', max: 40, val: f.throughputScore, bar: 'bg-blue-400' },
    { label: 'Queue-Gesundheit', max: 30, val: f.queueHealthScore, bar: 'bg-matcha-400' },
    { label: 'Pünktlichkeit', max: 30, val: f.timingScore, bar: 'bg-violet-400' },
  ];

  return (
    <Card className={cn('border overflow-hidden', style.bg)}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-black/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-bold text-foreground">Küchen-Produktivitäts-Score</span>
          <span className={cn('rounded-full px-2.5 py-0.5 text-[10px] font-black', style.badge)}>
            {LABEL_DE[data.label]} · {data.score}/100
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <TrendIcon className={cn('h-3.5 w-3.5', trendColor)} />
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-black/10 px-4 py-3 space-y-3">
          {/* Main score bar */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[11px] text-muted-foreground">Gesamt-Score</span>
              <span className="text-[11px] font-black tabular-nums">{data.score} / 100</span>
            </div>
            <div className="h-3 rounded-full bg-black/10 overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-700', style.bar)}
                style={{ width: `${scorePct}%` }}
              />
            </div>
          </div>

          {/* Sub-scores */}
          <div className="space-y-2">
            {subScores.map(s => (
              <div key={s.label} className="flex items-center gap-3">
                <span className="w-32 shrink-0 text-[11px] text-muted-foreground truncate">{s.label}</span>
                <div className="flex-1 h-1.5 rounded-full bg-black/10 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-700', s.bar)}
                    style={{ width: `${(s.val / s.max) * 100}%` }}
                  />
                </div>
                <span className="w-12 shrink-0 text-right text-[11px] font-bold tabular-nums">
                  {s.val}/{s.max}
                </span>
              </div>
            ))}
          </div>

          {/* KPI chips */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-white/60 p-2 text-center">
              <div className="text-base font-black tabular-nums">{f.ordersLast60Min}</div>
              <div className="text-[9px] text-muted-foreground">Aufträge/h</div>
            </div>
            <div className="rounded-xl bg-white/60 p-2 text-center">
              <div className={cn('text-base font-black tabular-nums', f.overdueCount > 0 ? 'text-red-600' : 'text-matcha-600')}>
                {f.overdueCount}
              </div>
              <div className="text-[9px] text-muted-foreground">Überfällig</div>
            </div>
            <div className="rounded-xl bg-white/60 p-2 text-center">
              <div className={cn('text-base font-black tabular-nums', f.onTimePct >= 80 ? 'text-matcha-600' : f.onTimePct >= 60 ? 'text-amber-600' : 'text-red-600')}>
                {f.onTimePct}%
              </div>
              <div className="text-[9px] text-muted-foreground">Pünktlich</div>
            </div>
          </div>

          {/* Recommendation */}
          {data.recommendation && (
            <div className={cn(
              'flex items-start gap-2 rounded-xl p-2.5 text-[11px]',
              data.label === 'schwach' || f.overdueCount > 2
                ? 'bg-red-100 text-red-800'
                : 'bg-white/60 text-muted-foreground',
            )}>
              {(data.label === 'schwach' || f.overdueCount > 2) && (
                <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5 text-red-600" />
              )}
              <span>{data.recommendation}</span>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
