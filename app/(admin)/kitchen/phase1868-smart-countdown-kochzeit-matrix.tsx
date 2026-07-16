'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Clock, Flame, Timer } from 'lucide-react';

/**
 * Phase 1868 — Smart-Countdown-Kochzeit-Matrix (Kitchen)
 *
 * Zeigt alle aktiven Bestellungen als kompakte Countdown-Kacheln:
 *  - Grün  > 5 Min: Noch Zeit
 *  - Gelb  2–5 Min: Bald fertig
 *  - Orange 0–2 Min: Kritisch
 *  - Rot   < 0 Min: Überfällig
 *
 * 5-Sek-Tick. Kein API-Call — rein client-seitig aus übergebenen Orders.
 */

interface Order {
  id: string;
  bestellnummer?: string | null;
  status: string;
  bestellt_am?: string | null;
  geschaetzte_zubereitung_min?: number | null;
  ready_target?: string | null;
}

interface CountdownSlot {
  id: string;
  nr: string;
  remainingSec: number;
  prepMin: number;
}

type Level = 'green' | 'yellow' | 'orange' | 'red';

function getLevel(sec: number): Level {
  if (sec > 300) return 'green';
  if (sec > 120) return 'yellow';
  if (sec > 0) return 'orange';
  return 'red';
}

const LEVEL_KACHEL: Record<Level, string> = {
  green: 'border-matcha-300 dark:border-matcha-700 bg-matcha-50 dark:bg-matcha-950/30',
  yellow: 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/20',
  orange: 'border-orange-400 dark:border-orange-700 bg-orange-50 dark:bg-orange-950/20',
  red: 'border-red-400 dark:border-red-700 bg-red-50 dark:bg-red-950/20 animate-pulse',
};

const LEVEL_TIME: Record<Level, string> = {
  green: 'text-matcha-700 dark:text-matcha-400',
  yellow: 'text-amber-700 dark:text-amber-400',
  orange: 'text-orange-700 dark:text-orange-400',
  red: 'text-red-700 dark:text-red-400',
};

const LEVEL_BADGE: Record<Level, string> = {
  green: 'bg-matcha-100 text-matcha-700 dark:bg-matcha-900/40 dark:text-matcha-300',
  yellow: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  red: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

function formatTime(sec: number): string {
  if (sec < 0) return `+${Math.ceil(-sec / 60)} Min`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m >= 10) return `${m} Min`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function buildSlots(orders: Order[], now: number): CountdownSlot[] {
  return orders
    .filter((o) => ['neu', 'accepted', 'in_zubereitung', 'in_preparation'].includes(o.status))
    .map((o): CountdownSlot | null => {
      const prep = o.geschaetzte_zubereitung_min ?? 12;
      const target = o.ready_target
        ? new Date(o.ready_target).getTime()
        : o.bestellt_am
        ? new Date(o.bestellt_am).getTime() + prep * 60_000
        : now + prep * 60_000;
      return {
        id: o.id,
        nr: o.bestellnummer ?? o.id.slice(-4),
        remainingSec: Math.round((target - now) / 1_000),
        prepMin: prep,
      };
    })
    .filter((s): s is CountdownSlot => s !== null)
    .sort((a, b) => a.remainingSec - b.remainingSec)
    .slice(0, 16);
}

interface Props {
  orders: Order[];
  className?: string;
}

export function KitchenPhase1868SmartCountdownKochzeitMatrix({ orders, className }: Props) {
  const [open, setOpen] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => setNow(Date.now()), 5_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const slots = buildSlots(orders, now);
  const redCount = slots.filter((s) => getLevel(s.remainingSec) === 'red').length;
  const orangeCount = slots.filter((s) => getLevel(s.remainingSec) === 'orange').length;

  if (slots.length === 0) return null;

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">
            Kochzeit-Countdown
          </span>
          <div className="flex items-center gap-1">
            {redCount > 0 && (
              <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[10px] font-bold animate-pulse">
                {redCount} Überfällig
              </span>
            )}
            {orangeCount > 0 && (
              <span className="rounded-full bg-orange-100 text-orange-700 px-2 py-0.5 text-[10px] font-bold">
                {orangeCount} Kritisch
              </span>
            )}
            {redCount === 0 && orangeCount === 0 && (
              <span className="rounded-full bg-matcha-100 text-matcha-700 px-2 py-0.5 text-[10px] font-bold">
                {slots.length} aktiv
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>5s</span>
          {open ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
        </div>
      </button>

      {open && (
        <div className="border-t px-5 py-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
            Farbkodierung: Grün &gt;5 Min · Gelb 2–5 · Orange 0–2 · Rot Überfällig
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {slots.map((slot) => {
              const lvl = getLevel(slot.remainingSec);
              return (
                <div
                  key={slot.id}
                  className={cn(
                    'flex flex-col items-center rounded-xl border px-3 py-3 gap-1',
                    LEVEL_KACHEL[lvl],
                  )}
                >
                  <span className="text-[10px] font-black text-muted-foreground">#{slot.nr}</span>
                  <span className={cn('text-2xl font-black tabular-nums leading-none', LEVEL_TIME[lvl])}>
                    {formatTime(slot.remainingSec)}
                  </span>
                  <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-bold', LEVEL_BADGE[lvl])}>
                    {lvl === 'red' ? 'ÜBERFÄLLIG' : lvl === 'orange' ? 'KRITISCH' : lvl === 'yellow' ? 'BALD' : 'GUT'}
                  </span>
                </div>
              );
            })}
          </div>
          {redCount > 0 && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-red-100 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-4 py-2">
              <Flame className="h-4 w-4 text-red-600 shrink-0" />
              <span className="text-xs font-bold text-red-700 dark:text-red-300">
                {redCount} Bestellung{redCount !== 1 ? 'en' : ''} {redCount !== 1 ? 'sind' : 'ist'} überfällig — sofort ausgeben!
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
