'use client';

import { useEffect, useState } from 'react';
import { Clock, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

type Order = {
  id: string;
  bestellnummer?: string;
  status?: string;
  created_at?: string;
  bestellt_am?: string;
  prep_time?: number;
};

function getElapsedSec(order: Order): number {
  const ref = order.bestellt_am ?? order.created_at;
  if (!ref) return 0;
  return Math.floor((Date.now() - new Date(ref).getTime()) / 1000);
}

function getTargetSec(order: Order): number {
  return (order.prep_time ?? 20) * 60;
}

function ampelKlasse(elapsed: number, target: number): 'gruen' | 'gelb' | 'rot' {
  const pct = elapsed / target;
  if (pct >= 1) return 'rot';
  if (pct >= 0.75) return 'gelb';
  return 'gruen';
}

const FARBEN = {
  gruen: {
    bg: 'bg-matcha-50 dark:bg-matcha-950/40',
    border: 'border-matcha-200 dark:border-matcha-800',
    ring: 'bg-matcha-500',
    text: 'text-matcha-800 dark:text-matcha-200',
    sub: 'text-matcha-600 dark:text-matcha-400',
  },
  gelb: {
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    border: 'border-amber-300 dark:border-amber-700',
    ring: 'bg-amber-500',
    text: 'text-amber-900 dark:text-amber-200',
    sub: 'text-amber-600 dark:text-amber-400',
  },
  rot: {
    bg: 'bg-red-50 dark:bg-red-950/40',
    border: 'border-red-300 dark:border-red-700',
    ring: 'bg-red-500 animate-pulse',
    text: 'text-red-900 dark:text-red-200',
    sub: 'text-red-600 dark:text-red-400',
  },
};

export function KitchenPhase1058SmartFarbkodierungsCountdownWall({ orders }: { orders: Order[] }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const aktiv = orders.filter((o) =>
    ['neu', 'angenommen', 'wartend', 'in_zubereitung', 'pending'].includes(o.status ?? '')
  );

  if (aktiv.length === 0) return null;

  const rot = aktiv.filter((o) => ampelKlasse(getElapsedSec(o), getTargetSec(o)) === 'rot');
  const gelb = aktiv.filter((o) => ampelKlasse(getElapsedSec(o), getTargetSec(o)) === 'gelb');
  const gruen = aktiv.filter((o) => ampelKlasse(getElapsedSec(o), getTargetSec(o)) === 'gruen');

  const sorted = [...rot, ...gelb, ...gruen];

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b">
        <Zap size={15} className="text-amber-500" />
        <span className="text-xs font-bold uppercase tracking-wider">Countdown-Wall — Alle Bestellungen</span>
        <div className="ml-auto flex items-center gap-2 text-[10px]">
          {rot.length > 0 && <span className="rounded-full bg-red-500 text-white px-2 py-0.5 font-bold">{rot.length} Überfällig</span>}
          {gelb.length > 0 && <span className="rounded-full bg-amber-500 text-white px-2 py-0.5 font-bold">{gelb.length} Knapp</span>}
          <span className="rounded-full bg-matcha-500 text-white px-2 py-0.5 font-bold">{gruen.length} OK</span>
        </div>
      </div>

      <div className="p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {sorted.map((order) => {
          const elapsed = getElapsedSec(order);
          const target = getTargetSec(order);
          const ampel = ampelKlasse(elapsed, target);
          const f = FARBEN[ampel];
          const remainSec = Math.max(0, target - elapsed);
          const overSec = Math.max(0, elapsed - target);
          const pct = Math.min(100, Math.round((elapsed / target) * 100));

          const fmt = (s: number) => {
            const m = Math.floor(s / 60);
            const sec = s % 60;
            return `${m}:${String(sec).padStart(2, '0')}`;
          };

          return (
            <div
              key={order.id}
              className={cn('rounded-xl border p-2.5 flex flex-col gap-1.5', f.bg, f.border)}
            >
              <div className="flex items-center justify-between">
                <span className={cn('text-xs font-bold', f.text)}>
                  #{order.bestellnummer ?? order.id.slice(-4)}
                </span>
                <span className={cn('text-[10px] font-bold', f.sub)}>
                  {ampel === 'rot' ? `+${fmt(overSec)}` : fmt(remainSec)}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-black/10 overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', f.ring)}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                <Clock size={8} />
                <span>{Math.round(elapsed / 60)}/{Math.round(target / 60)} Min</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
