'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlarmClock, ChefHat, Bike } from 'lucide-react';

export type CookStartOrder = {
  id: string;
  bestellnummer: string;
  kunde_name: string;
  prep_min: number | null;
  driver_eta_sec: number | null;
};

function useSecondTick() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
}

function fmt(sec: number): string {
  const abs = Math.abs(sec);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function KitchenCookStartTimer({ orders }: { orders: CookStartOrder[] }) {
  useSecondTick();

  const now = Date.now();

  const rows = orders
    .filter((o) => o.driver_eta_sec != null && o.prep_min != null)
    .map((o) => {
      const prepSec = (o.prep_min ?? 15) * 60;
      const driverSec = o.driver_eta_sec!;
      // Seconds until cook should START (positive = still waiting, negative = should have started)
      const startIn = driverSec - prepSec;
      return { ...o, startIn, driverSec, prepSec };
    })
    .filter((o) => o.driverSec < 30 * 60) // only within 30 min window
    .sort((a, b) => a.startIn - b.startIn);

  if (rows.length === 0) return null;

  return (
    <div className="rounded-xl border border-orange-200 bg-orange-50 overflow-hidden">
      <div className="flex items-center gap-2 bg-orange-100 border-b border-orange-200 px-4 py-2">
        <AlarmClock className="h-4 w-4 text-orange-700" />
        <span className="text-xs font-bold uppercase tracking-wider text-orange-800">
          Kochstart-Empfehlung
        </span>
        <span className="ml-auto rounded-full bg-orange-600 text-white px-2 py-0.5 text-[10px] font-black">
          {rows.length}
        </span>
      </div>
      <div className="divide-y divide-orange-100">
        {rows.map((row) => {
          const isNow = row.startIn <= 0 && row.startIn > -120;
          const isOverdue = row.startIn <= -120;
          const isPending = row.startIn > 0;
          return (
            <div
              key={row.id}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5',
                isNow && 'bg-orange-200/60',
                isOverdue && 'bg-red-50',
              )}
            >
              <div className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                isOverdue ? 'bg-red-500 text-white' :
                isNow ? 'bg-orange-500 text-white animate-pulse' :
                'bg-matcha-100 text-matcha-700',
              )}>
                <ChefHat className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-black text-foreground truncate">
                    {row.bestellnummer}
                  </span>
                  <span className="text-[10px] text-muted-foreground truncate">
                    {row.kunde_name}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Bike className="h-2.5 w-2.5" />
                    Fahrer in {fmt(row.driverSec)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    · Zubereitung {row.prep_min} Min
                  </span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                {isOverdue ? (
                  <div className="text-xs font-black text-red-600">Überfällig!</div>
                ) : isNow ? (
                  <div className="text-xs font-black text-orange-700 animate-pulse">JETZT!</div>
                ) : (
                  <>
                    <div className={cn(
                      'font-mono text-sm font-black tabular-nums',
                      row.startIn < 300 ? 'text-amber-600' : 'text-matcha-700',
                    )}>
                      {fmt(row.startIn)}
                    </div>
                    <div className="text-[9px] text-muted-foreground">bis Start</div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
