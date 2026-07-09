'use client';

import { useMemo, useState } from 'react';
import { Layers, Clock, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

type OrderItem = {
  name: string;
  category?: string;
  prep_time?: number;
};

type Order = {
  id: string;
  bestellnummer?: string;
  items: OrderItem[] | string;
  status?: string;
  created_at?: string;
};

type ParallelGruppe = {
  gruppeId: number;
  orders: { orderId: string; bestellnummer: string; station: string; minuten: number }[];
  zeitersparnis: number;
};

const STATIONEN: Record<string, string> = {
  pizza: 'Ofen',
  burger: 'Grill',
  pasta: 'Herd',
  salat: 'Kalt',
  suppe: 'Herd',
  dessert: 'Kalt',
  getraenk: 'Bar',
  beilage: 'Friteuse',
};

function detectStation(items: OrderItem[] | string): { station: string; minuten: number } {
  const names = Array.isArray(items)
    ? items.map((i) => i.name.toLowerCase()).join(' ')
    : String(items).toLowerCase();

  if (names.includes('pizza')) return { station: 'Ofen', minuten: 12 };
  if (names.includes('burger') || names.includes('steak')) return { station: 'Grill', minuten: 10 };
  if (names.includes('pasta') || names.includes('suppe') || names.includes('curry'))
    return { station: 'Herd', minuten: 8 };
  if (names.includes('salat') || names.includes('bowl')) return { station: 'Kalt', minuten: 4 };
  if (names.includes('pommes') || names.includes('frit')) return { station: 'Friteuse', minuten: 6 };
  return { station: 'Küche', minuten: 8 };
}

function buildParallelGruppen(orders: Order[]): ParallelGruppe[] {
  const pending = orders.filter((o) => ['neu', 'angenommen', 'wartend', 'pending'].includes(o.status ?? ''));
  if (pending.length === 0) return [];

  const mapped = pending.map((o) => {
    const { station, minuten } = detectStation(o.items);
    return { orderId: o.id, bestellnummer: o.bestellnummer ?? o.id.slice(-6), station, minuten };
  });

  const gruppen: ParallelGruppe[] = [];
  const stationenInGruppe = new Set<string>();
  let aktuelleGruppe: typeof mapped = [];

  for (const entry of mapped) {
    if (!stationenInGruppe.has(entry.station)) {
      stationenInGruppe.add(entry.station);
      aktuelleGruppe.push(entry);
    } else {
      if (aktuelleGruppe.length > 0) {
        const maxMinuten = Math.max(...aktuelleGruppe.map((e) => e.minuten));
        const sumMinuten = aktuelleGruppe.reduce((s, e) => s + e.minuten, 0);
        gruppen.push({ gruppeId: gruppen.length + 1, orders: aktuelleGruppe, zeitersparnis: sumMinuten - maxMinuten });
      }
      stationenInGruppe.clear();
      stationenInGruppe.add(entry.station);
      aktuelleGruppe = [entry];
    }
  }
  if (aktuelleGruppe.length > 0) {
    const maxMinuten = Math.max(...aktuelleGruppe.map((e) => e.minuten));
    const sumMinuten = aktuelleGruppe.reduce((s, e) => s + e.minuten, 0);
    gruppen.push({ gruppeId: gruppen.length + 1, orders: aktuelleGruppe, zeitersparnis: sumMinuten - maxMinuten });
  }

  return gruppen;
}

export function KitchenPhase1049WarteschlangenOptimierer({ orders }: { orders: Order[] }) {
  const [open, setOpen] = useState(true);
  const gruppen = useMemo(() => buildParallelGruppen(orders), [orders]);

  const gesamtErsparnis = gruppen.reduce((s, g) => s + g.zeitersparnis, 0);

  if (gruppen.length === 0) return null;

  return (
    <div className="rounded-2xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Zap size={16} className="text-blue-600 dark:text-blue-400" />
          <span className="font-semibold text-blue-800 dark:text-blue-200 text-sm">
            Parallel-Optimierer — {gruppen.length} Gruppe{gruppen.length !== 1 ? 'n' : ''}
          </span>
          {gesamtErsparnis > 0 && (
            <span className="ml-2 rounded-full bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5">
              −{gesamtErsparnis} Min sparen
            </span>
          )}
        </div>
        {open ? <ChevronUp size={14} className="text-blue-500" /> : <ChevronDown size={14} className="text-blue-500" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {gruppen.map((gruppe) => (
            <div key={gruppe.gruppeId} className="rounded-xl border border-blue-100 dark:border-blue-800 bg-white dark:bg-blue-950/50 p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Layers size={12} className="text-blue-500" />
                <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wide">
                  Gruppe {gruppe.gruppeId} — Parallel starten
                </span>
                {gruppe.zeitersparnis > 0 && (
                  <span className="ml-auto flex items-center gap-1 text-[10px] font-semibold text-matcha-700 dark:text-matcha-300">
                    <Clock size={10} />
                    −{gruppe.zeitersparnis} Min
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {gruppe.orders.map((o) => (
                  <div
                    key={o.orderId}
                    className="flex items-center gap-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-700 px-2 py-1"
                  >
                    <span className="text-[10px] font-bold text-blue-800 dark:text-blue-200">#{o.bestellnummer}</span>
                    <span className="text-[10px] text-blue-500">→</span>
                    <span className="text-[10px] text-blue-700 dark:text-blue-300">{o.station}</span>
                    <span className={cn('text-[9px] font-semibold rounded px-1', 'bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300')}>
                      {o.minuten}m
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <p className="text-[10px] text-blue-400 dark:text-blue-500">
            Bestellungen in einer Gruppe können gleichzeitig gestartet werden — keine Station doppelt belegt.
          </p>
        </div>
      )}
    </div>
  );
}
