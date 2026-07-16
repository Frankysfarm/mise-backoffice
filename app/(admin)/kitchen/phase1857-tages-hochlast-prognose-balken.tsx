'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { BarChart2, ChevronDown, ChevronUp, Zap } from 'lucide-react';

/**
 * Phase 1857 — Tages-Hochlast-Prognose-Balken (Kitchen)
 *
 * Visualisiert den Ø Bestelleingang je Stunde aus den letzten 7 Tagen.
 * Hebt heutige Hochlast-Stunden hervor (≥80% des Maximalwerts).
 * Props-basiert; useMemo; Collapsible.
 */

interface Order {
  id: string;
  created_at: string;
  status: string;
}

interface StundenSlot {
  stunde: number;
  label: string;
  avgBestellungen: number;
  istHeuteMoment: boolean;
  hochlast: boolean;
}

interface Props {
  orders: Order[];
  className?: string;
}

const STUNDEN = Array.from({ length: 14 }, (_, i) => i + 9); // 09–22 Uhr

function berechneSlots(orders: Order[]): StundenSlot[] {
  const now = new Date();
  const aktuelleStunde = now.getHours();
  const heute = now.toISOString().slice(0, 10);

  const vor7Tagen = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const historisch = orders.filter((o) => {
    const d = new Date(o.created_at);
    return d >= vor7Tagen && o.created_at.slice(0, 10) !== heute;
  });

  const counts: Record<number, number[]> = {};
  STUNDEN.forEach((h) => (counts[h] = []));

  for (const o of historisch) {
    const d = new Date(o.created_at);
    const h = d.getHours();
    if (h >= 9 && h <= 22) {
      const tag = o.created_at.slice(0, 10);
      if (!counts[h]) counts[h] = [];
      counts[h].push(1);
      void tag;
    }
  }

  const avgByHour: Record<number, number> = {};
  const uniqueTage = new Set(historisch.map((o) => o.created_at.slice(0, 10))).size || 1;
  for (const h of STUNDEN) {
    const total = counts[h]?.length ?? 0;
    avgByHour[h] = Math.round(total / uniqueTage);
  }

  const maxAvg = Math.max(...Object.values(avgByHour), 1);

  return STUNDEN.map((h) => ({
    stunde: h,
    label: `${h}:00`,
    avgBestellungen: avgByHour[h] ?? 0,
    istHeuteMoment: h === aktuelleStunde,
    hochlast: (avgByHour[h] ?? 0) >= maxAvg * 0.8,
  }));
}

export function KitchenPhase1857TagesHochlastPrognoseBalken({ orders, className }: Props) {
  const [offen, setOffen] = useState(true);

  const slots = useMemo(() => berechneSlots(orders), [orders]);

  const maxWert = Math.max(...slots.map((s) => s.avgBestellungen), 1);
  const hochlastStunden = slots.filter((s) => s.hochlast);

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
      >
        <BarChart2 className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Hochlast-Prognose</span>
        {hochlastStunden.length > 0 && (
          <span className="ml-1 flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
            <Zap className="h-2.5 w-2.5" />
            {hochlastStunden.length} Stoßzeiten
          </span>
        )}
        {offen ? (
          <ChevronUp className="ml-auto h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {offen && (
        <div className="p-4 space-y-3">
          <p className="text-[10px] text-muted-foreground">
            Ø Bestelleingang je Stunde (letzte 7 Tage) — orange = Stoßzeit
          </p>

          <div className="flex items-end gap-1 h-24">
            {slots.map((slot) => {
              const hoehe = Math.round((slot.avgBestellungen / maxWert) * 100);
              return (
                <div
                  key={slot.stunde}
                  className="flex flex-col items-center gap-0.5 flex-1"
                  title={`${slot.label}: Ø ${slot.avgBestellungen} Bestellungen`}
                >
                  <div className="w-full flex flex-col justify-end h-20">
                    <div
                      className={cn(
                        'w-full rounded-t transition-all',
                        slot.hochlast
                          ? 'bg-amber-400 dark:bg-amber-500'
                          : 'bg-matcha-300 dark:bg-matcha-600',
                        slot.istHeuteMoment && 'ring-2 ring-blue-500 ring-offset-1',
                      )}
                      style={{ height: `${Math.max(hoehe, 4)}%` }}
                    />
                  </div>
                  <span
                    className={cn(
                      'text-[8px] tabular-nums',
                      slot.istHeuteMoment
                        ? 'text-blue-600 font-bold'
                        : 'text-muted-foreground',
                    )}
                  >
                    {slot.stunde}
                  </span>
                </div>
              );
            })}
          </div>

          {hochlastStunden.length > 0 && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                Stoßzeiten heute: {hochlastStunden.map((s) => `${s.stunde}:00`).join(', ')} Uhr
              </p>
              <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
                Küche frühzeitig vorbereiten — erhöhter Bestelleingang erwartet
              </p>
            </div>
          )}

          {slots.every((s) => s.avgBestellungen === 0) && (
            <p className="text-center text-xs text-muted-foreground py-2">
              Noch keine historischen Daten — Prognose wird nach 7 Tagen aufgebaut.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
