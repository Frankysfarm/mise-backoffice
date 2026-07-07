'use client';

/**
 * Phase 590 — Kitchen: Smart-Timing-Color-Board
 *
 * Farbkodiertes Raster aller aktiven Bestellungen mit Echtzeit-Timing.
 * Ampelfarben: Grün < 80 % · Gelb 80–100 % · Rot > 100 % der Zubereitungszeit.
 *
 * Ticker: 1s
 */

import { useEffect, useState } from 'react';
import { AlertCircle, ChefHat, Clock } from 'lucide-react';

interface Order {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  kunde_name: string;
  typ: string;
}

interface Props {
  orders: Order[];
}

type AmpelColor = 'green' | 'amber' | 'red';

function elapsedMin(bestelltAm: string | null): number {
  if (!bestelltAm) return 0;
  return Math.floor((Date.now() - new Date(bestelltAm).getTime()) / 60_000);
}

function ampelColor(pct: number): AmpelColor {
  if (pct > 100) return 'red';
  if (pct >= 80) return 'amber';
  return 'green';
}

const BG: Record<AmpelColor, string> = {
  green: 'bg-matcha-100 border-matcha-300',
  amber: 'bg-amber-50 border-amber-300',
  red:   'bg-red-50 border-red-300',
};

const TEXT: Record<AmpelColor, string> = {
  green: 'text-matcha-700',
  amber: 'text-amber-700',
  red:   'text-red-700',
};

const ACTIVE_STATUSES = new Set(['bestätigt', 'in_zubereitung']);

export function KitchenPhase590SmartTimingColorBoard({ orders }: Props) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1_000);
    return () => clearInterval(id);
  }, []);

  const activeOrders = orders.filter(o => ACTIVE_STATUSES.has(o.status));

  if (activeOrders.length === 0) {
    return (
      <div className="rounded-xl border border-matcha-200 bg-white p-8 flex flex-col items-center gap-2">
        <ChefHat className="h-8 w-8 text-matcha-300" />
        <p className="text-sm text-muted-foreground">Keine aktiven Bestellungen</p>
      </div>
    );
  }

  const cards = activeOrders.map(order => {
    const elapsed    = elapsedMin(order.bestellt_am);
    const estimated  = order.geschaetzte_zubereitung_min ?? 0;
    const pct        = estimated > 0 ? (elapsed / estimated) * 100 : 0;
    const remaining  = Math.max(0, estimated - elapsed);
    const color      = ampelColor(pct);
    return { order, elapsed, remaining, color };
  });

  const greenCount = cards.filter(c => c.color === 'green').length;
  const amberCount = cards.filter(c => c.color === 'amber').length;
  const redCount   = cards.filter(c => c.color === 'red').length;

  return (
    <div className="rounded-xl border border-matcha-200 bg-white overflow-hidden">
      {/* Kopfzeile */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-matcha-100 bg-matcha-50">
        <Clock className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-sm font-bold uppercase tracking-wider text-matcha-800">
          Smart Timing Board
        </span>
        {/* Zusammenfassung */}
        <div className="ml-auto flex items-center gap-3 text-xs font-bold tabular-nums">
          <span className="text-matcha-700">{greenCount} grün</span>
          <span className="text-amber-600">{amberCount} gelb</span>
          <span className="text-red-600">{redCount} rot</span>
        </div>
      </div>

      {/* Raster */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 p-3">
        {cards.map(({ order, elapsed, remaining, color }) => (
          <div
            key={order.id}
            className={`rounded-lg border p-3 space-y-1.5 transition-colors duration-500 ${BG[color]}`}
          >
            {/* Bestellnummer + Icon */}
            <div className="flex items-center justify-between gap-1">
              <span className={`text-xs font-black ${TEXT[color]}`}>
                #{order.bestellnummer}
              </span>
              {color === 'red'
                ? <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                : <ChefHat className={`h-3.5 w-3.5 shrink-0 ${TEXT[color]}`} />
              }
            </div>

            {/* Kundenname */}
            <div className="text-[11px] font-bold truncate text-foreground">
              {order.kunde_name}
            </div>

            {/* Zeitangabe */}
            <div className={`text-[10px] tabular-nums leading-tight ${TEXT[color]}`}>
              {elapsed} Min vergangen · {remaining} Min verbleibend
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
