'use client';

import { useMemo } from 'react';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

type Order = {
  id: string;
  bestellnummer?: string;
  status?: string;
  items: { name: string }[] | string;
  created_at?: string;
  bestellt_am?: string;
};

const STATION_KEYWORDS: Record<string, string> = {
  pizza: 'Ofen', flammkuchen: 'Ofen', auflauf: 'Ofen',
  burger: 'Grill', steak: 'Grill', schnitzel: 'Grill',
  pasta: 'Herd', suppe: 'Herd', curry: 'Herd',
  salat: 'Kalt', bowl: 'Kalt', wrap: 'Kalt',
  pommes: 'Friteuse', nuggets: 'Friteuse', chicken: 'Friteuse',
};

const KAPAZITAET: Record<string, number> = { Ofen: 3, Grill: 2, Herd: 4, Kalt: 5, Friteuse: 3, Küche: 3 };
const ENGPASS_SCHWELLE = 2;

function getStation(items: { name: string }[] | string): string {
  const text = Array.isArray(items) ? items.map((i) => i.name.toLowerCase()).join(' ') : String(items).toLowerCase();
  for (const [kw, s] of Object.entries(STATION_KEYWORDS)) if (text.includes(kw)) return s;
  return 'Küche';
}

function getAgeMin(order: Order): number {
  const ref = order.bestellt_am ?? order.created_at;
  if (!ref) return 0;
  return (Date.now() - new Date(ref).getTime()) / 60000;
}

export function KitchenPhase1062PrepEngpassFruehwarner({ orders }: { orders: Order[] }) {
  const engpaesse = useMemo(() => {
    const aktiv = orders.filter((o) =>
      ['neu', 'angenommen', 'wartend', 'in_zubereitung', 'pending'].includes(o.status ?? '')
    );

    const stationMap = new Map<string, { orders: Order[]; kap: number }>();
    for (const o of aktiv) {
      const s = getStation(o.items);
      const prev = stationMap.get(s) ?? { orders: [], kap: KAPAZITAET[s] ?? 3 };
      stationMap.set(s, { orders: [...prev.orders, o], kap: prev.kap });
    }

    return [...stationMap.entries()]
      .filter(([, { orders: ords, kap }]) => ords.length >= kap + ENGPASS_SCHWELLE)
      .map(([station, { orders: ords, kap }]) => ({
        station,
        anzahl: ords.length,
        kap,
        ueberstand: ords.length - kap,
        aelteste: ords.sort((a, b) => getAgeMin(b) - getAgeMin(a)).slice(0, 3),
      }))
      .sort((a, b) => b.ueberstand - a.ueberstand);
  }, [orders]);

  if (engpaesse.length === 0) return null;

  return (
    <div className="rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-red-200 dark:border-red-800">
        <ShieldAlert size={15} className="text-red-600 dark:text-red-400 animate-pulse" />
        <span className="text-xs font-bold text-red-800 dark:text-red-200 uppercase tracking-wider">
          Engpass-Frühwarnung — {engpaesse.length} Station{engpaesse.length > 1 ? 'en' : ''} überlastet
        </span>
      </div>
      <div className="p-3 space-y-2">
        {engpaesse.map(({ station, anzahl, kap, ueberstand, aelteste }) => (
          <div
            key={station}
            className="rounded-xl bg-white dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <AlertTriangle size={13} className="text-red-500" />
                <span className="text-sm font-bold text-red-900 dark:text-red-100">{station}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold rounded-full bg-red-500 text-white px-2 py-0.5">
                  +{ueberstand} über Kapazität
                </span>
                <span className="text-[10px] text-red-500 dark:text-red-400 font-bold">{anzahl}/{kap}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-1 mb-1.5">
              {aelteste.map((o) => (
                <span
                  key={o.id}
                  className="text-[9px] font-bold bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700 rounded px-1.5 py-0.5"
                >
                  #{o.bestellnummer ?? o.id.slice(-4)} — {Math.round(getAgeMin(o))} Min
                </span>
              ))}
            </div>
            <p className={cn('text-[10px] font-semibold text-red-600 dark:text-red-400')}>
              → Sofort Unterstützung an {station} einteilen oder Bestellungen priorisieren
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
