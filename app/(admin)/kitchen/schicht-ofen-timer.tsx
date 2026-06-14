'use client';

/**
 * KitchenSchichtOfenTimer
 * Zeigt Schicht-Produktivität: Orders/Stunde + farbkodierter Tempo-Ring.
 * Nutzt lokale State-Daten ohne zusätzliche API-Aufrufe.
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Flame, TrendingUp, TrendingDown, Minus } from 'lucide-react';

type Order = {
  id: string;
  status: string;
  bestellt_am: string | null;
};

interface Props {
  orders: Order[];
  completedToday: number | null;
}

function useTick(ms = 1000) {
  const [, setT] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setT(n => n + 1), ms);
    return () => clearInterval(iv);
  }, [ms]);
}

export function KitchenSchichtOfenTimer({ orders, completedToday }: Props) {
  useTick(10_000);
  const [sessionStart] = useState(() => Date.now());

  const elapsedMin = Math.max(1, Math.floor((Date.now() - sessionStart) / 60_000));
  const elapsedH = elapsedMin / 60;

  // Bestellungen die heute fertiggestellt wurden (completed via status change tracking)
  const activeNow = orders.filter(o =>
    ['neu', 'bestätigt', 'in_zubereitung', 'fertig'].includes(o.status),
  ).length;

  const totalToday = completedToday ?? 0;
  const ordersPerHour = elapsedH > 0 ? Math.round(totalToday / Math.max(elapsedH, 0.5)) : 0;

  // Farbklasse basierend auf Tempo
  const THRESHOLDS = { hot: 12, warm: 6, cool: 2 };
  const color =
    ordersPerHour >= THRESHOLDS.hot ? 'text-red-600' :
    ordersPerHour >= THRESHOLDS.warm ? 'text-orange-500' :
    ordersPerHour >= THRESHOLDS.cool ? 'text-matcha-600' :
    'text-muted-foreground';

  const bgColor =
    ordersPerHour >= THRESHOLDS.hot ? 'bg-red-50 border-red-200' :
    ordersPerHour >= THRESHOLDS.warm ? 'bg-orange-50 border-orange-200' :
    'bg-matcha-50 border-matcha-200';

  // SVG-Ring: Fortschritt = orders/h / 20 (Ziel = 20 Orders/h = Vollring)
  const goal = 20;
  const pct = Math.min(1, ordersPerHour / goal);
  const r = 22;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;

  // Trend: aktive Bestellungen vs. Durchschnitt
  const avgActive = ordersPerHour / 4; // ~ alle 15 Min eine Bestellung im Schnitt
  const TrendIcon = activeNow > avgActive + 1 ? TrendingUp : activeNow < avgActive - 1 ? TrendingDown : Minus;

  if (totalToday === 0 && activeNow === 0) return null;

  return (
    <div className={cn('flex items-center gap-3 rounded-xl border px-4 py-3', bgColor)}>
      {/* SVG-Ring */}
      <div className="relative shrink-0 flex items-center justify-center" style={{ width: 52, height: 52 }}>
        <svg width="52" height="52" viewBox="0 0 52 52" className="-rotate-90">
          <circle cx="26" cy="26" r={r} fill="none" stroke="currentColor" strokeWidth="4" className="text-black/10" />
          <circle
            cx="26" cy="26" r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ - dash}`}
            className={color}
            style={{ transition: 'stroke-dasharray 1s ease' }}
          />
        </svg>
        <Flame className={cn('absolute h-5 w-5', color)} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={cn('font-display text-2xl font-black tabular-nums leading-none', color)}>
            {ordersPerHour}
          </span>
          <span className="text-[10px] font-bold text-muted-foreground self-end mb-0.5">Bestellungen/h</span>
          <TrendIcon className={cn('h-3.5 w-3.5 ml-auto shrink-0', color)} />
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-muted-foreground">
            {totalToday} heute abgeschlossen
          </span>
          {activeNow > 0 && (
            <span className={cn(
              'rounded-full px-1.5 py-0.5 text-[9px] font-black',
              activeNow >= 5 ? 'bg-red-100 text-red-700' : activeNow >= 3 ? 'bg-orange-100 text-orange-700' : 'bg-blue-50 text-blue-600',
            )}>
              {activeNow} aktiv
            </span>
          )}
        </div>
        <div className="mt-1 h-1.5 rounded-full bg-black/5 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-700',
              ordersPerHour >= THRESHOLDS.hot ? 'bg-red-400' :
              ordersPerHour >= THRESHOLDS.warm ? 'bg-orange-400' : 'bg-matcha-400'
            )}
            style={{ width: `${pct * 100}%` }}
          />
        </div>
        <div className="mt-0.5 text-[8px] text-muted-foreground">
          Ziel: {goal} Bestellungen/h · {elapsedMin < 60 ? `${elapsedMin} Min Schicht` : `${Math.floor(elapsedMin / 60)}h ${elapsedMin % 60}m Schicht`}
        </div>
      </div>
    </div>
  );
}
