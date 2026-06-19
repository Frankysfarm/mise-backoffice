'use client';

import { useMemo } from 'react';
import { Zap, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Driver {
  ist_online: boolean;
  aktueller_batch_id: string | null;
}

interface Props {
  drivers: Driver[];
  pendingOrders: number;
}

export function DispatchKapazitaetsPuffer({ drivers, pendingOrders }: Props) {
  const { available, busy, puffer, pct, level } = useMemo(() => {
    const online = drivers.filter((d) => d.ist_online);
    const busy = online.filter((d) => !!d.aktueller_batch_id).length;
    const available = online.length - busy;
    const maxCapacity = available * 3;
    const puffer = Math.max(0, maxCapacity - pendingOrders);
    const pct = maxCapacity > 0 ? Math.min(100, Math.round((puffer / maxCapacity) * 100)) : 0;
    const level: 'ok' | 'tight' | 'overloaded' =
      puffer >= 5 ? 'ok' : puffer >= 1 ? 'tight' : 'overloaded';
    return { available, busy, puffer, pct, level };
  }, [drivers, pendingOrders]);

  const palette = {
    ok:         { bar: 'bg-green-500', text: 'text-green-700', badge: 'bg-green-100 text-green-700', border: 'border-green-200', track: 'bg-green-100' },
    tight:      { bar: 'bg-amber-500', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700', border: 'border-amber-200', track: 'bg-amber-100' },
    overloaded: { bar: 'bg-red-500',   text: 'text-red-700',   badge: 'bg-red-100   text-red-700',   border: 'border-red-200',   track: 'bg-red-100'   },
  }[level];

  const label = { ok: 'Kapazität ausreichend', tight: 'Kapazität knapp', overloaded: 'Kapazitätsgrenze erreicht' }[level];

  return (
    <div className={cn('rounded-xl border p-4 space-y-3', palette.border, 'bg-white')}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className={cn('w-4 h-4', palette.text)} />
          <span className={cn('text-sm font-semibold', palette.text)}>{label}</span>
        </div>
        <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full', palette.badge)}>
          +{puffer} Puffer
        </span>
      </div>

      <div className={cn('h-2.5 rounded-full overflow-hidden', palette.track)}>
        <div
          className={cn('h-full rounded-full transition-all duration-700', palette.bar)}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <Users className="w-3.5 h-3.5" />
          {available} frei · {busy} auf Tour
        </span>
        <span>{pendingOrders} Bestellungen warten</span>
      </div>
    </div>
  );
}
