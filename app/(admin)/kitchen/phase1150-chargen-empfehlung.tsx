'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Layers, Clock, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1150 — Chargen-Koch-Empfehlung (Kitchen)
// Artikel die ≥3× gleichzeitig in offenen Bestellungen auftauchen → Batch-Koch-Tipp + Zeitersparnis

type Item = { name?: string; title?: string; quantity?: number; menge?: number };
type Order = {
  id: string;
  bestellnummer?: string;
  status?: string;
  items?: Item[] | null;
};

interface Props {
  orders: Order[];
}

interface ChargeTipp {
  artikel: string;
  anzahl: number;
  bestellNummern: string[];
  zeitersparnis_min: number;
  station: string;
}

const ACTIVE_STATUSES = new Set([
  'pending', 'new', 'neu', 'confirmed', 'angenommen', 'accepted',
  'cooking', 'preparing', 'in_preparation', 'in_zubereitung',
]);

const STATION_KEYWORDS: Array<{ kw: string[]; station: string }> = [
  { kw: ['pizza', 'flammkuchen', 'calzone'], station: 'Ofen' },
  { kw: ['pommes', 'nuggets', 'friteuse', 'frites', 'wings'], station: 'Friteuse' },
  { kw: ['pasta', 'nudel', 'spaghetti', 'rigatoni', 'penne', 'fettuccine'], station: 'Pasta' },
  { kw: ['burger', 'patty', 'bbq'], station: 'Grill' },
  { kw: ['suppe', 'soup', 'chili', 'eintopf', 'ramen'], station: 'Suppe' },
  { kw: ['salat', 'salad', 'bowl', 'wrap'], station: 'Kalt' },
];

function detectStation(name: string): string {
  const lower = name.toLowerCase();
  for (const { kw, station } of STATION_KEYWORDS) {
    if (kw.some(k => lower.includes(k))) return station;
  }
  return 'Herd';
}

export function KitchenPhase1150ChargenEmpfehlung({ orders }: Props) {
  const [open, setOpen] = useState(false);

  const tipps = useMemo<ChargeTipp[]>(() => {
    const activeOrders = orders.filter(o => ACTIVE_STATUSES.has(o.status ?? ''));
    const artikelMap = new Map<string, { anzahl: number; bestellNummern: Set<string> }>();

    for (const order of activeOrders) {
      for (const item of order.items ?? []) {
        const name = (item.name ?? item.title ?? '').trim();
        if (!name) continue;
        const qty = item.quantity ?? item.menge ?? 1;
        const key = name.toLowerCase();
        const entry = artikelMap.get(key) ?? { anzahl: 0, bestellNummern: new Set() };
        entry.anzahl += qty;
        entry.bestellNummern.add(order.bestellnummer ?? order.id.slice(-4));
        artikelMap.set(key, entry);
      }
    }

    const result: ChargeTipp[] = [];
    for (const [key, { anzahl, bestellNummern }] of artikelMap.entries()) {
      if (anzahl < 3) continue;
      const displayName = [...artikelMap.keys()]
        .find(k => k === key) ?? key;
      const station = detectStation(displayName);
      const zeitersparnis = Math.round((anzahl - 1) * 3.5);
      result.push({
        artikel: key.charAt(0).toUpperCase() + key.slice(1),
        anzahl,
        bestellNummern: [...bestellNummern],
        zeitersparnis_min: zeitersparnis,
        station,
      });
    }
    return result.sort((a, b) => b.anzahl - a.anzahl);
  }, [orders]);

  if (tipps.length === 0) return null;

  const gesamtZeit = tipps.reduce((s, t) => s + t.zeitersparnis_min, 0);

  return (
    <div className="rounded-xl border border-teal-200 bg-teal-50 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-teal-100/60 transition"
      >
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-teal-600" />
          <span className="text-sm font-bold text-teal-800 uppercase tracking-wider">
            Chargen-Koch-Empfehlung
          </span>
          <span className="rounded-full bg-teal-600 text-white text-[10px] font-black px-2 py-0.5">
            {tipps.length} Artikel · {gesamtZeit} Min gespart
          </span>
        </div>
        {open
          ? <ChevronUp className="h-4 w-4 text-teal-600" />
          : <ChevronDown className="h-4 w-4 text-teal-600" />}
      </button>

      {open && (
        <div className="border-t border-teal-200 divide-y divide-teal-100">
          {tipps.map((t) => (
            <div key={t.artikel} className="px-4 py-3 flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-600 text-white text-xs font-black">
                ×{t.anzahl}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-teal-900 truncate">{t.artikel}</span>
                  <span className="text-[10px] rounded-full bg-teal-100 border border-teal-300 px-2 py-0.5 text-teal-700 font-bold">
                    {t.station}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-[11px] text-teal-600">
                    Bestellungen: {t.bestellNummern.slice(0, 4).join(', ')}{t.bestellNummern.length > 4 ? ` +${t.bestellNummern.length - 4}` : ''}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] font-bold text-teal-700">
                    <Zap className="h-3 w-3" />
                    {t.zeitersparnis_min} Min gespart
                  </span>
                </div>
              </div>
              <div className="shrink-0 flex items-center gap-1 text-teal-600">
                <Clock className="h-3.5 w-3.5" />
                <span className="text-[11px] font-bold">Jetzt chargen!</span>
              </div>
            </div>
          ))}
          <div className="px-4 py-2 bg-teal-100/50 flex items-center justify-between">
            <span className="text-[11px] text-teal-700">Gesamt-Zeitersparnis durch Chargen-Kochen:</span>
            <span className="text-sm font-black text-teal-800">~{gesamtZeit} Min</span>
          </div>
        </div>
      )}
    </div>
  );
}
