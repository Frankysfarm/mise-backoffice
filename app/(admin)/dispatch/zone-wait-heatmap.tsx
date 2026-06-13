'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, Clock, Package } from 'lucide-react';

type Order = {
  bestellnummer: string;
  delivery_zone: string | null;
  fertig_am: string | null;
  status: string;
};

type ZoneEntry = {
  zone: string;
  total: number;
  ready: number;
  avgWaitMin: number;
  maxWaitMin: number;
};

function computeZones(orders: Order[]): ZoneEntry[] {
  const now = Date.now();
  const map = new Map<string, { total: number; waits: number[] }>();

  for (const o of orders) {
    if (!o.delivery_zone) continue;
    if (!map.has(o.delivery_zone)) map.set(o.delivery_zone, { total: 0, waits: [] });
    const z = map.get(o.delivery_zone)!;
    z.total++;
    if (o.status === 'fertig' && o.fertig_am) {
      const waitMin = Math.round((now - new Date(o.fertig_am).getTime()) / 60_000);
      if (waitMin >= 0) z.waits.push(waitMin);
    }
  }

  const result: ZoneEntry[] = [];
  for (const [zone, data] of map) {
    const waits = data.waits;
    const avg = waits.length > 0 ? Math.round(waits.reduce((a, b) => a + b, 0) / waits.length) : 0;
    const max = waits.length > 0 ? Math.max(...waits) : 0;
    result.push({ zone, total: data.total, ready: waits.length, avgWaitMin: avg, maxWaitMin: max });
  }

  return result.sort((a, b) => b.maxWaitMin - a.maxWaitMin || b.ready - a.ready);
}

function waitColor(maxMin: number, hasReady: boolean): { bar: string; text: string; bg: string } {
  if (!hasReady) return { bar: 'bg-gray-200', text: 'text-gray-500', bg: 'bg-gray-50' };
  if (maxMin > 15) return { bar: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50' };
  if (maxMin > 5) return { bar: 'bg-amber-400', text: 'text-amber-700', bg: 'bg-amber-50' };
  return { bar: 'bg-matcha-500', text: 'text-matcha-700', bg: 'bg-matcha-50' };
}

export function ZoneWaitHeatmap({ orders }: { orders: Order[] }) {
  const zones = useMemo(() => computeZones(orders), [orders]);

  const withZone = orders.filter((o) => o.delivery_zone);
  if (withZone.length === 0 || zones.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center gap-2 border-b px-4 py-2.5 bg-muted/30">
        <MapPin className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Zonen-Wartezeiten
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground">
          {zones.filter((z) => z.ready > 0).length} Zonen warten
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-3">
        {zones.slice(0, 6).map((z) => {
          const { bar, text, bg } = waitColor(z.maxWaitMin, z.ready > 0);
          const barPct = Math.min(100, (z.maxWaitMin / 20) * 100);
          return (
            <div key={z.zone} className={cn('rounded-lg border p-2.5', bg)}>
              <div className="flex items-center justify-between mb-1">
                <span className={cn('text-[11px] font-black', text)}>{z.zone}</span>
                <div className="flex items-center gap-1">
                  {z.ready > 0 && (
                    <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-bold', text, bg)}>
                      {z.ready} bereit
                    </span>
                  )}
                  <span className="text-[9px] text-muted-foreground">
                    {z.total} ges.
                  </span>
                </div>
              </div>
              {/* Wait bar */}
              <div className="h-1.5 rounded-full bg-black/10 overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-700', bar)}
                  style={{ width: `${barPct}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-1">
                <div className="flex items-center gap-0.5 text-[9px] text-muted-foreground">
                  <Clock className="h-2.5 w-2.5" />
                  {z.ready > 0 ? `max ${z.maxWaitMin} Min` : 'kochend'}
                </div>
                {z.avgWaitMin > 0 && (
                  <span className="text-[9px] text-muted-foreground">Ø {z.avgWaitMin} Min</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
