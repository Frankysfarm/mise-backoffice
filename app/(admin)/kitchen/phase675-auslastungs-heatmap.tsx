'use client';

/**
 * Phase 675 — Küchen-Auslastungs-Heatmap-Stunden
 * Zeigt welche Stunden heute am stärksten waren (Bestellungsanzahl je Stunde 0–23).
 * Props: orders: Order[] (aus Kitchen client.tsx)
 */

import React, { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Flame, ChevronDown, ChevronUp } from 'lucide-react';

type Order = { created_at?: string; status?: string };

export function KitchenPhase675AuslastungsHeatmap({ orders }: { orders: Order[] }) {
  const [open, setOpen] = useState(false);

  const hourBuckets = useMemo(() => {
    const buckets = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }));
    for (const o of orders) {
      if (!o.created_at) continue;
      const h = new Date(o.created_at).getHours();
      buckets[h].count++;
    }
    return buckets;
  }, [orders]);

  const maxCount = Math.max(1, ...hourBuckets.map(b => b.count));
  const totalOrders = orders.length;

  // Nur Stunden mit mindestens 1 Bestellung anzeigen (max 12 sichtbar)
  const activeHours = hourBuckets.filter(b => b.count > 0);
  const peakHour = hourBuckets.reduce((p, c) => c.count > p.count ? c : p, hourBuckets[0]);

  const heatColor = (count: number) => {
    const ratio = count / maxCount;
    if (ratio >= 0.8) return 'bg-red-500 text-white';
    if (ratio >= 0.6) return 'bg-orange-400 text-white';
    if (ratio >= 0.4) return 'bg-amber-400 text-white';
    if (ratio >= 0.2) return 'bg-matcha-400 text-white';
    if (ratio > 0)    return 'bg-matcha-200 text-matcha-800';
    return 'bg-muted/40 text-muted-foreground';
  };

  if (totalOrders === 0) return null;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-orange-500 shrink-0" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">
            Auslastungs-Heatmap heute
          </span>
          {peakHour.count > 0 && (
            <span className="rounded-full bg-orange-100 text-orange-700 px-2 py-0.5 text-[10px] font-bold">
              Peak {peakHour.hour}:00 Uhr · {peakHour.count} Best.
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t px-4 py-4 space-y-3">
          {/* Stunden-Grid 6–23 */}
          <div className="grid grid-cols-9 gap-1">
            {hourBuckets.slice(6).map(b => (
              <div key={b.hour} className="flex flex-col items-center gap-0.5">
                <div
                  className={cn(
                    'w-full flex items-center justify-center rounded-md font-mono text-[10px] font-black',
                    heatColor(b.count),
                  )}
                  style={{ height: `${Math.max(20, (b.count / maxCount) * 56 + 20)}px` }}
                  title={`${b.hour}:00 Uhr — ${b.count} Bestellungen`}
                >
                  {b.count > 0 ? b.count : ''}
                </div>
                <span className="text-[8px] text-muted-foreground tabular-nums">{b.hour}</span>
              </div>
            ))}
          </div>

          {/* Legende */}
          <div className="flex items-center gap-3 flex-wrap text-[10px]">
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 rounded-sm bg-red-500" />
              <span className="text-muted-foreground">Sehr stark (≥80%)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 rounded-sm bg-amber-400" />
              <span className="text-muted-foreground">Mittel (40–79%)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 rounded-sm bg-matcha-300" />
              <span className="text-muted-foreground">Schwach (&lt;40%)</span>
            </div>
          </div>

          {/* Zusammenfassung */}
          <div className="rounded-xl bg-muted/30 px-3 py-2 flex flex-wrap gap-4 text-[11px]">
            <div>
              <span className="font-bold text-foreground">{totalOrders}</span>{' '}
              <span className="text-muted-foreground">Bestellungen gesamt</span>
            </div>
            <div>
              <span className="font-bold text-foreground">{activeHours.length}</span>{' '}
              <span className="text-muted-foreground">aktive Stunden</span>
            </div>
            <div>
              <span className="font-bold text-orange-600">{peakHour.hour}:00–{peakHour.hour + 1}:00 Uhr</span>{' '}
              <span className="text-muted-foreground">Peak</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
