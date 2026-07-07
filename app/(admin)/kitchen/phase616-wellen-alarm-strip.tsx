'use client';

import { useEffect, useState } from 'react';
import { Zap, AlertTriangle } from 'lucide-react';

interface Order {
  id: string;
  status: string;
  created_at: string;
}

const WELLEN_SCHWELLE = 3;
const FENSTER_MIN = 5;

function detectWelle(orders: Order[]): { aktiv: boolean; anzahl: number; aelteste: Date | null } {
  const jetzt = new Date();
  const fensterStart = new Date(jetzt.getTime() - FENSTER_MIN * 60_000);
  const aktuelle = orders.filter(
    (o) =>
      ['bestätigt', 'bestaetigt', 'neu', 'in_zubereitung'].includes(o.status) &&
      new Date(o.created_at) >= fensterStart,
  );
  return {
    aktiv: aktuelle.length >= WELLEN_SCHWELLE,
    anzahl: aktuelle.length,
    aelteste: aktuelle.length > 0 ? new Date(Math.min(...aktuelle.map((o) => new Date(o.created_at).getTime()))) : null,
  };
}

export function KitchenPhase616WellenAlarmStrip({ orders }: { orders: Order[] }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 15_000);
    return () => clearInterval(id);
  }, []);

  const welle = detectWelle(orders);

  if (!welle.aktiv) return null;

  const minSeit = welle.aelteste
    ? Math.round((new Date().getTime() - welle.aelteste.getTime()) / 60_000)
    : 0;

  return (
    <div
      key={tick}
      className="mb-4 flex items-center gap-3 rounded-xl border border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950/30 px-4 py-3 shadow-sm"
    >
      <div className="flex shrink-0 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/40 p-2">
        <Zap className="h-5 w-5 text-orange-600 dark:text-orange-400" />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
          <span className="text-xs font-bold uppercase tracking-wide text-orange-700 dark:text-orange-300">
            Bestellwelle erkannt
          </span>
        </div>
        <div className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-gray-100">
          {welle.anzahl} Bestellungen in den letzten {FENSTER_MIN} Min
          {minSeit > 0 && (
            <span className="ml-1 text-xs font-normal text-gray-500 dark:text-gray-400">
              (erste vor {minSeit} Min)
            </span>
          )}
        </div>
        <div className="text-xs text-orange-600 dark:text-orange-400 mt-0.5">
          Kapazität prüfen — ggf. Prioritäten setzen
        </div>
      </div>
      <div className="shrink-0 rounded-lg bg-orange-100 dark:bg-orange-900/40 px-3 py-1 text-center">
        <div className="text-2xl font-black tabular-nums text-orange-700 dark:text-orange-300">
          {welle.anzahl}
        </div>
        <div className="text-[10px] text-orange-600 dark:text-orange-400">Aktiv</div>
      </div>
    </div>
  );
}
