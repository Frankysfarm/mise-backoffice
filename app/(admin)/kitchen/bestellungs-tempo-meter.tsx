'use client';

/* Phase 324: KitchenBestellungsTempoMeter
   Echtzeit-Tachometer: Bestellungen/Stunde vs. Ziel-Pace.
   Zeigt ob die Küche unter, auf oder über Sollgeschwindigkeit läuft.
*/

import { useEffect, useMemo, useState } from 'react';
import { Gauge, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type Order = {
  id: string;
  status: string;
  bestellt_am: string | null;
};

interface Props {
  orders: Order[];
  completedOrders?: Order[];
  zielProStunde?: number;
}

export function KitchenBestellungsTempoMeter({
  orders,
  completedOrders = [],
  zielProStunde = 12,
}: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const { aktuelleRate, trend, pace } = useMemo(() => {
    const allOrders = [...orders, ...completedOrders];
    const fensterMs = 60 * 60 * 1000; // 1h
    const recent = allOrders.filter((o) => {
      if (!o.bestellt_am) return false;
      return now - new Date(o.bestellt_am).getTime() < fensterMs;
    });

    const letzteHalbstunde = allOrders.filter((o) => {
      if (!o.bestellt_am) return false;
      const age = now - new Date(o.bestellt_am).getTime();
      return age < 30 * 60 * 1000;
    });

    const aktuelleRate = recent.length;
    const halvRate = letzteHalbstunde.length * 2; // hochgerechnet auf Stunde

    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (halvRate > aktuelleRate * 1.1) trend = 'up';
    else if (halvRate < aktuelleRate * 0.9) trend = 'down';

    const pctOfZiel = aktuelleRate / Math.max(zielProStunde, 1);
    let pace: 'hinter' | 'auf-kurs' | 'voraus' = 'auf-kurs';
    if (pctOfZiel < 0.7) pace = 'hinter';
    else if (pctOfZiel > 1.15) pace = 'voraus';

    return { aktuelleRate, trend, pace, halvRate };
  }, [orders, completedOrders, now, zielProStunde]);

  const paceConfig = {
    hinter: {
      bg: 'bg-red-50 border-red-200',
      label: 'Hinter Pace',
      labelColor: 'text-red-700',
      barColor: 'bg-red-400',
      icon: TrendingDown,
      iconColor: 'text-red-500',
    },
    'auf-kurs': {
      bg: 'bg-matcha-50 border-matcha-200',
      label: 'Auf Kurs',
      labelColor: 'text-matcha-700',
      barColor: 'bg-matcha-500',
      icon: Minus,
      iconColor: 'text-matcha-500',
    },
    voraus: {
      bg: 'bg-amber-50 border-amber-200',
      label: 'Über Ziel',
      labelColor: 'text-amber-700',
      barColor: 'bg-amber-400',
      icon: TrendingUp,
      iconColor: 'text-amber-500',
    },
  } as const;

  const cfg = paceConfig[pace];
  const pct = Math.min(100, Math.round((aktuelleRate / Math.max(zielProStunde, 1)) * 100));
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;

  return (
    <Card className={cn('overflow-hidden border', cfg.bg)}>
      <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-current/10">
        <Gauge className={cn('h-4 w-4 shrink-0', cfg.iconColor)} />
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
          Bestellungs-Tempo
        </span>
        <span className={cn('ml-auto text-[10px] font-black uppercase', cfg.labelColor)}>
          {cfg.label}
        </span>
      </div>
      <div className="px-4 py-3 space-y-3">
        {/* Gauge bar */}
        <div>
          <div className="flex justify-between items-baseline mb-1">
            <span className={cn('text-2xl font-black tabular-nums', cfg.labelColor)}>
              {aktuelleRate}
              <span className="text-sm font-semibold text-stone-500 ml-1">/ Std.</span>
            </span>
            <span className="text-[11px] text-stone-400 font-medium">
              Ziel: {zielProStunde}/Std.
            </span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-stone-200 overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-700', cfg.barColor)}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between mt-0.5">
            <span className="text-[10px] text-stone-400">0</span>
            <span className="text-[10px] font-bold text-stone-500">{pct}%</span>
            <span className="text-[10px] text-stone-400">{Math.round(zielProStunde * 1.5)}+</span>
          </div>
        </div>
        {/* Trend */}
        <div className="flex items-center gap-1.5">
          <TrendIcon className="h-3 w-3 text-stone-400" />
          <span className="text-[11px] text-stone-500">
            Trend letzte 30 Min.:{' '}
            <span className="font-bold text-stone-700">
              {trend === 'up' ? 'zunehmend' : trend === 'down' ? 'abnehmend' : 'stabil'}
            </span>
          </span>
        </div>
      </div>
    </Card>
  );
}
