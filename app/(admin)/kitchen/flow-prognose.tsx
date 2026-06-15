'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock } from 'lucide-react';

type Order = {
  bestellt_am: string | null;
  status: string;
};

interface Props {
  orders: Order[];
}

type Slot = {
  label: string;
  offsetMin: number;
};

const SLOTS: Slot[] = [
  { label: 'jetzt',   offsetMin: 0  },
  { label: '+30min',  offsetMin: 30 },
  { label: '+60min',  offsetMin: 60 },
  { label: '+90min',  offsetMin: 90 },
];

function getColor(rate: number): string {
  if (rate >= 10) return 'bg-red-500';
  if (rate >= 5)  return 'bg-amber-400';
  return 'bg-matcha-500';
}

function getTextColor(rate: number): string {
  if (rate >= 10) return 'text-red-700';
  if (rate >= 5)  return 'text-amber-700';
  return 'text-matcha-700';
}

function getLabelColor(rate: number): string {
  if (rate >= 10) return 'text-red-600';
  if (rate >= 5)  return 'text-amber-600';
  return 'text-matcha-600';
}

/**
 * Berechnet die Order-Rate für ein 30-min-Fenster zentriert um den Zielzeitpunkt.
 * Nutzt historische Tageswerte als Muster und skaliert auf die aktuelle Rate.
 */
function estimateRateForOffset(orders: Order[], offsetMin: number): number {
  const now = Date.now();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  // Bestimmte Bestellungen der letzten 60 Minuten (aktuell Rate)
  const lastHourOrders = orders.filter((o) => {
    if (!o.bestellt_am) return false;
    const age = now - new Date(o.bestellt_am).getTime();
    return age >= 0 && age <= 60 * 60_000;
  });
  const currentRate = lastHourOrders.length; // Bestellungen/h in letzter Stunde

  if (offsetMin === 0) return currentRate;

  // Historische Tageswerte: Bestellungen der letzten 7 Tage zur gleichen Uhrzeit
  // Da wir nur heutige Daten haben, nutzen wir das Tagesverlaufsmuster aus orders
  const targetHour = new Date(now + offsetMin * 60_000).getHours();
  const currentHour = new Date(now).getHours();

  // Berechne stündliche Verteilung aus vorhandenen Bestellungen
  const byHour: Record<number, number> = {};
  for (const o of orders) {
    if (!o.bestellt_am) continue;
    const d = new Date(o.bestellt_am);
    const h = d.getHours();
    byHour[h] = (byHour[h] ?? 0) + 1;
  }

  const currentHourCount = byHour[currentHour] ?? 0;
  const targetHourCount  = byHour[targetHour]  ?? 0;

  // Verhältnis zwischen Zielstunde und aktueller Stunde
  if (currentHourCount === 0) return currentRate;

  const ratio = targetHourCount / currentHourCount;
  return Math.round(currentRate * ratio * 10) / 10;
}

export function KitchenFlowPrognose({ orders }: Props) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(iv);
  }, []);

  // Nur anzeigen wenn mindestens 1 Bestellung heute
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayOrders = orders.filter((o) => {
    if (!o.bestellt_am) return false;
    return new Date(o.bestellt_am) >= today;
  });

  if (todayOrders.length < 1) return null;

  const maxRate = 15; // Cap für Balkenbreite

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="font-display text-xs font-bold uppercase tracking-wider">
          Küchen-Flow-Prognose
        </span>
      </div>

      {/* Slots */}
      <div className="px-3 py-2 space-y-1.5">
        {SLOTS.map((slot) => {
          const rate = estimateRateForOffset(todayOrders, slot.offsetMin);
          const barPct = Math.min((rate / maxRate) * 100, 100);
          const barColor = getColor(rate);
          const textColor = getTextColor(rate);
          const labelColor = getLabelColor(rate);

          return (
            <div key={slot.label} className="flex items-center gap-2">
              <span className={cn('w-12 shrink-0 text-[10px] font-bold', labelColor)}>
                {slot.label}
              </span>
              <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-700', barColor)}
                  style={{ width: `${barPct}%` }}
                />
              </div>
              <span className={cn('w-14 shrink-0 text-right text-[10px] font-black tabular-nums', textColor)}>
                {rate.toFixed(1)}/h
              </span>
            </div>
          );
        })}
      </div>

      {/* Legende */}
      <div className="flex items-center gap-3 px-3 pb-2 text-[9px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-matcha-500" />
          &lt;5/h
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
          &lt;10/h
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
          ≥10/h
        </span>
      </div>
    </div>
  );
}
