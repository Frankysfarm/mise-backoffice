'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, Clock, Flame, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1160 — Smart-Timing-Live-Ampel (Kitchen)
// Kompakte Farbampel je aktiver Bestellung: Grün / Gelb / Orange / Rot / Schwarz
// Zeigt Countdown, verstrichene Zeit und Dringlichkeitsstufe live.

const AKTIV = ['neu', 'angenommen', 'confirmed', 'cooking', 'in_preparation', 'in_zubereitung'];
const DEFAULT_MIN = 20;

type Level = 'ok' | 'knapp' | 'dringend' | 'ueberfaellig' | 'kritisch';

function level(ratio: number, overdue: boolean): Level {
  if (overdue) return ratio > 1.3 ? 'kritisch' : 'ueberfaellig';
  if (ratio < 0.5) return 'ok';
  if (ratio < 0.75) return 'knapp';
  return 'dringend';
}

const STYLE: Record<Level, { card: string; dot: string; text: string; label: string }> = {
  ok:           { card: 'bg-matcha-50 border-matcha-200', dot: 'bg-matcha-500', text: 'text-matcha-700', label: 'OK' },
  knapp:        { card: 'bg-amber-50 border-amber-300',   dot: 'bg-amber-400',  text: 'text-amber-700',  label: 'Knapp' },
  dringend:     { card: 'bg-orange-50 border-orange-300', dot: 'bg-orange-500', text: 'text-orange-700', label: 'Dringend' },
  ueberfaellig: { card: 'bg-red-50 border-red-300',       dot: 'bg-red-500 animate-pulse', text: 'text-red-700', label: 'Überfällig' },
  kritisch:     { card: 'bg-red-100 border-red-500',      dot: 'bg-red-700 animate-pulse', text: 'text-red-900', label: 'KRITISCH' },
};

function fmt(sec: number) {
  const a = Math.abs(Math.round(sec));
  return `${Math.floor(a / 60)}:${String(a % 60).padStart(2, '0')}`;
}

interface Order {
  id: string;
  bestellnummer?: string;
  status?: string;
  bestellt_am?: string | null;
  items?: Array<{ name?: string; title?: string; quantity?: number }> | null;
}

export function KitchenPhase1160SmartTimingLiveAmpel({ orders }: { orders: Order[] }) {
  const [tick, setTick] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const chips = useMemo(() => {
    const now = Date.now();
    return orders
      .filter(o => AKTIV.includes(o.status ?? ''))
      .map(o => {
        const seit = o.bestellt_am ? (now - new Date(o.bestellt_am).getTime()) / 1000 : 0;
        const total = DEFAULT_MIN * 60;
        const remain = total - seit;
        const ratio = seit / total;
        const overdue = remain < 0;
        const lv = level(ratio, overdue);
        return { id: o.id, nr: (o.bestellnummer ?? o.id).slice(-4), seit, remain, ratio, overdue, lv };
      })
      .sort((a, b) => a.remain - b.remain);
  }, [orders, tick]);

  const counts = useMemo(() => ({
    ok: chips.filter(c => c.lv === 'ok').length,
    warn: chips.filter(c => c.lv === 'knapp' || c.lv === 'dringend').length,
    crit: chips.filter(c => c.lv === 'ueberfaellig' || c.lv === 'kritisch').length,
  }), [chips]);

  if (chips.length === 0) return null;

  const headerLevel: Level = counts.crit > 0 ? 'ueberfaellig' : counts.warn > 0 ? 'knapp' : 'ok';
  const hs = STYLE[headerLevel];

  return (
    <div className={cn('rounded-2xl border overflow-hidden', hs.card)}>
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center gap-2 px-4 py-3 hover:bg-black/5 transition">
        {counts.crit > 0 ? <Flame size={16} className={hs.text} /> : <Zap size={16} className={hs.text} />}
        <span className={cn('font-bold text-sm uppercase tracking-wider', hs.text)}>
          Smart-Timing-Live-Ampel
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          {counts.ok > 0 && (
            <span className="rounded-full bg-matcha-500 text-white text-[10px] font-bold px-2 py-0.5 flex items-center gap-0.5">
              <CheckCircle2 size={9} /> {counts.ok}
            </span>
          )}
          {counts.warn > 0 && (
            <span className="rounded-full bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5">{counts.warn}</span>
          )}
          {counts.crit > 0 && (
            <span className="rounded-full bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 animate-pulse">{counts.crit}</span>
          )}
        </span>
        {open ? <ChevronUp size={14} className={hs.text} /> : <ChevronDown size={14} className={hs.text} />}
      </button>

      {open && (
        <div className="border-t border-black/10 p-3 flex flex-wrap gap-2">
          {chips.map(c => {
            const s = STYLE[c.lv];
            return (
              <div key={c.id} className={cn('rounded-xl border px-3 py-2 flex flex-col items-center gap-0.5 min-w-[68px]', s.card)}>
                <span className={cn('h-2 w-2 rounded-full shrink-0', s.dot)} />
                <span className={cn('font-mono text-xs font-black', s.text)}>#{c.nr}</span>
                <span className={cn('font-mono text-[11px] font-bold tabular-nums', s.text)}>
                  {c.overdue ? `+${fmt(-c.remain)}` : fmt(c.remain)}
                </span>
                <span className={cn('text-[9px] font-semibold uppercase', s.text)}>{s.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
