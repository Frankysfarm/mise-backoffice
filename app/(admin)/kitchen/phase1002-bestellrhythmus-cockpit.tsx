'use client';

import { useMemo, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Activity, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus } from 'lucide-react';

/**
 * Phase 1002 — Bestellrhythmus-Cockpit (Kitchen)
 *
 * Zeigt den aktuellen Bestelldurchsatz als Live-Balkendiagramm je 5-Min-Slot
 * der letzten 30 Minuten. Farbkodierung: Grün (normal), Gelb (erhöht), Rot (Spitze).
 * Trend-Anzeige: steigend / stabil / fallend.
 * Kein API erforderlich – rein client-seitig aus den übergebenen Bestellungen berechnet.
 */

interface Order {
  id: string;
  status: string;
  bestellt_am?: string | null;
  created_at?: string | null;
}

interface Props {
  orders: Order[];
}

interface Slot {
  label: string;
  count: number;
  startMs: number;
}

const SLOT_MIN = 5;
const SLOTS = 6; // 6 × 5 Min = 30 Min
const HIGH_THRESHOLD = 4;
const CRITICAL_THRESHOLD = 7;

function slotColor(count: number): { bar: string; bg: string; text: string } {
  if (count >= CRITICAL_THRESHOLD) return { bar: 'bg-red-500', bg: 'bg-red-50 dark:bg-red-950/20', text: 'text-red-700 dark:text-red-300' };
  if (count >= HIGH_THRESHOLD)     return { bar: 'bg-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/20', text: 'text-amber-700 dark:text-amber-300' };
  return                                  { bar: 'bg-matcha-500', bg: 'bg-matcha-50 dark:bg-matcha-950/20', text: 'text-matcha-700 dark:text-matcha-300' };
}

export function KitchenPhase1002BestellrhythmusCockpit({ orders }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(iv);
  }, []);

  const slots = useMemo<Slot[]>(() => {
    const result: Slot[] = [];
    for (let i = SLOTS - 1; i >= 0; i--) {
      const startMs = now - (i + 1) * SLOT_MIN * 60_000;
      const endMs   = now - i * SLOT_MIN * 60_000;
      const label   = i === 0 ? 'jetzt' : `-${(i + 1) * SLOT_MIN}m`;
      const count   = orders.filter(o => {
        const ts = o.bestellt_am ?? o.created_at;
        if (!ts) return false;
        const t = new Date(ts).getTime();
        return t >= startMs && t < endMs;
      }).length;
      result.push({ label, count, startMs });
    }
    return result;
  }, [orders, now]);

  const maxCount = Math.max(1, ...slots.map(s => s.count));
  const totalLast30 = slots.reduce((a, s) => a + s.count, 0);
  const recent = slots.slice(-2).reduce((a, s) => a + s.count, 0);
  const earlier = slots.slice(0, 2).reduce((a, s) => a + s.count, 0);
  const trend: 'up' | 'down' | 'neutral' =
    recent > earlier + 1 ? 'up' : recent < earlier - 1 ? 'down' : 'neutral';

  const currentSlotColor = slotColor(slots[SLOTS - 1]?.count ?? 0);

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-matcha-600" />
          <span className="text-sm font-semibold">Bestellrhythmus-Cockpit</span>
          <span className={cn('ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold border', currentSlotColor.bg, currentSlotColor.text)}>
            {slots[SLOTS - 1]?.count ?? 0} jetzt
          </span>
          {trend === 'up'   && <TrendingUp  className="h-3.5 w-3.5 text-red-500" />}
          {trend === 'down' && <TrendingDown className="h-3.5 w-3.5 text-matcha-500" />}
          {trend === 'neutral' && <Minus    className="h-3.5 w-3.5 text-zinc-400" />}
          <span className="ml-auto text-[9px] text-muted-foreground">{totalLast30} / 30 Min</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Bar chart */}
          <div className="flex items-end gap-1.5 h-20">
            {slots.map((slot, i) => {
              const pct = slot.count / maxCount;
              const c = slotColor(slot.count);
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 justify-end h-full">
                  <span className={cn('text-[9px] font-bold tabular-nums', c.text)}>
                    {slot.count > 0 ? slot.count : ''}
                  </span>
                  <div
                    className={cn('w-full rounded-t transition-all duration-700', c.bar)}
                    style={{ height: `${Math.max(4, pct * 60)}px` }}
                  />
                  <span className="text-[8px] text-muted-foreground">{slot.label}</span>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 text-[9px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-matcha-500 inline-block" /> Normal</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Erhöht ≥{HIGH_THRESHOLD}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Spitze ≥{CRITICAL_THRESHOLD}</span>
          </div>
        </div>
      )}
    </div>
  );
}
