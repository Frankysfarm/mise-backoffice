'use client';

import { useMemo, useState, useEffect } from 'react';
import { Clock, Flame, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Order {
  id: string;
  bestellnummer?: string | null;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  kunde_name: string;
}

interface CountdownCard {
  id: string;
  bestellnummer: string;
  kundeName: string;
  elapsedMs: number;
  targetMs: number;
  overMs: number;
  ampel: 'gruen' | 'amber' | 'orange' | 'rot';
}

const RING: Record<string, { ring: string; bg: string; text: string; label: string }> = {
  gruen:  { ring: 'ring-green-500',  bg: 'bg-green-50 dark:bg-green-950',   text: 'text-green-700 dark:text-green-300',  label: 'Im Plan' },
  amber:  { ring: 'ring-amber-500',  bg: 'bg-amber-50 dark:bg-amber-950',   text: 'text-amber-700 dark:text-amber-300',  label: '+< 5 Min' },
  orange: { ring: 'ring-orange-500', bg: 'bg-orange-50 dark:bg-orange-950', text: 'text-orange-700 dark:text-orange-300', label: '+5–10 Min' },
  rot:    { ring: 'ring-red-500',    bg: 'bg-red-50 dark:bg-red-950',       text: 'text-red-600 dark:text-red-400',      label: '>10 Min zu spät' },
};

function ampelOf(elapsedMs: number, targetMs: number): 'gruen' | 'amber' | 'orange' | 'rot' {
  const overMs = elapsedMs - targetMs;
  if (overMs <= 0) return 'gruen';
  if (overMs < 5 * 60 * 1000) return 'amber';
  if (overMs < 10 * 60 * 1000) return 'orange';
  return 'rot';
}

function formatMmSs(ms: number): string {
  const totalSec = Math.floor(Math.abs(ms) / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function KitchenPhase2012SmartCountdownFarbkodierungBoard({
  orders,
}: {
  orders: Order[];
}) {
  const [offen, setOffen] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const activeOrders = useMemo(
    () => orders.filter((o) => o.status === 'in_zubereitung'),
    [orders],
  );

  const cards = useMemo((): CountdownCard[] => {
    const now = Date.now();
    return activeOrders.map((o) => {
      const startMs = o.bestellt_am ? new Date(o.bestellt_am).getTime() : now;
      const elapsedMs = now - startMs;
      const targetMs = (o.geschaetzte_zubereitung_min ?? 15) * 60 * 1000;
      const overMs = elapsedMs - targetMs;
      return {
        id: o.id,
        bestellnummer: o.bestellnummer ?? o.id.slice(0, 6).toUpperCase(),
        kundeName: o.kunde_name,
        elapsedMs,
        targetMs,
        overMs,
        ampel: ampelOf(elapsedMs, targetMs),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrders, tick]);

  if (!cards.length) return null;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
      <button
        onClick={() => setOffen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-500" />
          <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">
            Smart-Countdown-Board
          </span>
          <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full font-mono">
            {cards.length} aktiv
          </span>
        </div>
        {offen ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {offen && (
        <div className="border-t border-slate-100 dark:border-slate-700 px-4 py-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {cards.map((card) => {
              const c = RING[card.ampel];
              const isOver = card.overMs > 0;
              return (
                <div
                  key={card.id}
                  className={cn(
                    'rounded-lg p-3 ring-2 flex flex-col gap-1.5',
                    c.ring,
                    c.bg,
                  )}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] font-bold font-mono text-slate-500 dark:text-slate-400 truncate">
                      #{card.bestellnummer}
                    </span>
                    {card.ampel === 'rot' && (
                      <Flame className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    )}
                  </div>
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
                    {card.kundeName}
                  </p>
                  <div className={cn('text-lg font-bold tabular-nums', c.text)}>
                    {isOver ? '+' : ''}{formatMmSs(isOver ? card.overMs : card.targetMs - card.elapsedMs)}
                  </div>
                  <span className={cn('text-[10px] font-semibold', c.text)}>
                    {c.label}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="text-[9px] text-slate-400 text-right pt-2">Sekundengenau · in_zubereitung</p>
        </div>
      )}
    </div>
  );
}
