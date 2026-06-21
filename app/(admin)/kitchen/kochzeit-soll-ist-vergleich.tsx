'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react';

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
};

type KitchenTiming = {
  order_id: string;
  cook_start_at: string | null;
  prep_min: number | null;
};

interface Props {
  orders: Order[];
  timings?: KitchenTiming[];
}

export function KitchenKochzeitSollIstVergleich({ orders, timings = [] }: Props) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(t);
  }, []);

  const cooking = orders.filter((o) => o.status === 'in_zubereitung');
  if (cooking.length === 0) return null;

  const rows = cooking.map((o) => {
    const timing = timings.find((t) => t.order_id === o.id);
    const sollMin = timing?.prep_min ?? o.geschaetzte_zubereitung_min ?? 15;
    const startMs = timing?.cook_start_at
      ? new Date(timing.cook_start_at).getTime()
      : o.bestellt_am
        ? new Date(o.bestellt_am).getTime()
        : now;
    const elapsedMin = Math.max(0, Math.floor((now - startMs) / 60_000));
    const deltaMin = elapsedMin - sollMin;
    const pct = Math.min(100, sollMin > 0 ? (elapsedMin / sollMin) * 100 : 0);
    return { o, sollMin, elapsedMin, deltaMin, pct };
  });

  const overdueCount = rows.filter((r) => r.deltaMin > 0).length;
  const avgDelta = rows.reduce((s, r) => s + r.deltaMin, 0) / rows.length;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-stone-100">
        <Clock className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Kochzeit Soll / Ist</span>
        <span
          className={cn(
            'ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold',
            overdueCount > 0 ? 'bg-red-100 text-red-700' : 'bg-matcha-100 text-matcha-700',
          )}
        >
          {overdueCount > 0 ? `${overdueCount} überfällig` : 'Im Plan'}
        </span>
      </div>

      <div className="divide-y divide-stone-100 max-h-44 overflow-y-auto">
        {rows.map(({ o, sollMin, elapsedMin, deltaMin, pct }) => {
          const critical = deltaMin > 5;
          const late = deltaMin > 0;
          return (
            <div
              key={o.id}
              className={cn(
                'flex items-center gap-3 px-4 py-2',
                critical ? 'bg-red-50' : late ? 'bg-amber-50' : '',
              )}
            >
              <span className="w-14 shrink-0 text-[11px] font-bold text-muted-foreground tabular-nums">
                #{o.bestellnummer.replace(/^[A-Z]+-/, '')}
              </span>
              <div className="flex-1 h-2 rounded-full bg-stone-100 overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-700',
                    critical ? 'bg-red-500' : late ? 'bg-amber-400' : 'bg-matcha-500',
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span
                  className={cn(
                    'font-mono text-xs font-black tabular-nums',
                    critical ? 'text-red-600' : late ? 'text-amber-700' : 'text-matcha-700',
                  )}
                >
                  {elapsedMin}/{sollMin}m
                </span>
                {late && critical && <TrendingUp className="h-3 w-3 text-red-500" />}
                {late && !critical && <TrendingUp className="h-3 w-3 text-amber-500" />}
                {!late && deltaMin < -1 && <TrendingDown className="h-3 w-3 text-matcha-500" />}
                {!late && deltaMin >= -1 && <Minus className="h-3 w-3 text-muted-foreground" />}
              </div>
            </div>
          );
        })}
      </div>

      <div
        className={cn(
          'flex items-center gap-2 border-t px-4 py-2 text-[10px] font-semibold',
          avgDelta > 3 ? 'bg-red-50 text-red-700' : avgDelta > 0 ? 'bg-amber-50 text-amber-700' : 'bg-matcha-50 text-matcha-700',
        )}
      >
        <span>Ø Abweichung</span>
        <span className="font-mono font-black tabular-nums">
          {avgDelta > 0 ? '+' : ''}{avgDelta.toFixed(1)} Min
        </span>
        <span className="ml-auto text-muted-foreground">{rows.length} in Zubereitung</span>
      </div>
    </div>
  );
}
