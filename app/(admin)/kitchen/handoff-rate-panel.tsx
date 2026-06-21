'use client';

import React, { useEffect, useState } from 'react';
import { Clock, CheckCircle2, AlertTriangle, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

type Order = {
  id: string;
  status: string;
  fertig_am: string | null;
  typ: string;
};

type Props = {
  orders: Order[];
};

/* Zeigt wie schnell fertige Bestellungen zum Fahrer übergeben werden.
   Warnt wenn Wartezeiten >3 Min — direkt berechnet aus orders-Prop. */
export function KitchenHandoffRatePanel({ orders }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(t);
  }, []);

  const fertigeDelivery = orders.filter(
    (o) => o.status === 'fertig' && o.typ === 'lieferung' && o.fertig_am,
  );

  if (fertigeDelivery.length === 0) return null;

  const waiting = fertigeDelivery.map((o) => {
    const fertigMs = new Date(o.fertig_am!).getTime();
    const waitMin = Math.floor((now - fertigMs) / 60_000);
    return { id: o.id, waitMin };
  });

  const avgWait = Math.round(waiting.reduce((s, w) => s + w.waitMin, 0) / waiting.length);
  const critical = waiting.filter((w) => w.waitMin >= 5).length;
  const warning = waiting.filter((w) => w.waitMin >= 3 && w.waitMin < 5).length;
  const ok = waiting.filter((w) => w.waitMin < 3).length;

  const statusColor =
    critical > 0
      ? 'text-red-600 bg-red-50 border-red-200'
      : warning > 0
      ? 'text-amber-600 bg-amber-50 border-amber-200'
      : 'text-matcha-700 bg-matcha-50 border-matcha-200';

  return (
    <div className={cn('rounded-xl border p-4 space-y-3', statusColor)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 shrink-0" />
          <span className="text-xs font-bold uppercase tracking-wider">
            Handoff-Wartezeit
          </span>
        </div>
        <span className="text-xs font-black tabular-nums">
          Ø {avgWait} Min
        </span>
      </div>

      <div className="flex gap-3">
        <div className="flex-1 text-center">
          <div className="text-lg font-black tabular-nums text-matcha-700">{ok}</div>
          <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
            &lt;3 Min
          </div>
        </div>
        <div className="flex-1 text-center">
          <div className={cn('text-lg font-black tabular-nums', warning > 0 ? 'text-amber-600' : 'text-muted-foreground')}>
            {warning}
          </div>
          <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
            3–5 Min
          </div>
        </div>
        <div className="flex-1 text-center">
          <div className={cn('text-lg font-black tabular-nums', critical > 0 ? 'text-red-600' : 'text-muted-foreground')}>
            {critical}
          </div>
          <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
            &gt;5 Min
          </div>
        </div>
      </div>

      {critical > 0 && (
        <div className="flex items-center gap-1.5 rounded-lg bg-red-100 border border-red-200 px-3 py-1.5">
          <AlertTriangle className="h-3 w-3 text-red-600 shrink-0" />
          <span className="text-xs font-bold text-red-700">
            {critical} Bestellung{critical > 1 ? 'en' : ''} warten &gt;5 Min auf Fahrer!
          </span>
        </div>
      )}

      {critical === 0 && warning === 0 && (
        <div className="flex items-center gap-1.5 rounded-lg bg-matcha-100 border border-matcha-200 px-3 py-1.5">
          <CheckCircle2 className="h-3 w-3 text-matcha-600 shrink-0" />
          <span className="text-xs font-bold text-matcha-700">Alle Übergaben im grünen Bereich</span>
        </div>
      )}
    </div>
  );
}
