'use client';

/**
 * Phase 595 — Kitchen: Countdown-Ampel-Hub
 *
 * Kompakter Streifen mit drei Ampelzählern (Grün / Gelb / Rot).
 * Zeigt Anzahl der Bestellungen je Status + Ø verbleibende Zeit für grüne.
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

const ACTIVE_STATUSES = new Set(['bestätigt', 'in_zubereitung']);

function elapsedMin(bestelltAm: string | null): number {
  if (!bestelltAm) return 0;
  return Math.floor((Date.now() - new Date(bestelltAm).getTime()) / 60_000);
}

export function KitchenPhase595CountdownAmpelHub({ orders }: Props) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1_000);
    return () => clearInterval(id);
  }, []);

  const activeOrders = orders.filter(o => ACTIVE_STATUSES.has(o.status));
  const total = activeOrders.length;

  // Bestellungen klassifizieren
  const green: number[] = [];
  const amber: number[] = [];
  const red:   number[] = [];

  for (const order of activeOrders) {
    const elapsed   = elapsedMin(order.bestellt_am);
    const estimated = order.geschaetzte_zubereitung_min ?? 0;
    const pct       = estimated > 0 ? (elapsed / estimated) * 100 : 0;
    const remaining = Math.max(0, estimated - elapsed);

    if (pct > 100)      red.push(remaining);
    else if (pct >= 80) amber.push(remaining);
    else                green.push(remaining);
  }

  const avgGreenRemaining =
    green.length > 0
      ? Math.round(green.reduce((s, v) => s + v, 0) / green.length)
      : null;

  return (
    <div className="rounded-xl border border-matcha-200 bg-white overflow-hidden">
      {/* Überschrift */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-matcha-100 bg-matcha-50">
        <ChefHat className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-matcha-800">
          Ampel-Hub: {total} Bestellung{total !== 1 ? 'en' : ''}
        </span>
      </div>

      {total === 0 ? (
        <div className="px-4 py-5 text-center text-sm text-muted-foreground">
          Keine aktiven Bestellungen
        </div>
      ) : (
        <div className="grid grid-cols-3 divide-x divide-matcha-100">
          {/* GRÜN */}
          <div className="flex flex-col items-center gap-1 px-3 py-4 bg-matcha-50">
            <span className="text-3xl font-black tabular-nums text-matcha-700 leading-none">
              {green.length}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wide text-matcha-600">
              Pünktlich
            </span>
            {avgGreenRemaining !== null && (
              <span className="flex items-center gap-0.5 text-[10px] text-matcha-500 mt-0.5">
                <Clock className="h-3 w-3" />
                Ø {avgGreenRemaining} Min
              </span>
            )}
          </div>

          {/* GELB */}
          <div className="flex flex-col items-center gap-1 px-3 py-4 bg-amber-50">
            <span className="text-3xl font-black tabular-nums text-amber-700 leading-none">
              {amber.length}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wide text-amber-600">
              Gefährdet
            </span>
            <span className="flex items-center gap-0.5 text-[10px] text-amber-400 mt-0.5">
              <Clock className="h-3 w-3" />
              80–100 %
            </span>
          </div>

          {/* ROT */}
          <div className="flex flex-col items-center gap-1 px-3 py-4 bg-red-50">
            <span className="text-3xl font-black tabular-nums text-red-700 leading-none">
              {red.length}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wide text-red-600">
              Überfällig
            </span>
            <span className="flex items-center gap-0.5 text-[10px] text-red-400 mt-0.5">
              <AlertCircle className="h-3 w-3" />
              {red.length > 0 ? '> 100 %' : '—'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
