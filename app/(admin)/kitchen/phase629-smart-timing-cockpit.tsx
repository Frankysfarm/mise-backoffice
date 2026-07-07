'use client';

import { useEffect, useState } from 'react';
import { Clock, Zap, AlertTriangle, CheckCircle2, Timer } from 'lucide-react';

interface Order {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
}

type Prioritaet = 'kritisch' | 'dringend' | 'normal' | 'fertig';

function calcPrioritaet(order: Order): { prio: Prioritaet; restMin: number | null; vergMin: number } {
  const vergMin = order.bestellt_am
    ? Math.round((Date.now() - new Date(order.bestellt_am).getTime()) / 60_000)
    : 0;
  const zielMin = order.geschaetzte_zubereitung_min ?? 15;
  const restMin = Math.max(0, zielMin - vergMin);

  if (['geliefert', 'abgeholt', 'abgeschlossen', 'bereit'].includes(order.status)) {
    return { prio: 'fertig', restMin: null, vergMin };
  }
  if (vergMin >= zielMin + 5) return { prio: 'kritisch', restMin: 0, vergMin };
  if (vergMin >= zielMin - 3) return { prio: 'dringend', restMin, vergMin };
  return { prio: 'normal', restMin, vergMin };
}

const PRIO_STYLE: Record<Prioritaet, { bg: string; border: string; badge: string; label: string; icon: React.ReactNode }> = {
  kritisch: {
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-400 dark:border-red-700',
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
    label: 'KRITISCH',
    icon: <AlertTriangle className="h-3.5 w-3.5 text-red-500" />,
  },
  dringend: {
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-400 dark:border-amber-600',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
    label: 'DRINGEND',
    icon: <Zap className="h-3.5 w-3.5 text-amber-500" />,
  },
  normal: {
    bg: 'bg-white dark:bg-gray-900/30',
    border: 'border-gray-200 dark:border-gray-700',
    badge: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    label: 'OK',
    icon: <Clock className="h-3.5 w-3.5 text-green-500" />,
  },
  fertig: {
    bg: 'bg-gray-50 dark:bg-gray-900/20',
    border: 'border-gray-100 dark:border-gray-800',
    badge: 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500',
    label: 'FERTIG',
    icon: <CheckCircle2 className="h-3.5 w-3.5 text-gray-400" />,
  },
};

export function KitchenPhase629SmartTimingCockpit({ orders }: { orders: Order[] }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  const aktiv = orders.filter((o) =>
    ['neu', 'bestätigt', 'in_zubereitung'].includes(o.status)
  );

  if (aktiv.length === 0) return null;

  const bewertet = aktiv.map((o) => ({ order: o, ...calcPrioritaet(o) }));
  bewertet.sort((a, b) => {
    const rank = { kritisch: 0, dringend: 1, normal: 2, fertig: 3 };
    if (rank[a.prio] !== rank[b.prio]) return rank[a.prio] - rank[b.prio];
    return (a.restMin ?? 999) - (b.restMin ?? 999);
  });

  const kritischCount = bewertet.filter((b) => b.prio === 'kritisch').length;
  const dringendCount = bewertet.filter((b) => b.prio === 'dringend').length;

  return (
    <div className="mb-4 rounded-xl border border-matcha-200 dark:border-matcha-800 bg-matcha-50 dark:bg-matcha-950/20 p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 flex-wrap">
        <Timer className="h-4 w-4 text-matcha-600 dark:text-matcha-400" />
        <span className="text-sm font-bold uppercase tracking-wide text-matcha-800 dark:text-matcha-200">
          Smart-Timing Cockpit
        </span>
        {kritischCount > 0 && (
          <span className="rounded-full bg-red-100 dark:bg-red-900/40 px-2 py-0.5 text-xs font-bold text-red-700 dark:text-red-300">
            {kritischCount} kritisch
          </span>
        )}
        {dringendCount > 0 && (
          <span className="rounded-full bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-300">
            {dringendCount} dringend
          </span>
        )}
        <span className="ml-auto text-xs text-matcha-600 dark:text-matcha-400 font-semibold">
          {aktiv.length} aktiv
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {bewertet.slice(0, 8).map(({ order, prio, restMin, vergMin }) => {
          const s = PRIO_STYLE[prio];
          const ziel = order.geschaetzte_zubereitung_min ?? 15;
          const fortschritt = Math.min(100, Math.round((vergMin / ziel) * 100));

          return (
            <div
              key={order.id}
              className={`rounded-lg border p-3 ${s.bg} ${s.border} flex flex-col gap-2`}
            >
              <div className="flex items-center gap-2">
                {s.icon}
                <span className="text-xs font-bold text-gray-800 dark:text-gray-100 truncate">
                  #{order.bestellnummer}
                </span>
                <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-black ${s.badge}`}>
                  {s.label}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                <span>{vergMin} Min vergangen</span>
                {restMin !== null && restMin > 0 && (
                  <span className="ml-auto font-semibold text-gray-700 dark:text-gray-300">
                    noch ~{restMin} Min
                  </span>
                )}
                {restMin === 0 && prio === 'kritisch' && (
                  <span className="ml-auto font-bold text-red-600 dark:text-red-400 animate-pulse">
                    Überfällig!
                  </span>
                )}
              </div>
              <div className="h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    prio === 'kritisch'
                      ? 'bg-red-500'
                      : prio === 'dringend'
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

      {bewertet.length > 8 && (
        <p className="mt-2 text-center text-xs text-matcha-600 dark:text-matcha-400">
          + {bewertet.length - 8} weitere Bestellungen
        </p>
      )}
    </div>
  );
}
