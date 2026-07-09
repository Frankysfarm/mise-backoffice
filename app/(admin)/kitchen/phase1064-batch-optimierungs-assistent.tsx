'use client';

import { useMemo } from 'react';
import { Layers, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Order = {
  id: string;
  bestellnummer?: string;
  status?: string;
  items: { name: string }[] | string;
  created_at?: string;
  bestellt_am?: string;
  delivery_zone?: string;
};

const STATION_KEYWORDS: Record<string, string> = {
  pizza: 'Ofen', flammkuchen: 'Ofen', auflauf: 'Ofen',
  burger: 'Grill', steak: 'Grill', schnitzel: 'Grill',
  pasta: 'Herd', suppe: 'Herd', curry: 'Herd', nudel: 'Herd',
  salat: 'Kalt', bowl: 'Kalt', wrap: 'Kalt',
  pommes: 'Friteuse', nuggets: 'Friteuse', chicken: 'Friteuse', frites: 'Friteuse',
};

function getStation(items: { name: string }[] | string): string {
  const text = Array.isArray(items)
    ? items.map((i) => i.name.toLowerCase()).join(' ')
    : String(items).toLowerCase();
  for (const [kw, s] of Object.entries(STATION_KEYWORDS)) if (text.includes(kw)) return s;
  return 'Küche';
}

function getItems(items: { name: string }[] | string): string[] {
  if (Array.isArray(items)) return items.map((i) => i.name);
  return String(items).split(',').map((s) => s.trim()).filter(Boolean);
}

interface Batch {
  station: string;
  bestellungen: { id: string; nr: string; items: string[] }[];
  zeitersparnis_min: number;
  sinnvoll: boolean;
}

export function KitchenPhase1064BatchOptimierungsAssistent({ orders }: { orders: Order[] }) {
  const batches = useMemo<Batch[]>(() => {
    const aktiv = orders.filter((o) =>
      ['neu', 'angenommen', 'wartend', 'pending', 'confirmed'].includes(o.status ?? '')
    );

    const stationMap = new Map<string, Order[]>();
    for (const o of aktiv) {
      const s = getStation(o.items);
      const prev = stationMap.get(s) ?? [];
      stationMap.set(s, [...prev, o]);
    }

    return [...stationMap.entries()]
      .filter(([, ords]) => ords.length >= 2)
      .map(([station, ords]) => ({
        station,
        bestellungen: ords.map((o) => ({
          id: o.id,
          nr: o.bestellnummer ?? o.id.slice(0, 6),
          items: getItems(o.items),
        })),
        zeitersparnis_min: Math.round((ords.length - 1) * 3.5),
        sinnvoll: ords.length >= 2,
      }))
      .sort((a, b) => b.zeitersparnis_min - a.zeitersparnis_min);
  }, [orders]);

  if (batches.length === 0) return null;

  const gesamtErsparnis = batches.reduce((s, b) => s + b.zeitersparnis_min, 0);

  return (
    <div className="rounded-2xl border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/30 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-teal-200 dark:border-teal-800">
        <div className="flex items-center gap-2">
          <Layers size={14} className="text-teal-600 dark:text-teal-400" />
          <span className="text-xs font-bold text-teal-800 dark:text-teal-200 uppercase tracking-wider">
            Batch-Optimierung — {batches.length} Bündel möglich
          </span>
        </div>
        <span className="text-xs font-semibold text-teal-700 dark:text-teal-300 bg-teal-100 dark:bg-teal-900/50 px-2 py-0.5 rounded-full">
          ~{gesamtErsparnis} Min gespart
        </span>
      </div>
      <div className="p-3 space-y-2">
        {batches.map(({ station, bestellungen, zeitersparnis_min }) => (
          <div
            key={station}
            className="rounded-xl bg-white dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 p-3"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-teal-900 dark:text-teal-100">
                {station} — {bestellungen.length} Bestellungen gemeinsam
              </span>
              <span className="text-[10px] font-semibold text-teal-600 dark:text-teal-400 bg-teal-100 dark:bg-teal-900 px-1.5 py-0.5 rounded-full">
                ~{zeitersparnis_min} Min
              </span>
            </div>
            <div className="space-y-1">
              {bestellungen.map(({ nr, items }) => (
                <div key={nr} className="flex items-start gap-1.5">
                  <CheckCircle2 size={11} className="text-teal-500 mt-0.5 shrink-0" />
                  <span className="text-[11px] text-teal-800 dark:text-teal-200">
                    <span className="font-semibold">#{nr}</span>
                    {items.length > 0 && (
                      <span className="text-teal-600 dark:text-teal-400 ml-1">
                        — {items.slice(0, 2).join(', ')}
                        {items.length > 2 && ` +${items.length - 2}`}
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
