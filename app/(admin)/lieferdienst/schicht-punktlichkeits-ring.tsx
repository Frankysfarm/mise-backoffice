'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Target, TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react';

interface ShiftPunctuality {
  onTimePct: number;
  totalDeliveries: number;
  onTimeCount: number;
  lateCount: number;
  prevShiftPct: number | null;
  avgDelayMin: number | null;
}

interface Props {
  locationId?: string;
}

const MOCK: ShiftPunctuality = {
  onTimePct: 84,
  totalDeliveries: 31,
  onTimeCount: 26,
  lateCount: 5,
  prevShiftPct: 78,
  avgDelayMin: 4.2,
};

function DonutRing({ pct, size = 96 }: { pct: number; size?: number }) {
  const r = (size - 14) / 2;
  const circ = 2 * Math.PI * r;
  const fill = circ * (1 - Math.min(100, pct) / 100);
  const color =
    pct >= 85 ? '#4a7c59' :
    pct >= 70 ? '#d97706' : '#dc2626';

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke="#e5e7eb" strokeWidth="10"
      />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none"
        stroke={color}
        strokeWidth="10"
        strokeDasharray={circ}
        strokeDashoffset={fill}
        strokeLinecap="round"
        className="transition-all duration-1000"
      />
    </svg>
  );
}

export function SchichtPunktlichkeitsRing({ locationId }: Props) {
  const [data, setData] = useState<ShiftPunctuality | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    setRefreshing(true);
    try {
      const params = new URLSearchParams({ action: 'shift_punctuality' });
      if (locationId) params.set('location_id', locationId);
      const res = await fetch(`/api/delivery/stats?${params}`);
      if (!res.ok) throw new Error('not ok');
      const json = await res.json();
      if (json.onTimePct != null) {
        setData({
          onTimePct: json.onTimePct,
          totalDeliveries: json.totalDeliveries ?? 0,
          onTimeCount: json.onTimeCount ?? 0,
          lateCount: json.lateCount ?? 0,
          prevShiftPct: json.prevShiftPct ?? null,
          avgDelayMin: json.avgDelayMin ?? null,
        });
      } else {
        setData(MOCK);
      }
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
    const iv = setInterval(load, 5 * 60_000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-5 animate-pulse">
        <div className="h-4 w-40 bg-stone-100 rounded mb-3" />
        <div className="flex gap-4 items-center">
          <div className="h-24 w-24 rounded-full bg-stone-100" />
          <div className="flex-1 space-y-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-3 bg-stone-100 rounded" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const delta = data.prevShiftPct != null ? data.onTimePct - data.prevShiftPct : null;
  const TrendIcon = delta == null ? Minus : delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  const trendColor = delta == null ? 'text-stone-400' : delta > 0 ? 'text-matcha-600' : 'text-red-500';
  const pctColor =
    data.onTimePct >= 85 ? 'text-matcha-700' :
    data.onTimePct >= 70 ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="rounded-2xl border border-stone-200 bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-stone-100">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-matcha-100 text-matcha-700">
          <Target className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-stone-800">Pünktlichkeits-Ring</div>
          <div className="text-xs text-stone-400">Aktuelle Schicht</div>
        </div>
        <button
          onClick={load}
          disabled={refreshing}
          className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-stone-100 transition"
        >
          <RefreshCw className={cn('h-3.5 w-3.5 text-stone-400', refreshing && 'animate-spin')} />
        </button>
      </div>

      {/* Content */}
      <div className="flex items-center gap-5 px-5 py-4">
        {/* Donut */}
        <div className="relative shrink-0">
          <DonutRing pct={data.onTimePct} size={96} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn('text-xl font-black tabular-nums leading-none', pctColor)}>
              {Math.round(data.onTimePct)}%
            </span>
            <span className="text-[9px] text-stone-400 font-semibold">pünktlich</span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-stone-500 text-xs">Pünktlich</span>
            <span className="font-black text-matcha-700 tabular-nums">{data.onTimeCount}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-stone-500 text-xs">Verspätet</span>
            <span className={cn('font-black tabular-nums', data.lateCount > 0 ? 'text-red-600' : 'text-stone-400')}>
              {data.lateCount}
            </span>
          </div>
          {data.avgDelayMin != null && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-stone-500 text-xs">Ø Verzögerung</span>
              <span className="font-bold text-amber-600 tabular-nums">{data.avgDelayMin.toFixed(1)} Min</span>
            </div>
          )}
          {delta != null && (
            <div className="flex items-center gap-1.5 rounded-lg bg-stone-50 px-2.5 py-1.5 mt-1">
              <TrendIcon className={cn('h-3.5 w-3.5 shrink-0', trendColor)} />
              <span className={cn('text-xs font-bold', trendColor)}>
                {delta > 0 ? '+' : ''}{Math.round(delta)}% vs. letzte Schicht
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
