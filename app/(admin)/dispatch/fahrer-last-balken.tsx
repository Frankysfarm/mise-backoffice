'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Users } from 'lucide-react';

interface Stop {
  id: string;
  geliefert_am: string | null;
}

interface BatchMin {
  id: string;
  status: string;
  fahrer_id: string | null;
  fahrer: { vorname: string; nachname: string } | null;
  stops: Stop[];
}

interface DriverMin {
  employee_id: string;
  ist_online: boolean;
  aktueller_batch_id: string | null;
  employee: { id: string; vorname: string; nachname: string } | null;
}

interface Props {
  batches: BatchMin[];
  drivers: DriverMin[];
}

export function DispatchFahrerLastBalken({ batches, drivers }: Props) {
  const rows = useMemo(() => {
    const activeBatches = batches.filter((b) =>
      ['dispatched', 'active', 'picking_up', 'en_route', 'assigned'].includes(b.status),
    );

    const onlineDrivers = drivers.filter((d) => d.ist_online && d.employee);

    if (onlineDrivers.length === 0) return [];

    return onlineDrivers.map((d) => {
      const myBatches = activeBatches.filter((b) => b.fahrer_id === d.employee_id);
      const totalStops = myBatches.reduce((sum, b) => sum + b.stops.length, 0);
      const doneStops = myBatches.reduce(
        (sum, b) => sum + b.stops.filter((s) => !!s.geliefert_am).length,
        0,
      );
      const pendingStops = totalStops - doneStops;
      const name = d.employee
        ? `${d.employee.vorname} ${d.employee.nachname.charAt(0)}.`
        : '—';
      return { name, totalStops, doneStops, pendingStops, batches: myBatches.length };
    }).sort((a, b) => b.pendingStops - a.pendingStops);
  }, [batches, drivers]);

  if (rows.length === 0) return null;

  const maxPending = Math.max(...rows.map((r) => r.pendingStops), 1);

  const getColor = (pending: number) => {
    if (pending === 0) return { bar: 'bg-matcha-300', badge: 'bg-matcha-50 text-matcha-700 border-matcha-200' };
    if (pending <= 2) return { bar: 'bg-amber-400', badge: 'bg-amber-50 text-amber-700 border-amber-200' };
    return { bar: 'bg-red-400', badge: 'bg-red-50 text-red-700 border-red-200' };
  };

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4">
      <div className="flex items-center gap-2 mb-3">
        <Users className="h-4 w-4 text-stone-400" />
        <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
          Fahrer-Auslastung
        </span>
        <span className="ml-auto text-[10px] text-stone-400">{rows.length} online</span>
      </div>
      <div className="space-y-2">
        {rows.map((row) => {
          const colors = getColor(row.pendingStops);
          const barPct = maxPending > 0 ? (row.pendingStops / maxPending) * 100 : 0;
          return (
            <div key={row.name} className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-[11px] font-semibold text-stone-700 truncate">
                {row.name}
              </span>
              <div className="flex-1 h-3 rounded-full bg-stone-100 overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-500', colors.bar)}
                  style={{ width: `${Math.max(barPct, row.pendingStops > 0 ? 4 : 0)}%` }}
                />
              </div>
              <span
                className={cn(
                  'shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-black tabular-nums',
                  colors.badge,
                )}
              >
                {row.pendingStops}
              </span>
              {row.doneStops > 0 && (
                <span className="shrink-0 text-[10px] text-stone-400 tabular-nums">
                  +{row.doneStops}✓
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2 text-[10px] text-stone-400">
        Zahl = offene Stops · ✓ = geliefert
      </div>
    </div>
  );
}
