'use client';

/**
 * KitchenKapazitaetsAnzeige — Real-time kitchen capacity meter.
 *
 * Shows:
 *  - Overall kitchen utilization % based on active in-prep orders vs. capacity
 *  - Per-station breakdown (Grill / Kalt / Frittiert / Getränke / Gemischt)
 *  - Color-coded urgency: grün <60% · gelb 60–80% · orange 80–95% · rot ≥95%
 *  - Projected time until capacity is freed (based on remaining prep times)
 *
 * Uses order + timing props already present in the kitchen client — zero new API calls.
 */

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { ChefHat, Clock, Flame, ThumbsUp } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type Item = { name: string; menge: number };

type Order = {
  id: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  items: Item[];
};

type KitchenTiming = {
  order_id: string;
  cook_start_at: string | null;
  ready_target: string | null;
  prep_min: number | null;
  status: string;
};

type Props = {
  orders: Order[];
  timings: KitchenTiming[];
  maxSimultaneous?: number; // default 6 — how many orders kitchen can handle in parallel
};

// ── Station detection ─────────────────────────────────────────────────────────

type Station = 'grill' | 'kalt' | 'frittiert' | 'getraenke' | 'mixed';

const GRILL  = ['burger', 'steak', 'grill', 'wrap', 'schnitzel', 'fleisch', 'chicken', 'hähnchen', 'gyros'];
const COLD   = ['salat', 'sushi', 'bowl', 'raw', 'kalt', 'tartare', 'ceviche', 'bruschetta'];
const FRY    = ['pommes', 'fries', 'frittes', 'nugget', 'crispy', 'tempura', 'onion ring', 'calamari'];
const DRINKS = ['cola', 'wasser', 'saft', 'bier', 'wein', 'shake', 'smoothie', 'kaffee', 'tee', 'limo', 'juice', 'espresso'];

function detectStation(items: Item[]): Station {
  const text = items.map(i => i.name.toLowerCase()).join(' ');
  const s = { grill: 0, kalt: 0, frittiert: 0, getraenke: 0 };
  GRILL.forEach(w  => { if (text.includes(w)) s.grill++; });
  COLD.forEach(w   => { if (text.includes(w)) s.kalt++; });
  FRY.forEach(w    => { if (text.includes(w)) s.frittiert++; });
  DRINKS.forEach(w => { if (text.includes(w)) s.getraenke++; });
  const max = Math.max(s.grill, s.kalt, s.frittiert, s.getraenke);
  if (max === 0) return 'mixed';
  if (s.grill === max) return 'grill';
  if (s.kalt === max) return 'kalt';
  if (s.frittiert === max) return 'frittiert';
  return 'getraenke';
}

// ── Capacity color ─────────────────────────────────────────────────────────────

function utilizationColor(pct: number): { bar: string; text: string; bg: string; label: string } {
  if (pct >= 95) return { bar: 'bg-red-500',    text: 'text-red-700',    bg: 'bg-red-50',    label: 'Überlastet' };
  if (pct >= 80) return { bar: 'bg-orange-400', text: 'text-orange-700', bg: 'bg-orange-50', label: 'Hoch' };
  if (pct >= 60) return { bar: 'bg-amber-400',  text: 'text-amber-700',  bg: 'bg-amber-50',  label: 'Mittel' };
  return             { bar: 'bg-matcha-500',  text: 'text-matcha-700', bg: 'bg-matcha-50', label: 'Gut' };
}

const STATION_META: Record<Station, { label: string; emoji: string }> = {
  grill:      { label: 'Grill',     emoji: '🔥' },
  kalt:       { label: 'Kalt',      emoji: '🥗' },
  frittiert:  { label: 'Frittier.', emoji: '🍟' },
  getraenke:  { label: 'Getränke',  emoji: '🥤' },
  mixed:      { label: 'Gemischt',  emoji: '🍽' },
};

// ── Main Component ────────────────────────────────────────────────────────────

