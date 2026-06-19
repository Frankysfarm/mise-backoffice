'use client';

/**
 * KitchenFertigkeitsTrend — Pace-Analyse: Fertige Bestellungen je 15-Min-Fenster dieser Schicht.
 *
 * Zeigt:
 *  - Mini-Balken-Chart der letzten 8 × 15-Min-Slots
 *  - Aktueller Slot blinkt / wird hervorgehoben
 *  - Pace vs. Ziel-Linie (Soll-Durchsatz aus Slot-Länge)
 *  - "Trend" Chip: beschleunigt / stabil / verlangsamt
 */

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, Flame } from 'lucide-react';

interface Order {
  id: string;
  status: string;
  fertig_am: string | null;
}

interface Props {
  orders: Order[];
  targetPerHour?: number;
}

interface Slot {
  label: string;
  count: number;
  isCurrent: boolean;
}

function buildSlots(orders: Order[]): Slot[] {
  const now = new Date();
  const slots: Slot[] = [];
  for (let i = 7; i >= 0; i--) {
    const slotStart = new Date(now.getTime() - (i + 1) * 15 * 60_000);
    const slotEnd   = new Date(now.getTime() - i * 15 * 60_000);
    const count = orders.filter(o => {
      if (!o.fertig_am || !['fertig', 'geliefert'].includes(o.status)) return false;
      const t = new Date(o.fertig_am).getTime();
      return t >= slotStart.getTime() && t < slotEnd.getTime();
    }).length;
    const h = slotStart.getHours();
    const m = slotStart.getMinutes();
    slots.push({
      label: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
      count,
      isCurrent: i === 0,
    });
  }
  return slots;
}

export function KitchenFertigkeitsTrend({ orders, targetPerHour = 12 }: Props) {
  const slots = useMemo(() => buildSlots(orders), [orders]);
  const targetPer15 = targetPerHour / 4;
  const maxVal = Math.max(...slots.map(s => s.count), targetPer15, 1);

  const recent3 = slots.slice(-3).map(s => s.count);
  const prev3   = slots.slice(-6, -3).map(s => s.count);
  const avgRecent = recent3.reduce((a, b) => a + b, 0) / 3;
  const avgPrev   = prev3.reduce((a, b) => a + b, 0) / 3;
  const trend: 'up' | 'down' | 'stable' =
    avgRecent > avgPrev + 0.5 ? 'up' : avgRecent < avgPrev - 0.5 ? 'down' : 'stable';

  const trendConfig = {
    up:     { icon: <TrendingUp className="h-3 w-3" />,   cls: 'text-matcha-700 bg-matcha-100', label: 'Beschleunigt' },
    down:   { icon: <TrendingDown className="h-3 w-3" />, cls: 'text-red-700 bg-red-100',       label: 'Verlangsamt' },
    stable: { icon: <Minus className="h-3 w-3" />,        cls: 'text-amber-700 bg-amber-100',   label: 'Stabil' },
  }[trend];

  const totalDone = orders.filter(o => ['fertig', 'geliefert'].includes(o.status)).length;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b">
        <Flame className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Fertigkeits-Trend · 15-Min-Slots</span>
        <span className={cn('ml-auto flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold', trendConfig.cls)}>
          {trendConfig.icon}
          {trendConfig.label}
        </span>
      </div>

      <div className="px-4 py-3">
        {/* Stats row */}
        <div className="flex items-center gap-4 mb-3 text-[11px]">
          <div>
            <span className="text-muted-foreground">Heute fertig: </span>
            <span className="font-black text-foreground">{totalDone}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Ziel: </span>
            <span className="font-black text-foreground">{targetPerHour}/Std</span>
          </div>
          <div>
            <span className="text-muted-foreground">Ø letzte 45 Min: </span>
            <span className={cn('font-black', avgRecent >= targetPer15 ? 'text-matcha-700' : 'text-amber-600')}>
              {(avgRecent * 4).toFixed(0)}/Std
            </span>
          </div>
        </div>

        {/* Bar chart */}
        <div className="flex items-end gap-1 h-16 relative">
          {/* Target line */}
          <div
            className="absolute left-0 right-0 border-t-2 border-dashed border-matcha-400/50 pointer-events-none"
            style={{ bottom: `${(targetPer15 / maxVal) * 100}%` }}
          />

          {slots.map((slot, i) => {
            const heightPct = maxVal > 0 ? (slot.count / maxVal) * 100 : 0;
            const isAboveTarget = slot.count >= targetPer15;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                <div className="relative w-full flex items-end" style={{ height: '52px' }}>
                  <div
                    className={cn(
                      'w-full rounded-t transition-all duration-500',
                      slot.isCurrent
                        ? 'bg-matcha-500 animate-pulse'
                        : isAboveTarget
                          ? 'bg-matcha-400'
                          : 'bg-amber-400',
                    )}
                    style={{ height: `${Math.max(2, heightPct)}%` }}
                  />
                  {slot.count > 0 && (
                    <span className="absolute -top-4 left-0 right-0 text-center text-[9px] font-black text-foreground">
                      {slot.count}
                    </span>
                  )}
                </div>
                <span className={cn('text-[7px] tabular-nums', slot.isCurrent ? 'font-black text-matcha-700' : 'text-muted-foreground')}>
                  {slot.label}
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-2 flex items-center gap-3 text-[9px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-matcha-400" /> ≥ Ziel</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-amber-400" /> Unter Ziel</span>
          <span className="flex items-center gap-1"><span className="inline-block border-t-2 border-dashed border-matcha-400 w-4" /> Ziel ({targetPer15}/Slot)</span>
        </div>
      </div>
    </div>
  );
}
