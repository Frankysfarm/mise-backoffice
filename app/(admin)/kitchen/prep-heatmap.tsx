'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';

const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

interface Order {
  id: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  status: string;
}

interface Props {
  orders: Order[];
}

function colorForMinutes(avg: number | null): string {
  if (avg === null) return 'bg-muted/30';
  if (avg <= 12) return 'bg-emerald-500';
  if (avg <= 18) return 'bg-emerald-300';
  if (avg <= 22) return 'bg-amber-400';
  if (avg <= 28) return 'bg-amber-500';
  return 'bg-red-500';
}

function labelForMinutes(avg: number | null): string {
  if (avg === null) return '–';
  return `${Math.round(avg)} Min`;
}

export function KitchenPrepHeatmap({ orders }: Props) {
  const heatmap = useMemo(() => {
    // Build 7×24 grid: [weekday 0=Mo][hour 0-23] => list of prep times
    const grid: number[][][] = Array.from({ length: 7 }, () =>
      Array.from({ length: 24 }, () => []),
    );

    for (const o of orders) {
      if (!o.bestellt_am || !o.geschaetzte_zubereitung_min) continue;
      const d = new Date(o.bestellt_am);
      // getDay() returns 0=Sunday, remap to 0=Monday
      const dayRaw = d.getDay();
      const day = dayRaw === 0 ? 6 : dayRaw - 1;
      const hour = d.getHours();
      grid[day][hour].push(o.geschaetzte_zubereitung_min);
    }

    return grid.map((dayRow) =>
      dayRow.map((cells) => {
        if (cells.length === 0) return null;
        return cells.reduce((a, b) => a + b, 0) / cells.length;
      }),
    );
  }, [orders]);

  const hasData = heatmap.some((row) => row.some((v) => v !== null));
  if (!hasData) return null;

  // Only show hours with any data to keep compact
  const activeHours = HOURS.filter((h) => heatmap.some((row) => row[h] !== null));
  if (activeHours.length === 0) return null;

  return (
    <div className="bg-card border rounded-xl p-4 overflow-x-auto">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm font-bold">Zubereitungszeit-Heatmap</span>
        <span className="text-xs text-muted-foreground">Ø Min je Wochentag &amp; Stunde</span>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        {[
          { color: 'bg-emerald-500', label: '≤12 Min' },
          { color: 'bg-emerald-300', label: '13–18 Min' },
          { color: 'bg-amber-400',   label: '19–22 Min' },
          { color: 'bg-amber-500',   label: '23–28 Min' },
          { color: 'bg-red-500',     label: '>28 Min' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className={cn('inline-block h-3 w-5 rounded-sm', color)} />
            {label}
          </div>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-0.5 text-[10px]">
          <thead>
            <tr>
              <th className="w-7 pr-1 text-right text-muted-foreground font-normal" />
              {activeHours.map((h) => (
                <th key={h} className="w-7 text-center text-muted-foreground font-normal pb-1">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map((day, di) => (
              <tr key={day}>
                <td className="pr-1 text-right text-muted-foreground font-medium w-7">{day}</td>
                {activeHours.map((h) => {
                  const val = heatmap[di][h];
                  return (
                    <td
                      key={h}
                      title={val !== null ? `${day} ${h}:00 — Ø ${Math.round(val)} Min` : `${day} ${h}:00 — keine Daten`}
                      className={cn(
                        'h-7 w-7 rounded-sm text-center align-middle transition-opacity',
                        colorForMinutes(val),
                        val === null ? 'opacity-20' : 'opacity-90 hover:opacity-100',
                      )}
                    >
                      {val !== null ? (
                        <span className="text-white font-bold drop-shadow-sm">{Math.round(val)}</span>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
