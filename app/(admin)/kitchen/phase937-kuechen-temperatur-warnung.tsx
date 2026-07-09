'use client';

import { useMemo, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Flame, AlertTriangle, ThermometerSun, Clock } from 'lucide-react';

/**
 * Phase 937 — Küchen-Temperatur-Warnung (Kitchen)
 *
 * Alert wenn heiße Artikel (Suppe/Auflauf/Pizza/etc.) länger als
 * HEAT_WARN_MIN in Zubereitung sind — Qualitätsverlust-Risiko.
 */

const HEAT_WARN_MIN = 25;
const HEAT_CRIT_MIN = 35;

const HEAT_KEYWORDS = [
  'suppe', 'eintopf', 'gulasch', 'brühe', 'bouillon',
  'auflauf', 'lasagne', 'pasta', 'nudeln', 'spaghetti',
  'pizza', 'flammkuchen', 'tarte',
  'curry', 'tajine', 'stew', 'ragout',
  'braten', 'ofengericht', 'ofengemüse',
  'fondue', 'raclette',
  'gratiniert', 'überbacken',
  'heiß', 'warm', 'geschmort', 'gebraten',
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
  bestellt_am?: string | null;
  geschaetzte_zubereitung_min?: number | null;
  items?: OrderItem[];
  artikel?: OrderItem[];
}

interface Props {
  orders: Order[];
}

function isHotOrder(order: Order): boolean {
  const items = (order.items ?? order.artikel ?? []) as OrderItem[];
  return items.some((it) => {
    const name = ((it.name ?? it.title) ?? '').toLowerCase();
    return HEAT_KEYWORDS.some((kw) => name.includes(kw));
  });
}

function getHotItems(order: Order): string[] {
  const items = (order.items ?? order.artikel ?? []) as OrderItem[];
  return items
    .filter((it) => {
      const name = ((it.name ?? it.title) ?? '').toLowerCase();
      return HEAT_KEYWORDS.some((kw) => name.includes(kw));
    })
    .map((it) => it.name ?? it.title ?? '')
    .filter(Boolean);
}

function minutenInZubereitung(order: Order): number {
  const start = order.zubereitung_start ?? order.started_at ?? order.bestellt_am;
  if (!start) return 0;
  return (Date.now() - new Date(start).getTime()) / 60_000;
}

export function KitchenPhase937KuechenTemperaturWarnung({ orders }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const alarms = useMemo(() => {
    return orders
      .filter((o) => o.status === 'in_zubereitung' && isHotOrder(o))
      .map((o) => ({ order: o, minuten: minutenInZubereitung(o), hotItems: getHotItems(o) }))
      .filter((a) => a.minuten >= HEAT_WARN_MIN)
      .sort((a, b) => b.minuten - a.minuten);
  }, [orders]);

  if (alarms.length === 0) return null;

  const kritisch = alarms.filter((a) => a.minuten >= HEAT_CRIT_MIN);
  const warnung = alarms.filter((a) => a.minuten < HEAT_CRIT_MIN);

  return (
    <div className={cn(
      'rounded-xl border overflow-hidden shadow-subtle',
      kritisch.length > 0
        ? 'border-red-200 bg-red-50'
        : 'border-amber-200 bg-amber-50',
    )}>
      {/* Header */}
      <div className={cn(
        'flex items-center justify-between px-4 py-2.5 border-b',
        kritisch.length > 0 ? 'border-red-200 bg-red-100' : 'border-amber-200 bg-amber-100',
      )}>
        <div className="flex items-center gap-2">
          <ThermometerSun className={cn('w-4 h-4', kritisch.length > 0 ? 'text-red-600 animate-pulse' : 'text-amber-600')} />
          <span className={cn('text-sm font-bold', kritisch.length > 0 ? 'text-red-800' : 'text-amber-800')}>
            Temperatur-Warnung
          </span>
          <span className={cn(
            'text-[10px] font-black px-2 py-0.5 rounded-full',
            kritisch.length > 0 ? 'bg-red-600 text-white' : 'bg-amber-500 text-white',
          )}>
            {alarms.length} Artikel-{alarms.length === 1 ? 'Bestellung' : 'Bestellungen'}
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs text-stone-500">
          <Flame className="w-3 h-3" />
          <span>Qualitätsverlust-Risiko</span>
        </div>
      </div>

      {/* Alarms */}
      <div className="divide-y divide-stone-100">
        {alarms.map(({ order, minuten, hotItems }) => {
          const isCrit = minuten >= HEAT_CRIT_MIN;
          const overMin = Math.round(minuten - HEAT_WARN_MIN);

          return (
            <div
              key={order.id}
              className={cn(
                'px-4 py-2.5 flex items-start gap-3',
                isCrit ? 'bg-red-50' : 'bg-amber-50',
              )}
            >
              <div className={cn(
                'shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
                isCrit ? 'bg-red-100' : 'bg-amber-100',
              )}>
                <AlertTriangle className={cn('w-4 h-4', isCrit ? 'text-red-600' : 'text-amber-600')} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn('text-sm font-bold', isCrit ? 'text-red-800' : 'text-amber-800')}>
                    #{order.bestellnummer ?? order.id.slice(0, 6)}
                  </span>
                  <span className={cn(
                    'text-[10px] font-black px-1.5 py-0.5 rounded',
                    isCrit ? 'bg-red-600 text-white' : 'bg-amber-500 text-white',
                  )}>
                    {isCrit ? 'KRITISCH' : 'WARNUNG'}
                  </span>
                </div>

                {hotItems.length > 0 && (
                  <div className="text-xs text-stone-600 mt-0.5 truncate">
                    🌡️ {hotItems.slice(0, 3).join(', ')}
                  </div>
                )}

                <div className={cn(
                  'flex items-center gap-1 mt-1 text-xs font-semibold',
                  isCrit ? 'text-red-700' : 'text-amber-700',
                )}>
                  <Clock className="w-3 h-3" />
                  <span>{Math.round(minuten)} Min in Zubereitung</span>
                  {overMin > 0 && (
                    <span className="text-[10px] font-bold">
                      ({overMin} Min über Limit)
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className={cn(
        'px-4 py-2 text-xs flex items-center justify-between border-t',
        kritisch.length > 0 ? 'border-red-200 bg-red-100/50 text-red-700' : 'border-amber-200 bg-amber-100/50 text-amber-700',
      )}>
        <span>⚡ Heiße Artikel sofort servieren — Qualität sinkt nach {HEAT_WARN_MIN} Min</span>
        {kritisch.length > 0 && (
          <span className="font-bold text-red-800">{kritisch.length}× kritisch ({HEAT_CRIT_MIN}+ Min)</span>
        )}
        {warnung.length > 0 && kritisch.length === 0 && (
          <span className="font-bold">{warnung.length}× Warnung</span>
        )}
      </div>
    </div>
  );
}
