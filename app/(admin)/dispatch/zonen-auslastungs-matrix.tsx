'use client';

import { useMemo } from 'react';
import { MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

type BatchStop = { geliefert_am: string | null };
type Batch = { status: string; zone: string | null; stops: BatchStop[] };

interface Props { batches: Batch[] }

const ZONES = ['A', 'B', 'C', 'D'] as const;
type Zone = typeof ZONES[number];

const ZONE_STYLE: Record<Zone, { bg: string; text: string; badgeBg: string; barColor: string }> = {
  A: { bg: 'bg-emerald-50', text: 'text-emerald-700', badgeBg: 'bg-emerald-100', barColor: '#10b981' },
  B: { bg: 'bg-blue-50',    text: 'text-blue-700',    badgeBg: 'bg-blue-100',    barColor: '#3b82f6' },
  C: { bg: 'bg-amber-50',   text: 'text-amber-700',   badgeBg: 'bg-amber-100',   barColor: '#f59e0b' },
  D: { bg: 'bg-red-50',     text: 'text-red-700',     badgeBg: 'bg-red-100',     barColor: '#ef4444' },
};

const ACTIVE_STATUSES = new Set(['assigned', 'on_route', 'en_route', 'unterwegs', 'active']);

export function DispatchZonenAuslastungsMatrix({ batches }: Props) {
  const zoneStats = useMemo(() => {
    const active = batches.filter(b => ACTIVE_STATUSES.has(b.status));
    return ZONES.map(zone => {
      const zb = active.filter(b => b.zone === zone);
      const total = zb.reduce((s, b) => s + b.stops.length, 0);
      const done  = zb.reduce((s, b) => s + b.stops.filter(s2 => s2.geliefert_am).length, 0);
      return { zone, tours: zb.length, total, done, remaining: total - done };
    });
  }, [batches]);

  if (!zoneStats.some(z => z.tours > 0)) return null;

  return (
    <div className="rounded-xl border border-stone-100 bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <MapPin className="h-4 w-4 text-stone-400" />
        <span className="text-xs font-bold text-stone-700">Zonen-Auslastung</span>
        <span className="ml-auto text-[10px] font-semibold text-stone-400">Aktive Touren</span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {zoneStats.map(z => {
          const s = ZONE_STYLE[z.zone];
          const pct = z.total > 0 ? (z.done / z.total) * 100 : 0;
          return (
            <div key={z.zone} className={cn('rounded-lg p-2.5 text-center', s.bg)}>
              <div className={cn('mb-1 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-black', s.badgeBg, s.text)}>
                Zone {z.zone}
              </div>
              <div className={cn('mt-1 text-xl font-black tabular-nums', s.text)}>{z.tours}</div>
              <div className="mb-1.5 text-[9px] font-semibold text-stone-400">
                {z.tours === 1 ? 'Tour' : 'Touren'}
              </div>
              {z.total > 0 && (
                <>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/70">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: s.barColor }}
                    />
                  </div>
                  <div className="mt-1 text-[8px] font-semibold text-stone-400">
                    {z.done}/{z.total} Stops
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
