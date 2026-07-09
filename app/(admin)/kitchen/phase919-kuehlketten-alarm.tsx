'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Thermometer, AlertTriangle } from 'lucide-react';

/**
 * Phase 919 — Kühlketten-Alarm-Widget (Kitchen)
 *
 * Warnt wenn Bestellungen mit Kühlpflichtigen Artikeln länger als
 * KUEHL_LIMIT_MIN Minuten in Zubereitung sind. Client-seitig.
 */

const KUEHL_LIMIT_MIN = 20;

const KUEHL_KEYWORDS = [
  'joghurt', 'quark', 'sahne', 'butter', 'käse', 'milch',
  'lachs', 'thunfisch', 'fisch', 'shrimps', 'garnelen',
  'eis', 'eiscreme', 'sorbet', 'frozen', 'tiefkühl',
  'ei ', 'eier', 'roh', 'sashimi', 'tartare',
];

interface OrderItem {
  name?: string | null;
  title?: string | null;
}

interface Order {
  id: string;
  bestellnummer?: string | null;
  status: string;
  zubereitung_start?: string | null;
  started_at?: string | null;
  items?: OrderItem[];
  artikel?: OrderItem[];
}

interface Props {
  orders: Order[];
}

function isKuehlpflichtig(order: Order): boolean {
  const items = (order.items ?? order.artikel ?? []) as OrderItem[];
  return items.some((it) => {
    const name = ((it.name ?? it.title) ?? '').toLowerCase();
    return KUEHL_KEYWORDS.some((kw) => name.includes(kw));
  });
}

function minutenInZubereitung(order: Order): number {
  const start = order.zubereitung_start ?? order.started_at;
  if (!start) return 0;
  return (Date.now() - new Date(start).getTime()) / 60000;
}

export function KitchenPhase919KuehlkettenAlarm({ orders }: Props) {
  const alarms = useMemo(() => {
    return orders
      .filter((o) => o.status === 'in_zubereitung' && isKuehlpflichtig(o))
      .map((o) => ({ order: o, minuten: minutenInZubereitung(o) }))
      .filter(({ minuten }) => minuten >= KUEHL_LIMIT_MIN)
      .sort((a, b) => b.minuten - a.minuten);
  }, [orders]);

  if (alarms.length === 0) return null;

  const critical = alarms.filter(({ minuten }) => minuten >= 30);
  const warn = alarms.filter(({ minuten }) => minuten >= KUEHL_LIMIT_MIN && minuten < 30);

  return (
    <div className={cn(
      'rounded-2xl border-2 overflow-hidden',
      critical.length > 0 ? 'border-red-400 bg-red-50' : 'border-amber-300 bg-amber-50',
    )}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className={cn(
          'flex h-9 w-9 items-center justify-center rounded-full shrink-0',
          critical.length > 0 ? 'bg-red-100' : 'bg-amber-100',
        )}>
          <Thermometer className={cn(
            'h-5 w-5',
            critical.length > 0 ? 'text-red-600 animate-pulse' : 'text-amber-600',
          )} />
        </div>
        <div className="flex-1">
          <div className={cn(
            'text-xs font-black',
            critical.length > 0 ? 'text-red-800' : 'text-amber-800',
          )}>
            {critical.length > 0 ? 'KÜHLKETTE KRITISCH' : 'Kühlketten-Warnung'}
          </div>
          <div className="text-[10px] text-stone-500">
            {alarms.length} Bestellung{alarms.length > 1 ? 'en' : ''} mit Kühlpflicht überschreiten {KUEHL_LIMIT_MIN} Min
          </div>
        </div>
        <AlertTriangle className={cn(
          'h-4 w-4 shrink-0',
          critical.length > 0 ? 'text-red-500 animate-pulse' : 'text-amber-500',
        )} />
      </div>

      {/* Alarm list */}
      <div className="px-4 pb-3 space-y-1.5">
        {alarms.map(({ order, minuten }) => {
          const isCrit = minuten >= 30;
          return (
            <div
              key={order.id}
              className={cn(
                'flex items-center justify-between rounded-xl px-3 py-2',
                isCrit ? 'bg-red-100 border border-red-200' : 'bg-amber-100 border border-amber-200',
              )}
            >
              <div className="flex items-center gap-2">
                <Thermometer className={cn('h-3.5 w-3.5', isCrit ? 'text-red-600' : 'text-amber-600')} />
                <span className="text-[11px] font-bold text-stone-700">
                  #{order.bestellnummer ?? order.id.slice(0, 6)}
                </span>
              </div>
              <span className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-black',
                isCrit
                  ? 'bg-red-200 text-red-800'
                  : 'bg-amber-200 text-amber-800',
              )}>
                {Math.round(minuten)} Min
              </span>
            </div>
          );
        })}

        {/* Empfehlung */}
        <div className={cn(
          'mt-2 rounded-lg px-3 py-2 text-[10px] font-semibold',
          critical.length > 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700',
        )}>
          {critical.length > 0
            ? 'Sofortmaßnahme: Kühlware sofort fertigstellen oder kühlen — Qualitätsrisiko!'
            : `Empfehlung: Kühlpflichtige Bestellungen priorisieren (>${KUEHL_LIMIT_MIN} Min Grenzwert)`}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 mt-2">
          {warn.length > 0 && (
            <div className="rounded-xl bg-amber-100 border border-amber-200 py-2 flex flex-col items-center">
              <span className="text-sm font-black text-amber-700">{warn.length}</span>
              <span className="text-[8px] text-amber-600 font-semibold">Warnung (20–30 Min)</span>
            </div>
          )}
          {critical.length > 0 && (
            <div className="rounded-xl bg-red-100 border border-red-200 py-2 flex flex-col items-center">
              <span className="text-sm font-black text-red-700">{critical.length}</span>
              <span className="text-[8px] text-red-600 font-semibold">Kritisch (&gt;30 Min)</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
