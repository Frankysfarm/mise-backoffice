'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock4, ChevronDown, ChevronUp } from 'lucide-react';

interface Order {
  id: string;
  created_at?: string;
  picked_up_at?: string | null;
  delivered_at?: string | null;
  status?: string;
}

interface Props {
  orders: Order[];
}

interface HourBucket {
  hour: number;
  label: string;
  count: number;
  avg_min: number;
}

function deliveryMin(o: Order): number | null {
  if (!o.delivered_at) return null;
  const start = o.picked_up_at ?? o.created_at;
  if (!start) return null;
  const diff = (new Date(o.delivered_at).getTime() - new Date(start).getTime()) / 60_000;
  return diff > 0 && diff < 180 ? diff : null;
}

function heatColor(avg: number) {
  if (avg <= 20) return { bg: 'bg-green-800/70', text: 'text-green-300' };
  if (avg <= 35) return { bg: 'bg-amber-800/70', text: 'text-amber-300' };
  return { bg: 'bg-red-800/70', text: 'text-red-300' };
}

export function KitchenPhase2069LieferzeitUebersicht({ orders }: Props) {
  const [open, setOpen] = useState(true);

  const { buckets, overallAvg } = useMemo(() => {
    const delivered = orders.filter(o => o.delivered_at && o.status === 'delivered');
    if (delivered.length === 0) return { buckets: [] as HourBucket[], overallAvg: 0 };

    const hourMap = new Map<number, number[]>();
    for (const o of delivered) {
      const dur = deliveryMin(o);
      if (dur === null) continue;
      const h = new Date(o.delivered_at as string).getHours();
      if (!hourMap.has(h)) hourMap.set(h, []);
      hourMap.get(h)!.push(dur);
    }

    const bkts: HourBucket[] = Array.from(hourMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([h, mins]) => ({
        hour: h,
        label: `${h.toString().padStart(2, '0')}:00`,
        count: mins.length,
        avg_min: Math.round(mins.reduce((s, m) => s + m, 0) / mins.length),
      }));

    const allMins = Array.from(hourMap.values()).flat();
    const avg = allMins.length > 0
      ? Math.round(allMins.reduce((s, m) => s + m, 0) / allMins.length)
      : 0;

    return { buckets: bkts, overallAvg: avg };
  }, [orders]);

  if (buckets.length === 0) return null;

  const maxCount = Math.max(...buckets.map(b => b.count), 1);

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-100 hover:bg-gray-800 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Clock4 className="w-4 h-4 text-blue-400" />
          Lieferzeit-Übersicht
          <span className="text-xs text-gray-400 font-normal">Ø nach Stunde</span>
          <span className="px-1.5 py-0.5 rounded-full text-xs bg-blue-950 text-blue-300 tabular-nums">
            Ø {overallAvg} Min
          </span>
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 pt-2 space-y-1.5">
          {buckets.map(b => {
            const colors = heatColor(b.avg_min);
            const widthPct = Math.round((b.count / maxCount) * 100);
            return (
              <div key={b.hour} className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400 tabular-nums w-10 shrink-0">{b.label}</span>
                <div className="flex-1 relative h-6 rounded overflow-hidden bg-gray-800/60">
                  <div
                    className={cn('absolute inset-y-0 left-0 rounded transition-all duration-700', colors.bg)}
                    style={{ width: `${widthPct}%` }}
                  />
                  <div className="absolute inset-0 flex items-center px-2 justify-between">
                    <span className={cn('text-[10px] font-semibold tabular-nums', colors.text)}>
                      Ø {b.avg_min} Min
                    </span>
                    <span className="text-[10px] text-gray-500 tabular-nums">
                      {b.count} Lief.
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
          <div className="flex items-center gap-3 pt-1 justify-end">
            <span className="flex items-center gap-1 text-[9px] text-gray-500">
              <span className="w-2 h-2 rounded-sm bg-green-800/70 inline-block" /> ≤20 Min
            </span>
            <span className="flex items-center gap-1 text-[9px] text-gray-500">
              <span className="w-2 h-2 rounded-sm bg-amber-800/70 inline-block" /> 21–35 Min
            </span>
            <span className="flex items-center gap-1 text-[9px] text-gray-500">
              <span className="w-2 h-2 rounded-sm bg-red-800/70 inline-block" /> &gt;35 Min
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
