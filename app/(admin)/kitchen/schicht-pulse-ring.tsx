'use client';

import { useMemo, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Zap } from 'lucide-react';

type Order = {
  status: string;
  bestellt_am: string | null;
};

type HourlyBucket = { h: number; label: string; orders: number };

type Props = {
  orders: Order[];
  completedToday: number | null;
  hourlyData: HourlyBucket[];
};

function SvgRing({ pct, color }: { pct: number; color: string }) {
  const R = 36;
  const C = 2 * Math.PI * R;
  const dash = Math.min(pct / 100, 1) * C;
  return (
    <svg width="100" height="100" viewBox="0 0 100 100" className="shrink-0">
      <circle cx="50" cy="50" r={R} fill="none" stroke="currentColor" className="text-muted/20" strokeWidth="8" />
      <circle
        cx="50" cy="50" r={R}
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${C}`}
        strokeDashoffset={C / 4}
        transform="rotate(-90 50 50)"
        className="transition-all duration-700"
      />
    </svg>
  );
}

export function KitchenSchichtPulsRing({ orders, completedToday, hourlyData }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick(n => n + 1), 60_000);
    return () => clearInterval(iv);
  }, []);

  const { rate, pct, label, color } = useMemo(() => {
    // Use orders from the current hour bucket
    const nowH = new Date().getHours();
    const currentBucket = hourlyData.find(b => b.h === nowH);
    const recentlyDone = currentBucket?.orders ?? 0;

    const TARGET = 12;
    const rawPct = Math.min(Math.round((recentlyDone / TARGET) * 100), 150);

    let color: string;
    let label: string;
    if (recentlyDone >= TARGET)             { color = '#4ade80'; label = 'Ziel erreicht'; }
    else if (recentlyDone >= TARGET * 0.75) { color = '#fbbf24'; label = 'Gutes Tempo'; }
    else if (recentlyDone >= TARGET * 0.5)  { color = '#f97316'; label = 'Etwas langsam'; }
    else                                    { color = '#ef4444'; label = 'Unter Plan'; }

    return { rate: recentlyDone, pct: rawPct, label, color };
  }, [hourlyData]);

  const activeCount = orders.filter(o =>
    ['in_zubereitung', 'bestätigt'].includes(o.status)
  ).length;

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Zap className="h-4 w-4 text-matcha-600" />
        <span className="font-display text-xs font-bold uppercase tracking-wider">Schicht-Puls</span>
      </div>
      <div className="flex items-center gap-4">
        <div className="relative">
          <SvgRing pct={pct} color={color} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-black tabular-nums" style={{ color }}>{rate}</span>
            <span className="text-[9px] font-bold text-muted-foreground">/Std</span>
          </div>
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <div>
            <div className="text-xs font-bold" style={{ color }}>{label}</div>
            <div className="text-[10px] text-muted-foreground">Fertig in letzter Stunde</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-muted px-2.5 py-1">
              <div className="text-[10px] font-bold text-muted-foreground">Aktiv</div>
              <div className="text-sm font-black tabular-nums">{activeCount}</div>
            </div>
            <div className="rounded-lg bg-muted px-2.5 py-1">
              <div className="text-[10px] font-bold text-muted-foreground">Ziel</div>
              <div className="text-sm font-black tabular-nums">12/Std</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