export function KitchenKapazitaetsAnzeige({ orders, timings, maxSimultaneous = 6 }: Props) {
  const analysis = useMemo(() => {
    const now = Date.now();

    // Active = in-prep orders (not yet fertig)
    const active = orders.filter(o =>
      o.status === 'in_zubereitung' || o.status === 'angenommen'
    );

    // Per-station count
    const stationCount = { grill: 0, kalt: 0, frittiert: 0, getraenke: 0, mixed: 0 } as Record<Station, number>;
    for (const o of active) stationCount[detectStation(o.items)]++;

    // Overall utilization
    const utilizationPct = Math.min(100, Math.round((active.length / Math.max(1, maxSimultaneous)) * 100));

    // Minutes until next order frees up (based on ready_target)
    const nextFreeMin = timings
      .filter(t => t.status === 'cooking' && t.ready_target)
      .map(t => Math.max(0, (new Date(t.ready_target!).getTime() - now) / 60_000))
      .sort((a, b) => a - b)[0] ?? null;

    // Projected orders ready in next 10 minutes
    const readySoon = timings.filter(t =>
      t.status === 'cooking' &&
      t.ready_target &&
      (new Date(t.ready_target).getTime() - now) / 60_000 <= 10
    ).length;

    return { active: active.length, utilizationPct, stationCount, nextFreeMin, readySoon };
  }, [orders, timings, maxSimultaneous]);

  const { active, utilizationPct, stationCount, nextFreeMin, readySoon } = analysis;
  const col = utilizationColor(utilizationPct);

  if (active === 0) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-matcha-100 bg-matcha-50 px-4 py-3">
        <ThumbsUp size={16} className="text-matcha-600 shrink-0" />
        <div>
          <div className="text-xs font-bold text-matcha-800">Küche frei</div>
          <div className="text-[11px] text-matcha-600">Keine Bestellungen in Zubereitung</div>
        </div>
      </div>
    );
  }

  const nonZeroStations = Object.entries(stationCount).filter(([, v]) => v > 0) as [Station, number][];

  return (
    <div className={cn('rounded-2xl border overflow-hidden', col.bg,
      utilizationPct >= 95 ? 'border-red-300' : utilizationPct >= 80 ? 'border-orange-200' : 'border-stone-200',
    )}>
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 pt-3 pb-2">
        <div className={cn('flex h-7 w-7 items-center justify-center rounded-full shrink-0',
          utilizationPct >= 95 ? 'bg-red-100' : utilizationPct >= 80 ? 'bg-orange-100' : 'bg-matcha-100',
        )}>
          <ChefHat size={13} className={cn(col.text, utilizationPct >= 95 && 'animate-pulse')} />
        </div>
        <div className="flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-char">Küchen-Auslastung</span>
            <span className={cn('text-[10px] font-bold uppercase', col.text)}>{col.label}</span>
          </div>
          <div className="text-[11px] text-stone-500 mt-0.5">
            {active} von {maxSimultaneous} Slots belegt
            {readySoon > 0 && (
              <span className="ml-2 text-matcha-600 font-bold">· {readySoon} in ≤10 Min fertig</span>
            )}
          </div>
        </div>
        <div className={cn('text-2xl font-black tabular-nums leading-none', col.text)}>
          {utilizationPct}%
        </div>
      </div>

      {/* Utilization bar */}
      <div className="mx-4 mb-3">
        <div className="h-2 rounded-full bg-stone-200 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-700', col.bar,
              utilizationPct >= 95 && 'animate-pulse',
            )}
            style={{ width: `${utilizationPct}%` }}
          />
        </div>
      </div>

      {/* Station breakdown */}
      {nonZeroStations.length > 1 && (
        <div className="flex flex-wrap gap-2 px-4 pb-3">
          {nonZeroStations.map(([station, count]) => {
            const meta = STATION_META[station];
            return (
              <div key={station} className="flex items-center gap-1 rounded-full bg-white/80 border border-stone-200 px-2.5 py-1">
                <span className="text-[11px]">{meta.emoji}</span>
                <span className="text-[10px] font-semibold text-stone-600">{meta.label}</span>
                <span className="text-[10px] font-black text-char ml-0.5">{count}</span>
              </div>
            );
          })}
          {nextFreeMin !== null && (
            <div className="flex items-center gap-1 rounded-full bg-white/80 border border-stone-200 px-2.5 py-1 ml-auto">
              <Clock size={10} className="text-stone-400" />
              <span className="text-[10px] text-stone-500">Nächster frei in</span>
              <span className="text-[10px] font-black text-matcha-700">{Math.ceil(nextFreeMin)} Min</span>
            </div>
          )}
        </div>
      )}

      {/* Overload warning */}
      {utilizationPct >= 95 && (
        <div className="mx-4 mb-3 flex items-center gap-2 rounded-lg bg-red-100 border border-red-200 px-3 py-2">
          <Flame size={12} className="text-red-600 animate-pulse shrink-0" />
          <span className="text-[11px] font-bold text-red-700">
            Küche voll — neue Bestellungen erhöhen die Wartezeit erheblich!
          </span>
        </div>
      )}
    </div>
  );
}
