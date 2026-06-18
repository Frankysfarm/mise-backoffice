'use client';

/**
 * KitchenFertigOhneFahrerAlert
 *
 * Zeigt ein Ampel-Warnband wenn Bestellungen im Status "fertig" seit
 * mehr als N Minuten keinen Fahrer zugewiesen haben. Hilft der Küche
 * einzuschätzen, ob Essen warm gehalten werden muss.
 *
 * 🔴 > 10 Min ohne Fahrer — kritisch, Dispatch kontaktieren
 * 🟠  5–10 Min ohne Fahrer — Aufmerksamkeit nötig
 * 🟡  2–5 Min ohne Fahrer  — Hinweis
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, Clock, Bike } from 'lucide-react';

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  fertig_am: string | null;
  typ: string;
};

type BatchStop = {
  order_id: string;
};

interface Props {
  orders: Order[];
  stops: BatchStop[];
}

function useTickSec() {
  const [, setT] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setT((n) => n + 1), 10_000);
    return () => clearInterval(iv);
  }, []);
}

function waitMinutes(fertigAm: string | null): number {
  if (!fertigAm) return 0;
  return Math.floor((Date.now() - new Date(fertigAm).getTime()) / 60_000);
}

type UrgencyLevel = 'critical' | 'high' | 'medium';

interface WaitingOrder {
  id: string;
  bestellnummer: string;
  waitMin: number;
  level: UrgencyLevel;
}

export function KitchenFertigOhneFahrerAlert({ orders, stops }: Props) {
  useTickSec();

  const assignedOrderIds = new Set(stops.map((s) => s.order_id));

  const waiting: WaitingOrder[] = orders
    .filter(
      (o) =>
        o.status === 'fertig' &&
        o.typ === 'lieferung' &&
        !assignedOrderIds.has(o.id) &&
        o.fertig_am != null,
    )
    .map((o) => {
      const waitMin = waitMinutes(o.fertig_am);
      const level: UrgencyLevel =
        waitMin >= 10 ? 'critical' : waitMin >= 5 ? 'high' : 'medium';
      return { id: o.id, bestellnummer: o.bestellnummer, waitMin, level };
    })
    .filter((o) => o.waitMin >= 2)
    .sort((a, b) => b.waitMin - a.waitMin);

  if (waiting.length === 0) return null;

  const topLevel =
    waiting.some((o) => o.level === 'critical')
      ? 'critical'
      : waiting.some((o) => o.level === 'high')
      ? 'high'
      : 'medium';

  const bannerStyles: Record<UrgencyLevel, string> = {
    critical: 'bg-red-600 text-white border-red-700',
    high: 'bg-orange-500 text-white border-orange-600',
    medium: 'bg-amber-400 text-amber-900 border-amber-500',
  };

  const dotStyles: Record<UrgencyLevel, string> = {
    critical: 'bg-white/60',
    high: 'bg-white/60',
    medium: 'bg-amber-900/40',
  };

  return (
    <div
      className={cn(
        'rounded-xl border px-4 py-3 flex items-start gap-3',
        bannerStyles[topLevel],
        topLevel === 'critical' && 'animate-pulse',
      )}
    >
      <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />

      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-black uppercase tracking-widest opacity-80 mb-1">
          {waiting.length === 1
            ? '1 Bestellung wartet auf Fahrer'
            : `${waiting.length} Bestellungen warten auf Fahrer`}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {waiting.map((o) => (
            <div
              key={o.id}
              className={cn(
                'flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold',
                o.level === 'critical'
                  ? 'bg-white/20 text-white'
                  : o.level === 'high'
                  ? 'bg-white/20 text-white'
                  : 'bg-amber-900/15 text-amber-900',
              )}
            >
              <Clock className="h-2.5 w-2.5" />
              #{o.bestellnummer} · {o.waitMin} Min
            </div>
          ))}
        </div>
      </div>

      <div className="shrink-0 flex flex-col items-center gap-1 text-center">
        <Bike className="h-5 w-5 opacity-70" />
        <span className="text-[9px] font-black uppercase opacity-70">Dispatch!</span>
      </div>
    </div>
  );
}
