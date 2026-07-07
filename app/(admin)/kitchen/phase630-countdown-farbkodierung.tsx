'use client';

import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

interface Order {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
}

function fmtCountdown(sec: number): string {
  if (sec <= 0) return '–';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function getColor(sec: number, zielSec: number): string {
  const ratio = sec / zielSec;
  if (sec <= 0) return 'text-red-600 dark:text-red-400';
  if (ratio <= 0.2) return 'text-red-500 dark:text-red-400 animate-pulse';
  if (ratio <= 0.4) return 'text-amber-500 dark:text-amber-400';
  return 'text-matcha-600 dark:text-matcha-400';
}

function getBg(sec: number, zielSec: number): string {
  const ratio = sec / zielSec;
  if (sec <= 0) return 'bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-800';
  if (ratio <= 0.2) return 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900';
  if (ratio <= 0.4) return 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900';
  return 'bg-white dark:bg-gray-900/30 border-gray-100 dark:border-gray-800';
}

export function KitchenPhase630CountdownFarbkodierung({ orders }: { orders: Order[] }) {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  const aktiv = orders.filter((o) =>
    ['neu', 'bestätigt', 'in_zubereitung'].includes(o.status) && o.bestellt_am
  );

  if (aktiv.length === 0) return null;

  return (
    <div className="mb-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/20 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Clock className="h-4 w-4 text-gray-600 dark:text-gray-400" />
        <span className="text-sm font-bold uppercase tracking-wide text-gray-700 dark:text-gray-300">
          Live-Countdown · Farbkodierung
        </span>
        <span className="ml-auto rounded-full bg-gray-200 dark:bg-gray-700 px-2 py-0.5 text-xs font-bold text-gray-600 dark:text-gray-300">
          {aktiv.length}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {aktiv.map((order) => {
          const zielSec = (order.geschaetzte_zubereitung_min ?? 15) * 60;
          const vergSec = Math.round((now - new Date(order.bestellt_am!).getTime()) / 1_000);
          const restSec = zielSec - vergSec;
          const color = getColor(restSec, zielSec);
          const bgCls = getBg(restSec, zielSec);
          const fortschritt = Math.min(100, Math.round((vergSec / zielSec) * 100));

          return (
            <div
              key={order.id}
              className={`rounded-xl border p-3 flex flex-col items-center gap-1.5 ${bgCls}`}
            >
              <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 truncate w-full text-center">
                #{order.bestellnummer}
              </span>
              <span className={`font-mono text-2xl font-black tabular-nums ${color}`}>
                {restSec <= 0 ? (
                  <span className="text-red-600 dark:text-red-400 animate-pulse">ÜBERFÄLLIG</span>
                ) : (
                  fmtCountdown(restSec)
                )}
              </span>
              <div className="w-full h-1 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    restSec <= 0
                      ? 'bg-red-500'
                      : fortschritt >= 80
                      ? 'bg-amber-400'
                      : 'bg-matcha-500'
                  }`}
                  style={{ width: `${fortschritt}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
