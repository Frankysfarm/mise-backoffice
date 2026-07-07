'use client';

import { useEffect, useState } from 'react';
import { ListOrdered, Clock, AlertTriangle } from 'lucide-react';

interface Order {
  id: string;
  status: string;
  order_number?: string | null;
  estimated_pickup_at?: string | null;
  created_at: string;
  items?: Array<{ name?: string }> | null;
}

function minsUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
}

function dringlichkeit(order: Order): 'kritisch' | 'bald' | 'normal' {
  const min = minsUntil(order.estimated_pickup_at);
  if (min === null) return 'normal';
  if (min <= 5) return 'kritisch';
  if (min <= 12) return 'bald';
  return 'normal';
}

const FARBEN: Record<string, string> = {
  kritisch: 'border-red-400 bg-red-50 dark:bg-red-950/30 dark:border-red-700',
  bald: 'border-amber-400 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700',
  normal: 'border-gray-200 bg-white dark:bg-gray-800/40 dark:border-gray-700',
};

const BADGE_FARBEN: Record<string, string> = {
  kritisch: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  bald: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  normal: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

export function KitchenPhase626PrepPriorisierungsScanner({ orders }: { orders: Order[] }) {
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  // Only show orders that need prep (not yet bereit/geliefert)
  const zuPruefen = orders
    .filter((o) => ['bestätigt', 'in_zubereitung'].includes(o.status))
    .sort((a, b) => {
      const ma = minsUntil(a.estimated_pickup_at) ?? 999;
      const mb = minsUntil(b.estimated_pickup_at) ?? 999;
      return ma - mb;
    });

  if (zuPruefen.length === 0) return null;

  const kritischCount = zuPruefen.filter((o) => dringlichkeit(o) === 'kritisch').length;

  return (
    <div className="mb-4 rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/30 p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <ListOrdered className="h-4 w-4 text-purple-600 dark:text-purple-400" />
        <span className="text-sm font-bold text-purple-800 dark:text-purple-200 uppercase tracking-wide">
          Prep-Priorität
        </span>
        {kritischCount > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/40 px-2 py-0.5 text-xs font-bold text-red-700 dark:text-red-300">
            <AlertTriangle className="h-3 w-3" />
            {kritischCount} kritisch
          </span>
        )}
        <span className="ml-auto rounded-full bg-purple-100 dark:bg-purple-900/40 px-2 py-0.5 text-xs font-semibold text-purple-700 dark:text-purple-300">
          {zuPruefen.length} offen
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {zuPruefen.slice(0, 8).map((order, i) => {
          const dring = dringlichkeit(order);
          const minLeft = minsUntil(order.estimated_pickup_at);
          const orderNum = order.order_number ?? order.id.slice(0, 6).toUpperCase();

          return (
            <div
              key={order.id}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${FARBEN[dring]}`}
            >
              <div className="shrink-0 h-6 w-6 rounded-full bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center">
                <span className="text-xs font-bold text-purple-700 dark:text-purple-300">{i + 1}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  #{orderNum}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {order.status === 'bestätigt' ? 'Noch nicht gestartet' : 'In Zubereitung'}
                </div>
              </div>
              <div className="shrink-0 flex items-center gap-1.5">
                <Clock className={`h-3.5 w-3.5 ${dring === 'kritisch' ? 'text-red-500' : dring === 'bald' ? 'text-amber-500' : 'text-gray-400'}`} />
                <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${BADGE_FARBEN[dring]}`}>
                  {minLeft === null
                    ? '—'
                    : minLeft <= 0
                    ? 'Abholung jetzt!'
                    : `Abholung ${minLeft} Min`}
                </span>
              </div>
            </div>
          );
        })}
        {zuPruefen.length > 8 && (
          <div className="text-center text-xs text-gray-400 dark:text-gray-500 pt-1">
            + {zuPruefen.length - 8} weitere
          </div>
        )}
      </div>
    </div>
  );
}
