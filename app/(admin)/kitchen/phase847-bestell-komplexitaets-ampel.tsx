'use client';

import { useEffect, useState } from 'react';
import { Flame, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

type Order = {
  id: string;
  items?: Array<{ quantity?: number; extras?: unknown }>;
};

interface ComplexityData {
  score: number; // 0–100
  ampel: 'gruen' | 'amber' | 'rot';
  gesamt_items: number;
  gesamt_extras: number;
  grosse_mengen: number; // items mit qty >= 3
  label: string;
}

function computeComplexity(orders: Order[]): ComplexityData {
  let totalItems = 0;
  let totalExtras = 0;
  let grosseMengen = 0;

  for (const o of orders) {
    for (const item of o.items ?? []) {
      const qty = item.quantity ?? 1;
      totalItems += qty;
      totalExtras += ((item.extras as unknown[]) ?? []).length * qty;
      if (qty >= 3) grosseMengen++;
    }
  }

  const n = orders.length || 1;
  const avgItemsPerOrder = totalItems / n;
  const avgExtrasPerItem = totalItems > 0 ? totalExtras / totalItems : 0;
  const grossenAnteil = totalItems > 0 ? grosseMengen / totalItems : 0;

  // Score 0–100: gewichtete Summe
  const score = Math.min(100, Math.round(
    avgItemsPerOrder * 8 +
    avgExtrasPerItem * 15 +
    grossenAnteil * 30 +
    n * 0.5,
  ));

  const ampel: 'gruen' | 'amber' | 'rot' = score < 35 ? 'gruen' : score < 65 ? 'amber' : 'rot';
  const label = ampel === 'gruen' ? 'Einfach' : ampel === 'amber' ? 'Mittel' : 'Komplex';

  return { score, ampel, gesamt_items: totalItems, gesamt_extras: totalExtras, grosse_mengen: grosseMengen, label };
}

const ampelStyles = {
  gruen: { ring: 'border-matcha-400 bg-matcha-50', dot: 'bg-matcha-500', text: 'text-matcha-700', bar: 'bg-matcha-500' },
  amber: { ring: 'border-amber-400 bg-amber-50', dot: 'bg-amber-500', text: 'text-amber-700', bar: 'bg-amber-500' },
  rot: { ring: 'border-red-400 bg-red-50', dot: 'bg-red-500', text: 'text-red-700', bar: 'bg-red-500' },
};

export function KitchenPhase847BestellKomplexitaetsAmpel({ orders }: { orders: Order[] }) {
  const [data, setData] = useState<ComplexityData | null>(null);

  useEffect(() => {
    setData(computeComplexity(orders));
  }, [orders]);

  if (!data) return null;

  const s = ampelStyles[data.ampel];

  return (
    <div className={cn('rounded-2xl border-2 px-5 py-4 space-y-3 transition-colors duration-500', s.ring)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Layers className={cn('h-4 w-4', s.text)} />
          <span className="text-sm font-bold text-stone-800">Bestellungs-Komplexität</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={cn('h-2.5 w-2.5 rounded-full animate-pulse', s.dot)} />
          <span className={cn('text-sm font-black uppercase tracking-wide', s.text)}>{data.label}</span>
        </div>
      </div>

      {/* Score-Balken */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] text-stone-500">
          <span>Einfach</span>
          <span className={cn('font-black text-base tabular-nums', s.text)}>{data.score}</span>
          <span>Komplex</span>
        </div>
        <div className="h-3 rounded-full bg-stone-100 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-700', s.bar)}
            style={{ width: `${data.score}%` }}
          />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Artikel', value: data.gesamt_items },
          { label: 'Extras', value: data.gesamt_extras },
          { label: 'Großmengen', value: data.grosse_mengen },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-lg bg-white/60 border border-stone-200 px-3 py-2 text-center">
            <div className="text-[10px] text-stone-500 font-medium">{kpi.label}</div>
            <div className="text-base font-black tabular-nums text-stone-800">{kpi.value}</div>
          </div>
        ))}
      </div>

      {data.ampel === 'rot' && (
        <div className="flex items-center gap-2 rounded-lg bg-red-100 border border-red-300 px-3 py-2 text-[11px] font-bold text-red-700">
          <Flame className="h-3.5 w-3.5 shrink-0" />
          Hohe Küchen-Last! Mehr Personal einplanen oder Bestellannahme drosseln.
        </div>
      )}
    </div>
  );
}
