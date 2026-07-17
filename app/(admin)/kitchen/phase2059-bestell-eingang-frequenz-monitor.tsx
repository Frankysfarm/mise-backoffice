'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Activity, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';

interface Order {
  id: string;
  created_at?: string;
  status?: string;
}

interface Props {
  orders: Order[];
}

const SLOT_MIN = 5;
const SLOTS = 12;
const PEAK_THRESHOLD = 4;
const WARN_THRESHOLD = 3;

export function KitchenPhase2059BestellEingangFrequenzMonitor({ orders }: Props) {
  const [open, setOpen] = useState(true);

  const { slots, maxCount, peakSlot, totalLast60 } = useMemo(() => {
    const now = Date.now();
    const windowMs = SLOTS * SLOT_MIN * 60_000;
    const since = now - windowMs;

    const recent = orders.filter(o => {
      if (!o.created_at) return false;
      return new Date(o.created_at).getTime() >= since;
    });

    const slotCounts = Array.from({ length: SLOTS }, (_, i) => {
      const slotStart = since + i * SLOT_MIN * 60_000;
      const slotEnd = slotStart + SLOT_MIN * 60_000;
      return recent.filter(o => {
        const t = new Date(o.created_at ?? 0).getTime();
        return t >= slotStart && t < slotEnd;
      }).length;
    });

    const max = Math.max(...slotCounts, 1);
    const peak = slotCounts.reduce((best, count, i) => (count > slotCounts[best] ? i : best), 0);

    return {
      slots: slotCounts,
      maxCount: max,
      peakSlot: peak,
      totalLast60: recent.length,
    };
  }, [orders]);

  const hasPeak = slots[peakSlot] >= PEAK_THRESHOLD;

  const slotLabel = (i: number) => {
    const minsAgo = (SLOTS - i) * SLOT_MIN;
    return minsAgo === 0 ? 'jetzt' : `-${minsAgo}m`;
  };

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-100 hover:bg-gray-800 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-400" />
          Bestelleingang-Frequenz
          <span className="text-xs text-gray-400 font-normal">letzte 60 Min</span>
          {hasPeak && (
            <span className="px-1.5 py-0.5 rounded-full text-xs bg-amber-900 text-amber-300">
              Peak
            </span>
          )}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {hasPeak && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-950 border border-amber-800 px-3 py-2 text-xs text-amber-300">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              Peak erkannt: {slots[peakSlot]} Bestellungen in 5 Min — Kapazität prüfen!
            </div>
          )}

          <div className="flex items-center justify-between rounded-lg bg-gray-800 px-3 py-2 text-xs text-gray-300">
            <span>Gesamt letzte 60 Min</span>
            <span className="font-bold text-sm text-blue-300">{totalLast60} Bestellungen</span>
          </div>

          <div className="flex items-end gap-1 h-20">
            {slots.map((count, i) => {
              const pct = (count / maxCount) * 100;
              const isPeak = i === peakSlot && count >= PEAK_THRESHOLD;
              const isWarn = count >= WARN_THRESHOLD && !isPeak;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                  <div className="flex-1 w-full flex items-end">
                    <div
                      className={cn(
                        'w-full rounded-t transition-all',
                        isPeak ? 'bg-amber-400' : isWarn ? 'bg-yellow-500' : 'bg-blue-600',
                      )}
                      style={{ height: `${Math.max(pct, 4)}%` }}
                    />
                  </div>
                  {(i === 0 || i === SLOTS - 1 || i === Math.floor(SLOTS / 2)) && (
                    <span className="text-[8px] text-gray-500 tabular-nums">{slotLabel(i)}</span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-3 text-[10px] text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-blue-600 inline-block" />normal</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-yellow-500 inline-block" />erhöht (≥{WARN_THRESHOLD})</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-amber-400 inline-block" />Peak (≥{PEAK_THRESHOLD})</span>
          </div>
        </div>
      )}
    </div>
  );
}
