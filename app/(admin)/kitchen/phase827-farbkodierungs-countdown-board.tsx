'use client';

import { useEffect, useState, useMemo } from 'react';
import { Timer } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Order {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
}

interface KitchenTiming {
  order_id: string;
  ready_target: string | null;
  status: string;
}

interface Props {
  orders: Order[];
  timings: KitchenTiming[];
}

type ColorZone = 'gruen' | 'gelb' | 'orange' | 'rot';

interface CountdownEntry {
  id: string;
  bestellnummer: string;
  secs: number;
  zone: ColorZone;
  label: string;
}

function colorForZone(zone: ColorZone) {
  switch (zone) {
    case 'gruen':  return { bg: 'bg-matcha-500',  ring: 'ring-matcha-300',  text: 'text-white',       card: 'bg-matcha-50 border-matcha-200' };
    case 'gelb':   return { bg: 'bg-yellow-400',   ring: 'ring-yellow-200',   text: 'text-yellow-900',  card: 'bg-yellow-50 border-yellow-200' };
    case 'orange': return { bg: 'bg-orange-500',   ring: 'ring-orange-300',   text: 'text-white',       card: 'bg-orange-50 border-orange-200' };
    case 'rot':    return { bg: 'bg-red-600',       ring: 'ring-red-300',      text: 'text-white',       card: 'bg-red-50 border-red-200' };
  }
}

function secsToZone(secs: number): ColorZone {
  if (secs > 300) return 'gruen';
  if (secs > 120) return 'gelb';
  if (secs > 0)   return 'orange';
  return 'rot';
}

function fmt(secs: number): string {
  const abs = Math.abs(secs);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const sign = secs < 0 ? '-' : '';
  return `${sign}${m}:${String(s).padStart(2, '0')}`;
}

export function KitchenPhase827FarbkodierungsCountdownBoard({ orders, timings }: Props) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const entries = useMemo<CountdownEntry[]>(() => {
    const now = Date.now();
    const active = orders.filter((o) =>
      ['bestätigt', 'in_zubereitung', 'neu'].includes(o.status)
    );
    return active.map((o) => {
      const t = timings.find((t) => t.order_id === o.id);
      let targetMs: number;
      if (t?.ready_target) {
        targetMs = new Date(t.ready_target).getTime();
      } else {
        const startMs = o.bestellt_am ? new Date(o.bestellt_am).getTime() : now;
        const prepMs = (o.geschaetzte_zubereitung_min ?? 15) * 60_000;
        targetMs = startMs + prepMs;
      }
      const secs = Math.floor((targetMs - now) / 1000);
      const zone = secsToZone(secs);
      const label = secs > 0 ? `Fertig in ${fmt(secs)}` : `${fmt(secs)} überzogen`;
      return { id: o.id, bestellnummer: o.bestellnummer, secs, zone, label };
    }).sort((a, b) => a.secs - b.secs).slice(0, 8);
  }, [orders, timings, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  if (entries.length === 0) return null;

  const rotCount = entries.filter((e) => e.zone === 'rot').length;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <div className={cn(
        'flex items-center gap-2 px-4 py-3 border-b',
        rotCount > 0 ? 'bg-red-50 border-red-100' : 'bg-stone-50 border-stone-100'
      )}>
        <Timer className={cn('h-4 w-4', rotCount > 0 ? 'text-red-600 animate-pulse' : 'text-stone-600')} />
        <span className="text-sm font-bold text-stone-800">Farbkodierungs-Countdown</span>
        {rotCount > 0 && (
          <span className="ml-auto text-[10px] bg-red-600 text-white rounded-full px-2 py-0.5 font-bold animate-pulse">
            {rotCount}× überzogen
          </span>
        )}
      </div>

      <div className="p-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {entries.map((e) => {
          const c = colorForZone(e.zone);
          return (
            <div
              key={e.id}
              className={cn(
                'rounded-xl border px-3 py-3 flex flex-col items-center gap-1',
                c.card,
                e.zone === 'rot' && 'animate-pulse'
              )}
            >
              <span className="text-[10px] font-bold text-stone-500 truncate w-full text-center">
                #{e.bestellnummer}
              </span>
              <div className={cn(
                'rounded-lg px-3 py-1 font-mono text-base font-black tabular-nums',
                c.bg, c.text
              )}>
                {fmt(e.secs)}
              </div>
              <span className="text-[9px] text-stone-500 text-center leading-tight">{e.label}</span>
            </div>
          );
        })}
      </div>

      <div className="px-4 py-2 border-t border-stone-100 flex items-center gap-4">
        {(['gruen', 'gelb', 'orange', 'rot'] as ColorZone[]).map((z) => {
          const count = entries.filter((e) => e.zone === z).length;
          const c = colorForZone(z);
          const labels: Record<ColorZone, string> = { gruen: '>5 Min', gelb: '2–5 Min', orange: '<2 Min', rot: 'Überzogen' };
          return (
            <div key={z} className="flex items-center gap-1">
              <div className={cn('w-2 h-2 rounded-full', c.bg)} />
              <span className="text-[9px] text-stone-500">{labels[z]}: {count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
