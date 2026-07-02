'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Euro, TrendingUp, Zap } from 'lucide-react';

interface Props {
  driverId?: string | null;
  goalEur?: number; // daily earnings goal, default 80
}

interface EarningsData {
  totalEur: number;
  deliveries: number;
  avgPerDelivery: number;
  shiftStartedAt: string | null;
  projectedEur: number | null;
}

const MOCK: EarningsData = {
  totalEur: 48.50,
  deliveries: 12,
  avgPerDelivery: 4.04,
  shiftStartedAt: null,
  projectedEur: 72.00,
};

export function FahrerSchichtErtragsMeter({ driverId, goalEur = 80 }: Props) {
  const [data, setData] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!driverId) { setData(MOCK); setLoading(false); return; }
    const load = async () => {
      try {
        const r = await fetch(`/api/delivery/driver/earnings?driver_id=${driverId}`);
        if (!r.ok) throw new Error();
        const d = await r.json();
        setData({
          totalEur: d.totalEur ?? MOCK.totalEur,
          deliveries: d.deliveries ?? MOCK.deliveries,
          avgPerDelivery: d.avgPerDelivery ?? MOCK.avgPerDelivery,
          shiftStartedAt: d.shiftStartedAt ?? null,
          projectedEur: d.projectedEur ?? null,
        });
      } catch {
        setData(MOCK);
      } finally {
        setLoading(false);
      }
    };
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [driverId]);

  if (loading) {
    return <div className="h-28 rounded-2xl bg-stone-700 animate-pulse" />;
  }

  if (!data) return null;

  const fillPct = Math.min(100, Math.round((data.totalEur / goalEur) * 100));
  const reachedGoal = data.totalEur >= goalEur;

  const fmtEur = (v: number) =>
    v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // SVG arc meter
  const R = 40;
  const cx = 56;
  const cy = 56;
  const startAngle = -210; // degrees
  const sweepAngle = 240;  // degrees
  const toRad = (d: number) => (d * Math.PI) / 180;
  const polarToCart = (angle: number, r: number) => ({
    x: cx + r * Math.cos(toRad(angle)),
    y: cy + r * Math.sin(toRad(angle)),
  });

  const arcPath = (pct: number) => {
    const sweep = (pct / 100) * sweepAngle;
    const endAngle = startAngle + sweep;
    const start = polarToCart(startAngle, R);
    const end = polarToCart(endAngle, R);
    const largeArc = sweep > 180 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${R} ${R} 0 ${largeArc} 1 ${end.x} ${end.y}`;
  };

  const trackStart = polarToCart(startAngle, R);
  const trackEnd = polarToCart(startAngle + sweepAngle, R);

  return (
    <div className="rounded-2xl bg-gradient-to-br from-stone-900 to-stone-800 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-400/20">
            <Euro className="h-3.5 w-3.5 text-amber-400" />
          </div>
          <span className="text-sm font-bold text-white">Schicht-Einnahmen</span>
        </div>
        {reachedGoal && (
          <div className="flex items-center gap-1 rounded-full bg-matcha-500/20 px-2 py-0.5">
            <Zap className="h-3 w-3 text-matcha-400" />
            <span className="text-[10px] font-bold text-matcha-400">Ziel erreicht!</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        {/* SVG arc meter */}
        <svg width="112" height="80" viewBox="0 0 112 90" className="shrink-0">
          {/* Track */}
          <path
            d={arcPath(100)}
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="8"
            strokeLinecap="round"
          />
          {/* Fill */}
          <path
            d={arcPath(fillPct)}
            fill="none"
            stroke={reachedGoal ? '#7aad3a' : fillPct > 60 ? '#f59e0b' : '#60a5fa'}
            strokeWidth="8"
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s ease' }}
          />
          {/* Center text */}
          <text
            x={cx}
            y={cy - 4}
            textAnchor="middle"
            className="fill-white"
            fontSize="16"
            fontWeight="900"
            fontFamily="monospace"
          >
            {fmtEur(data.totalEur)}€
          </text>
          <text
            x={cx}
            y={cy + 12}
            textAnchor="middle"
            fill="rgba(255,255,255,0.5)"
            fontSize="8"
            fontWeight="600"
          >
            von {fmtEur(goalEur)}€ Ziel
          </text>
        </svg>

        {/* Stats */}
        <div className="flex-1 space-y-2">
          <div className="rounded-xl bg-white/5 p-2.5">
            <div className="text-[9px] text-stone-400 uppercase tracking-wide">Lieferungen</div>
            <div className="text-lg font-black tabular-nums text-white">{data.deliveries}</div>
          </div>
          <div className="rounded-xl bg-white/5 p-2.5">
            <div className="text-[9px] text-stone-400 uppercase tracking-wide">Ø pro Lieferung</div>
            <div className="text-base font-black tabular-nums text-white">{fmtEur(data.avgPerDelivery)}€</div>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-[9px] text-stone-400">
          <span>Fortschritt zum Tagesziel</span>
          <span className="font-bold text-white">{fillPct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-1000',
              reachedGoal ? 'bg-matcha-400' : fillPct > 60 ? 'bg-amber-400' : 'bg-blue-400',
            )}
            style={{ width: `${fillPct}%` }}
          />
        </div>
      </div>

      {data.projectedEur && !reachedGoal && (
        <div className="flex items-center gap-1.5 text-[10px] text-stone-400">
          <TrendingUp className="h-3 w-3 text-blue-400 shrink-0" />
          Prognose: <strong className="text-white">{fmtEur(data.projectedEur)}€</strong> bis Schichtende
        </div>
      )}
    </div>
  );
}
