'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Package, Clock } from 'lucide-react';

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  fertig_um?: string | null;
  lieferart?: string | null;
};

interface Props {
  orders: Order[];
}

export function KitchenFertigAufAbholung({ orders }: Props) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  const ready = orders
    .filter((o) => o.status === 'fertig' || o.status === 'ready')
    .map((o) => {
      const readyAt = o.fertig_um ? new Date(o.fertig_um).getTime() : now;
      const waitMin = Math.max(0, Math.floor((now - readyAt) / 60_000));
      return { o, waitMin };
    })
    .sort((a, b) => b.waitMin - a.waitMin);

  if (ready.length === 0) return null;

  const maxWait = ready[0]?.waitMin ?? 0;
  const alarm = maxWait >= 10;
  const warn = maxWait >= 5;

  return (
    <div
      className={cn(
        'rounded-2xl border overflow-hidden',
        alarm ? 'border-red-200 bg-red-50' : warn ? 'border-amber-200 bg-amber-50' : 'border-stone-200 bg-white',
      )}
    >
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-black/5">
        <Package className={cn('h-4 w-4 shrink-0', alarm ? 'text-red-600' : warn ? 'text-amber-600' : 'text-matcha-600')} />
        <span className="text-xs font-bold uppercase tracking-wider">
          Fertig · Warte auf Abholung
        </span>
        <span
          className={cn(
            'ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold',
            alarm ? 'bg-red-500 text-white' : warn ? 'bg-amber-400 text-white' : 'bg-matcha-100 text-matcha-700',
          )}
        >
          {ready.length} Bestellung{ready.length !== 1 ? 'en' : ''}
        </span>
      </div>

      <div className="divide-y divide-black/5 max-h-44 overflow-y-auto">
        {ready.map(({ o, waitMin }) => {
          const critical = waitMin >= 10;
          const late = waitMin >= 5;
          return (
            <div
              key={o.id}
              className={cn(
                'flex items-center gap-3 px-4 py-2',
                critical ? 'bg-red-100/60' : late ? 'bg-amber-100/60' : '',
              )}
            >
              <span className="w-16 shrink-0 text-[11px] font-bold text-muted-foreground tabular-nums">
                #{o.bestellnummer.replace(/^[A-Z]+-/, '')}
              </span>
              <div className="flex-1 flex items-center gap-1.5">
                <Clock className={cn('h-3 w-3 shrink-0', critical ? 'text-red-500' : late ? 'text-amber-500' : 'text-muted-foreground')} />
                <span
                  className={cn(
                    'font-mono text-xs font-black tabular-nums',
                    critical ? 'text-red-700' : late ? 'text-amber-700' : 'text-muted-foreground',
                  )}
                >
                  {waitMin} Min wartet
                </span>
              </div>
              <span className="shrink-0 text-[9px] uppercase tracking-wider text-muted-foreground">
                {o.lieferart === 'delivery' ? 'Lieferung' : 'Abholung'}
              </span>
            </div>
          );
        })}
      </div>

      {alarm && (
        <div className="flex items-center gap-2 border-t border-red-200 bg-red-100 px-4 py-2 text-[10px] font-bold text-red-700">
          <span>⚠ Fahrer benachrichtigen — max. Wartezeit: {maxWait} Min</span>
        </div>
      )}
    </div>
  );
}
