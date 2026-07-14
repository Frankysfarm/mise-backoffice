'use client';

import React, { useMemo } from 'react';

interface Order {
  id: string;
  bestellnummer?: string | null;
  status?: string | null;
  bestellt_am?: string | null;
  voraussichtliche_kochzeit?: number | null;
  lieferzeit?: string | null;
  items?: Array<{ name?: string; menge?: number }> | null;
  sonderwunsch?: string | null;
  prioritaet?: string | null;
}

interface Props {
  orders: Order[];
}

type Prioritaet = 'asap' | 'vorab' | 'standard';

function getPrioritaet(order: Order): Prioritaet {
  if (order.prioritaet === 'asap') return 'asap';
  if (order.lieferzeit) {
    const diffMin = (new Date(order.lieferzeit).getTime() - Date.now()) / 60_000;
    if (diffMin < 20) return 'asap';
    if (diffMin < 45) return 'vorab';
  }
  return 'standard';
}

function getKomplexitaet(order: Order): number {
  const itemCount = (order.items ?? []).reduce((s, i) => s + (i.menge ?? 1), 0);
  const sonder = order.sonderwunsch ? 1 : 0;
  return itemCount + sonder;
}

function elapsedMin(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
}

const PRIO_META: Record<Prioritaet, { label: string; bg: string; text: string; badge: string; border: string }> = {
  asap:     { label: 'ASAP',     bg: 'bg-red-50',     text: 'text-red-700',     badge: 'bg-red-600 text-white',     border: 'border-red-300'   },
  vorab:    { label: 'Zeitnah',  bg: 'bg-amber-50',   text: 'text-amber-700',   badge: 'bg-amber-500 text-white',   border: 'border-amber-300' },
  standard: { label: 'Standard', bg: 'bg-stone-50',   text: 'text-stone-600',   badge: 'bg-stone-400 text-white',   border: 'border-stone-200' },
};

function ampelColor(order: Order): string {
  const ziel = (order.voraussichtliche_kochzeit ?? 20);
  if (!order.bestellt_am) return 'bg-stone-300';
  const elapsed = elapsedMin(order.bestellt_am);
  const ratio = elapsed / ziel;
  if (ratio < 0.6) return 'bg-emerald-500';
  if (ratio < 0.85) return 'bg-amber-400';
  if (ratio < 1.0) return 'bg-orange-500';
  return 'bg-red-600';
}

const ACTIVE_STATUS = new Set(['neu', 'bestätigt', 'in_zubereitung']);

export function KitchenPhase1618PrioritaetsWarteschlangenKarte({ orders }: Props) {
  const sorted = useMemo(() => {
    return orders
      .filter((o) => o.status && ACTIVE_STATUS.has(o.status))
      .map((o) => ({ ...o, prio: getPrioritaet(o), kompl: getKomplexitaet(o) }))
      .sort((a, b) => {
        const prioOrder: Record<Prioritaet, number> = { asap: 0, vorab: 1, standard: 2 };
        if (prioOrder[a.prio] !== prioOrder[b.prio]) return prioOrder[a.prio] - prioOrder[b.prio];
        const etaA = a.lieferzeit ? new Date(a.lieferzeit).getTime() : Infinity;
        const etaB = b.lieferzeit ? new Date(b.lieferzeit).getTime() : Infinity;
        if (etaA !== etaB) return etaA - etaB;
        return b.kompl - a.kompl;
      });
  }, [orders]);

  if (sorted.length === 0) return null;

  const counts: Record<Prioritaet, number> = { asap: 0, vorab: 0, standard: 0 };
  sorted.forEach((o) => { counts[o.prio]++; });

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden shadow-sm mb-4">
      <div className="flex items-center gap-3 px-4 py-3 bg-red-700 text-white">
        <span className="text-sm font-bold uppercase tracking-wider flex-1">Prioritäts-Warteschlange</span>
        <span className="text-xs bg-white/20 rounded-full px-2 py-0.5">{sorted.length} offen</span>
      </div>

      {/* Zusammenfassung */}
      <div className="flex gap-2 px-4 pt-3 pb-1 flex-wrap">
        {(['asap', 'vorab', 'standard'] as Prioritaet[]).map((p) => counts[p] > 0 && (
          <span key={p} className={`rounded-full px-3 py-0.5 text-xs font-bold ${PRIO_META[p].badge}`}>
            {counts[p]}× {PRIO_META[p].label}
          </span>
        ))}
      </div>

      {/* Liste */}
      <div className="divide-y divide-stone-50 px-2 pb-2">
        {sorted.slice(0, 10).map((order) => {
          const m = PRIO_META[order.prio];
          const elapsed = order.bestellt_am ? elapsedMin(order.bestellt_am) : null;
          const ampel = ampelColor(order);
          return (
            <div key={order.id} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 my-1 border ${m.bg} ${m.border}`}>
              <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${ampel}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold tabular-nums ${m.text}`}>
                    #{order.bestellnummer ?? order.id.slice(-4)}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-black ${m.badge}`}>
                    {m.label}
                  </span>
                </div>
                <div className="text-[10px] text-stone-500 mt-0.5">
                  {order.kompl} Position{order.kompl !== 1 ? 'en' : ''}
                  {order.sonderwunsch ? ' · Sonderwunsch' : ''}
                  {order.lieferzeit ? ` · Lieferziel ${new Date(order.lieferzeit).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}` : ''}
                </div>
              </div>
              {elapsed !== null && (
                <div className="shrink-0 text-right">
                  <div className={`font-mono text-sm font-black tabular-nums ${elapsed > (order.voraussichtliche_kochzeit ?? 20) ? 'text-red-600' : 'text-stone-700'}`}>
                    {elapsed}m
                  </div>
                  <div className="text-[8px] text-stone-400">vergangen</div>
                </div>
              )}
            </div>
          );
        })}
        {sorted.length > 10 && (
          <div className="text-center text-xs text-stone-400 py-2">+{sorted.length - 10} weitere</div>
        )}
      </div>
    </div>
  );
}
