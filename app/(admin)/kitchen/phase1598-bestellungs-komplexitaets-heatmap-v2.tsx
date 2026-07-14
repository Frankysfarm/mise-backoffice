'use client';

import React, { useMemo } from 'react';

interface OrderInput {
  id: string;
  status?: string | null;
  items?: { name?: string; sonderanfragen?: string; allergene?: string[] }[];
  sonderanfragen?: string | null;
  allergene?: string[] | null;
}

interface Props {
  orders: OrderInput[];
}

interface KomplexRow {
  id: string;
  itemCount: number;
  sonderanfragen: number;
  allergene: number;
  score: number;
  ampel: 'einfach' | 'mittel' | 'komplex';
  label: string;
}

const AMPEL_STYLE = {
  einfach: { bg: 'bg-emerald-50 border-emerald-200', badge: 'bg-emerald-100 text-emerald-700', label: 'Einfach' },
  mittel:  { bg: 'bg-amber-50 border-amber-200',     badge: 'bg-amber-100 text-amber-700',     label: 'Mittel' },
  komplex: { bg: 'bg-rose-50 border-rose-200',        badge: 'bg-rose-100 text-rose-700',       label: 'Komplex' },
};

function scoreLabel(items: number, sonder: number, allergen: number): { score: number; ampel: 'einfach' | 'mittel' | 'komplex' } {
  const score = items * 1 + sonder * 2 + allergen * 3;
  const ampel = score >= 10 ? 'komplex' : score >= 5 ? 'mittel' : 'einfach';
  return { score, ampel };
}

export function KitchenPhase1598BestellungsKomplexitaetsHeatmapV2({ orders }: Props) {
  const rows = useMemo<KomplexRow[]>(() => {
    const active = orders.filter((o) => o.status !== 'geliefert' && o.status !== 'storniert');
    return active.map((o) => {
      const itemCount = o.items?.length ?? 0;
      const sonder = o.items?.filter((i) => i.sonderanfragen && i.sonderanfragen.trim()).length
        ?? (o.sonderanfragen ? 1 : 0);
      const allergen = o.items?.reduce((a, i) => a + (i.allergene?.length ?? 0), 0)
        ?? (o.allergene?.length ?? 0);
      const { score, ampel } = scoreLabel(itemCount, sonder, allergen);
      const label = `${itemCount} Art.${sonder > 0 ? ` · ${sonder} Sonder` : ''}${allergen > 0 ? ` · ${allergen} Allergen` : ''}`;
      return { id: o.id, itemCount, sonderanfragen: sonder, allergene: allergen, score, ampel, label };
    }).sort((a, b) => b.score - a.score);
  }, [orders]);

  const komplex = rows.filter((r) => r.ampel === 'komplex').length;

  if (rows.length === 0) return null;

  return (
    <div className="rounded-2xl border border-matcha-200 bg-white overflow-hidden mb-4 shadow-sm">
      <div className="flex items-center gap-2 px-4 py-3 bg-matcha-700 text-white">
        <span className="text-sm font-bold uppercase tracking-wider flex-1">Bestellungs-Komplexität</span>
        {komplex > 0 && (
          <span className="text-xs bg-rose-500 rounded-full px-2 py-0.5 font-bold">{komplex} komplex</span>
        )}
        <span className="text-xs bg-white/20 rounded-full px-2 py-0.5">{rows.length} offen</span>
      </div>

      <div className="p-3 grid grid-cols-1 gap-2">
        {rows.map((r) => {
          const style = AMPEL_STYLE[r.ampel];
          const maxScore = Math.max(15, rows[0]?.score ?? 15);
          const barW = Math.round((r.score / maxScore) * 100);
          return (
            <div key={r.id} className={`rounded-xl border px-3 py-2 ${style.bg}`}>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-gray-400 shrink-0">#{r.id.slice(-4)}</span>
                <div className="flex-1 min-w-0">
                  <div className="h-2 rounded-full bg-white/60 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${r.ampel === 'komplex' ? 'bg-rose-400' : r.ampel === 'mittel' ? 'bg-amber-400' : 'bg-emerald-400'}`}
                      style={{ width: `${Math.max(8, barW)}%` }}
                    />
                  </div>
                </div>
                <span className={`text-[9px] font-bold rounded-full px-1.5 py-0.5 ${style.badge}`}>{style.label}</span>
                <span className="text-[10px] text-gray-500 shrink-0">{r.label}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-4 pb-3 flex gap-4 text-xs text-gray-400">
        <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />Einfach</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-amber-400" />Mittel</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-rose-400" />Komplex</span>
      </div>
    </div>
  );
}
