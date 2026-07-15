'use client';

import React, { useMemo } from 'react';

interface OrderItem {
  name?: string | null;
  menge?: number | null;
}

interface Order {
  id: string;
  status?: string | null;
  reklamation_grund?: string | null;
  reklamiert?: boolean | null;
  items?: OrderItem[] | null;
}

interface Props {
  orders: Order[];
}

type Ampel = 'ok' | 'achtung' | 'kritisch';

function ampelMeta(rate: number): { label: string; bg: string; text: string; border: string; bar: string } {
  if (rate >= 15) return { label: 'Kritisch', bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-300',    bar: 'bg-red-500'    };
  if (rate >= 7)  return { label: 'Achtung',  bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-300',  bar: 'bg-amber-400'  };
  return              { label: 'OK',       bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-300', bar: 'bg-emerald-500' };
}

interface ProduktRow {
  name: string;
  gesamt: number;
  reklamiert: number;
  rate: number;
  ampel: Ampel;
}

export function KitchenPhase1623ProduktFehlerquoteKarte({ orders }: Props) {
  const produkte = useMemo(() => {
    const map: Record<string, { gesamt: number; reklamiert: number }> = {};

    for (const order of orders) {
      const istReklamiert = order.reklamiert === true ||
        (typeof order.status === 'string' && order.status.includes('rekla'));

      for (const item of order.items ?? []) {
        const name = item.name?.trim();
        if (!name) continue;
        const menge = item.menge ?? 1;
        if (!map[name]) map[name] = { gesamt: 0, reklamiert: 0 };
        map[name].gesamt += menge;
        if (istReklamiert) map[name].reklamiert += menge;
      }
    }

    return Object.entries(map)
      .map(([name, d]): ProduktRow => {
        const rate = d.gesamt > 0 ? Math.round((d.reklamiert / d.gesamt) * 1000) / 10 : 0;
        const ampel: Ampel = rate >= 15 ? 'kritisch' : rate >= 7 ? 'achtung' : 'ok';
        return { name, gesamt: d.gesamt, reklamiert: d.reklamiert, rate, ampel };
      })
      .filter((p) => p.gesamt >= 3)
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 12);
  }, [orders]);

  const kritisch = produkte.filter((p) => p.ampel === 'kritisch').length;
  const achtung  = produkte.filter((p) => p.ampel === 'achtung').length;

  if (produkte.length === 0) return null;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden shadow-sm mb-4">
      <div className="flex items-center gap-3 px-4 py-3 bg-rose-700 text-white">
        <span className="text-sm font-bold uppercase tracking-wider flex-1">Produkt-Fehlerquote</span>
        <div className="flex items-center gap-2 text-xs">
          {kritisch > 0 && <span className="bg-red-500 rounded-full px-2 py-0.5">{kritisch}× Kritisch</span>}
          {achtung  > 0 && <span className="bg-amber-400 text-amber-900 rounded-full px-2 py-0.5">{achtung}× Achtung</span>}
        </div>
      </div>

      <div className="divide-y divide-stone-50 p-3 space-y-1">
        {produkte.map((p) => {
          const m = ampelMeta(p.rate);
          const barW = Math.min(100, p.rate * 4);
          return (
            <div key={p.name} className={`flex items-center gap-3 rounded-xl px-3 py-2 border ${m.bg} ${m.border}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-stone-800 truncate">{p.name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-black ${m.text} ${m.bg} border ${m.border}`}>
                    {m.label}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-black/10 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${m.bar}`}
                    style={{ width: `${barW}%` }}
                  />
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className={`font-mono text-sm font-black tabular-nums ${m.text}`}>
                  {p.rate.toFixed(1)}%
                </div>
                <div className="text-[9px] text-stone-400">{p.reklamiert}/{p.gesamt}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
