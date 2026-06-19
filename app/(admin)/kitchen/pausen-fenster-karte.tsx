'use client';

import { useMemo } from 'react';
import { Coffee, Clock, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  orders: { status: string; bestellt_am: string | null }[];
}

export function KitchenPausenFensterKarte({ orders }: Props) {
  const { pending, inProgress, breakPossible, minutesUntilBreak } = useMemo(() => {
    const pending = orders.filter((o) => o.status === 'bestätigt').length;
    const inProgress = orders.filter((o) => o.status === 'in_arbeit').length;
    const active = pending + inProgress;
    const breakPossible = active <= 2;
    const minutesUntilBreak = breakPossible ? 0 : Math.max(1, (active - 2) * 6);
    return { pending, inProgress, breakPossible, minutesUntilBreak };
  }, [orders]);

  const now = new Date();
  const breakStartDate = new Date(now.getTime() + minutesUntilBreak * 60_000);
  breakStartDate.setMinutes(Math.ceil(breakStartDate.getMinutes() / 5) * 5, 0, 0);
  const breakEndDate = new Date(breakStartDate.getTime() + 15 * 60_000);
  const fmt = (d: Date) => d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  const isBusy = minutesUntilBreak > 20;

  return (
    <div className={cn(
      'flex items-center gap-3 rounded-xl px-4 py-3 text-sm',
      breakPossible
        ? 'bg-green-50 border border-green-200'
        : isBusy
          ? 'bg-red-50 border border-red-200'
          : 'bg-amber-50 border border-amber-200',
    )}>
      <div className={cn(
        'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0',
        breakPossible ? 'bg-green-100' : isBusy ? 'bg-red-100' : 'bg-amber-100',
      )}>
        <Coffee className={cn(
          'w-5 h-5',
          breakPossible ? 'text-green-600' : isBusy ? 'text-red-600' : 'text-amber-600',
        )} />
      </div>
      <div className="flex-1 min-w-0">
        {breakPossible ? (
          <>
            <p className="font-semibold text-green-700">Pause möglich</p>
            <p className="text-xs text-green-600 mt-0.5">
              Fenster: {fmt(breakStartDate)}–{fmt(breakEndDate)} · {pending + inProgress} aktive Bestellungen
            </p>
          </>
        ) : (
          <>
            <p className={cn('font-semibold', isBusy ? 'text-red-700' : 'text-amber-700')}>
              Pause in ca. {minutesUntilBreak} Min
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {pending} wartend · {inProgress} in Arbeit · nächstes Fenster ~{fmt(breakStartDate)}
            </p>
          </>
        )}
      </div>
      {breakPossible
        ? <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
        : <Clock className={cn('w-5 h-5 flex-shrink-0', isBusy ? 'text-red-400' : 'text-amber-400')} />}
    </div>
  );
}
