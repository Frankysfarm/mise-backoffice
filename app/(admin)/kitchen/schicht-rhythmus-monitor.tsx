'use client';

import React, { useMemo } from 'react';
import { Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RhythmusOrder {
  bestellt_am: string | null;
  status: string;
}

interface Props {
  orders: RhythmusOrder[];
}

// Aggregiert Bestellungen der letzten 30 Minuten in 5-Min-Slots.
// Zeigt ob die Küche einen gleichmäßigen Bestellfluss hat oder in Schüben arbeitet.
export function KitchenSchichtRhythmusMonitor({ orders }: Props) {
  const { slots, rhythmLabel, rhythmColor, cv } = useMemo(() => {
    const now = Date.now();
    const windowMs = 30 * 60 * 1000;
    const slotMs = 5 * 60 * 1000;
    const NUM_SLOTS = 6;

    const buckets = Array.from({ length: NUM_SLOTS }, (_, i) => {
      const slotStart = now - windowMs + i * slotMs;
      const slotEnd = slotStart + slotMs;
      const count = orders.filter((o) => {
        if (!o.bestellt_am) return false;
        const t = new Date(o.bestellt_am).getTime();
        return t >= slotStart && t < slotEnd;
      }).length;
      const label = `-${(NUM_SLOTS - i) * 5}m`;
      return { label, count };
    });

    const counts = buckets.map((b) => b.count);
    const total = counts.reduce((a, b) => a + b, 0);
    const mean = total / NUM_SLOTS;
    const variance =
      counts.reduce((acc, c) => acc + Math.pow(c - mean, 2), 0) / NUM_SLOTS;
    const stdDev = Math.sqrt(variance);
    const cvVal = mean > 0 ? stdDev / mean : 0;

    let rhythmLabel: string;
    let rhythmColor: string;
    if (total === 0) {
      rhythmLabel = 'Keine Bestellungen';
      rhythmColor = 'text-muted-foreground';
    } else if (cvVal < 0.3) {
      rhythmLabel = 'Gleichmäßiger Fluss';
      rhythmColor = 'text-matcha-700';
    } else if (cvVal < 0.7) {
      rhythmLabel = 'Leichte Schübe';
      rhythmColor = 'text-amber-600';
    } else {
      rhythmLabel = 'Stoß-Betrieb';
      rhythmColor = 'text-red-600';
    }

    return { slots: buckets, rhythmLabel, rhythmColor, cv: cvVal };
  }, [orders]);

  const maxCount = Math.max(...slots.map((s) => s.count), 1);

  if (slots.every((s) => s.count === 0)) return null;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white">
      <div className="flex items-center gap-3 px-5 py-3 border-b border-stone-100">
        <Activity className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
          Schicht-Rhythmus
        </span>
        <span className={cn('ml-auto text-xs font-bold', rhythmColor)}>
          {rhythmLabel}
        </span>
      </div>

      <div className="px-5 py-4">
        {/* Mini-Balkendiagramm */}
        <div className="flex items-end gap-1.5 h-12">
          {slots.map((slot, i) => {
            const pct = (slot.count / maxCount) * 100;
            const barColor =
              cv < 0.3
                ? 'bg-matcha-500'
                : cv < 0.7
                ? 'bg-amber-400'
                : 'bg-red-400';
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex items-end justify-center" style={{ height: 40 }}>
                  <div
                    className={cn('w-full rounded-t transition-all duration-500', barColor)}
                    style={{ height: `${Math.max(pct, slot.count > 0 ? 8 : 0)}%` }}
                  />
                </div>
                <span className="text-[9px] text-muted-foreground tabular-nums">
                  {slot.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Summe + CV-Info */}
        <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>
            {slots.reduce((a, s) => a + s.count, 0)} Bestellungen (30 Min)
          </span>
          <span className={cn('font-bold', rhythmColor)}>
            Varianz {Math.round(cv * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
}
