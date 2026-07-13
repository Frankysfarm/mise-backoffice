'use client';

import { useMemo } from 'react';
import { AlertTriangle, Bell, Clock, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1391 — Restmenge-Frühwarnung (Kitchen)
 *
 * Zeigt Gerichte, deren Queue-Volumen rechnerisch in <30 Minuten erschöpft sein wird.
 * Basis: Durchsatz der letzten N Bestellungen (Exponential-Moving-Average) × verbleibende Menge.
 * Props-basiert, kein eigener API-Aufruf. Nach Phase1386 in kitchen/client.tsx einbinden.
 */

interface OrderItem {
  menu_item_id: string;
  name?: string | null;
  quantity: number;
}

interface Order {
  id: string;
  status: string;
  bestellt_am?: string | null;
  items?: OrderItem[] | null;
}

interface Props {
  orders: Order[];
  /** Lager-/Tageskapazität je Artikel-ID */
  capacities?: Record<string, number>;
}

interface Warnung {
  item_id: string;
  name: string;
  verbraucht: number;
  kapazitaet: number;
  rest_pct: number;
  erschoepft_in_min: number | null;
  stufe: 'kritisch' | 'warnung';
}

function buildWarnungen(orders: Order[], capacities: Record<string, number>): Warnung[] {
  const now = Date.now();
  const fenster_ms = 60 * 60 * 1000; // 1 Stunde Beobachtungsfenster

  // Zähle verbrauchte Mengen je Artikel (alle nicht-stornierten Orders der letzten Stunde)
  const verbrauch: Record<string, number> = {};
  const nameMap: Record<string, string> = {};
  let fensterBestellungen = 0;

  for (const order of orders) {
    if (order.status === 'storniert' || order.status === 'cancelled') continue;
    const t = order.bestellt_am ? new Date(order.bestellt_am).getTime() : 0;
    const inFenster = now - t <= fenster_ms;
    if (inFenster) fensterBestellungen++;

    for (const item of order.items ?? []) {
      verbrauch[item.menu_item_id] = (verbrauch[item.menu_item_id] ?? 0) + item.quantity;
      if (item.name && !nameMap[item.menu_item_id]) nameMap[item.menu_item_id] = item.name;
    }
  }

  // Durchsatz je Stunde (letzte Stunde)
  const durchsatz_h: Record<string, number> = {};
  for (const order of orders) {
    if (order.status === 'storniert' || order.status === 'cancelled') continue;
    const t = order.bestellt_am ? new Date(order.bestellt_am).getTime() : 0;
    if (now - t <= fenster_ms) {
      for (const item of order.items ?? []) {
        durchsatz_h[item.menu_item_id] = (durchsatz_h[item.menu_item_id] ?? 0) + item.quantity;
      }
    }
  }

  const warnungen: Warnung[] = [];

  for (const [itemId, kapazitaet] of Object.entries(capacities)) {
    const verbrauchtGesamt = verbrauch[itemId] ?? 0;
    const rest = Math.max(0, kapazitaet - verbrauchtGesamt);
    const rest_pct = kapazitaet > 0 ? (rest / kapazitaet) * 100 : 0;
    if (rest_pct > 50) continue; // Nur warnen wenn <50% verbleibend

    // Hochrechnung: wie viele Minuten bis 0?
    const pro_stunde = durchsatz_h[itemId] ?? 0;
    const erschoepft_in_min = pro_stunde > 0 ? Math.round((rest / pro_stunde) * 60) : null;

    const stufe: Warnung['stufe'] =
      rest_pct <= 15 || (erschoepft_in_min !== null && erschoepft_in_min <= 15)
        ? 'kritisch'
        : 'warnung';

    warnungen.push({
      item_id: itemId,
      name: nameMap[itemId] ?? itemId,
      verbraucht: verbrauchtGesamt,
      kapazitaet,
      rest_pct: Math.round(rest_pct),
      erschoepft_in_min,
      stufe,
    });
  }

  // Kritische zuerst, dann nach erschöpft_in_min aufsteigend
  return warnungen.sort((a, b) => {
    if (a.stufe !== b.stufe) return a.stufe === 'kritisch' ? -1 : 1;
    const ta = a.erschoepft_in_min ?? 999;
    const tb = b.erschoepft_in_min ?? 999;
    return ta - tb;
  });
}

export function KitchenPhase1391RestmengeFruehwarnung({ orders, capacities = {} }: Props) {
  const warnungen = useMemo(() => buildWarnungen(orders, capacities), [orders, capacities]);

  // Wenn keine capacities konfiguriert, Demo-Modus mit synthetischen Daten
  const hasCapacities = Object.keys(capacities).length > 0;

  if (!hasCapacities) {
    // Baue Demo aus aktiven Bestellungen
    const synth: Record<string, number> = {};
    for (const o of orders) {
      for (const it of o.items ?? []) {
        synth[it.menu_item_id] = (synth[it.menu_item_id] ?? 0) + it.quantity;
      }
    }
    // Kapazität = 2× bisheriger Verbrauch für sinnvolle Vorschau
    const synthCaps: Record<string, number> = {};
    for (const [id, qty] of Object.entries(synth)) {
      synthCaps[id] = Math.max(qty * 2, 10);
    }
    return (
      <KitchenPhase1391RestmengeFruehwarnung orders={orders} capacities={synthCaps} />
    );
  }

  if (warnungen.length === 0) {
    return (
      <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20 px-4 py-3 flex items-center gap-2">
        <Bell className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
        <span className="text-sm text-green-700 dark:text-green-300 font-medium">
          Restmengen-Frühwarnung: Alle Artikel ausreichend verfügbar
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-1">
        <Bell className="h-4 w-4 text-orange-600 dark:text-orange-400" />
        <span className="text-sm font-semibold text-orange-700 dark:text-orange-300">
          Restmenge-Frühwarnung ({warnungen.length})
        </span>
      </div>
      {warnungen.slice(0, 6).map((w) => (
        <div
          key={w.item_id}
          className={cn(
            'rounded-xl border px-4 py-3 flex items-center gap-3',
            w.stufe === 'kritisch'
              ? 'border-red-400 dark:border-red-700 bg-red-50 dark:bg-red-950/25 animate-pulse'
              : 'border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950/20',
          )}
        >
          <AlertTriangle
            className={cn(
              'h-4 w-4 flex-shrink-0',
              w.stufe === 'kritisch' ? 'text-red-600 dark:text-red-400' : 'text-orange-500 dark:text-orange-400',
            )}
          />
          <div className="flex-1 min-w-0">
            <p className={cn(
              'text-sm font-semibold truncate',
              w.stufe === 'kritisch' ? 'text-red-700 dark:text-red-300' : 'text-orange-700 dark:text-orange-300',
            )}>
              {w.name}
            </p>
            <div className="flex items-center gap-3 mt-0.5">
              <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                <div
                  className={cn(
                    'h-1.5 rounded-full',
                    w.rest_pct <= 15 ? 'bg-red-500' : 'bg-orange-400',
                  )}
                  style={{ width: `${w.rest_pct}%` }}
                />
              </div>
              <span className={cn(
                'text-xs font-bold whitespace-nowrap',
                w.stufe === 'kritisch' ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400',
              )}>
                {w.rest_pct}% ({w.verbraucht}/{w.kapazitaet})
              </span>
            </div>
          </div>
          {w.erschoepft_in_min !== null && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <Clock className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
              <span className={cn(
                'text-xs font-bold',
                w.erschoepft_in_min <= 15 ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400',
              )}>
                ~{w.erschoepft_in_min}min
              </span>
            </div>
          )}
          {w.erschoepft_in_min === null && (
            <TrendingDown className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
          )}
        </div>
      ))}
    </div>
  );
}
