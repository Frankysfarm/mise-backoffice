'use client';

/**
 * KochstartAlertBand — Prominentes Alert-Band wenn Bestellungen JETZT kochen müssen.
 * Berechnet Cook-Start basierend auf Driver-ETA und Restzeit vs. Zubereitungszeit.
 * Zeigt roten Alert wenn cook_start_at überschritten oder in <2 Min.
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, ChefHat, Clock, Flame, Timer, Zap } from 'lucide-react';

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  typ: string;
  kunde_name: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  items: { name: string; menge: number }[];
};

type KitchenTiming = {
  id: string;
  order_id: string;
  cook_start_at: string | null;
  ready_target: string | null;
  prep_min: number | null;
  status: string;
};

type CookAlert = {
  orderId: string;
  bestellnummer: string;
  customerName: string;
  secsUntilCookStart: number; // negative = overdue
  prepMin: number;
  readyTarget: string | null;
};

function useTick() {
  const [, setT] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setT(n => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);
}

function fmtCountdown(secs: number): string {
  const abs = Math.abs(secs);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function KochstartAlertBand({
  orders,
  timings,
}: {
  orders: Order[];
  timings: KitchenTiming[];
}) {
  useTick();

  const now = Date.now();
  const WARN_SECS = 120; // 2 Minuten Vorwarnung

  // Finde alle Bestellungen die laut kitchen_timings bald kochen müssen (scheduled)
  const alerts: CookAlert[] = [];
  for (const t of timings) {
    if (t.status !== 'scheduled' && t.status !== 'cooking') continue;
    const order = orders.find(o => o.id === t.order_id);
    if (!order) continue;
    if (!['bestätigt', 'in_zubereitung'].includes(order.status)) continue;

    if (t.cook_start_at) {
      const cookStartMs = new Date(t.cook_start_at).getTime();
      const secs = Math.floor((cookStartMs - now) / 1000);
      // Nur anzeigen wenn innerhalb 2 Min Vorwarnung oder überfällig
      if (secs <= WARN_SECS) {
        alerts.push({
          orderId: order.id,
          bestellnummer: order.bestellnummer,
          customerName: order.kunde_name,
          secsUntilCookStart: secs,
          prepMin: t.prep_min ?? order.geschaetzte_zubereitung_min ?? 15,
          readyTarget: t.ready_target,
        });
      }
    }
  }

  // Auch Bestellungen ohne Timing aber überfällig (in_zubereitung aber kein Timing)
  const untrackedLate: CookAlert[] = orders
    .filter(o => {
      if (o.status !== 'in_zubereitung') return false;
      if (timings.some(t => t.order_id === o.id)) return false;
      if (!o.bestellt_am) return false;
      const prepMs = (o.geschaetzte_zubereitung_min ?? 15) * 60_000;
      const elapsed = now - new Date(o.bestellt_am).getTime();
      return elapsed > prepMs; // Zubereitungszeit überschritten
    })
    .map(o => {
      const prepMs = (o.geschaetzte_zubereitung_min ?? 15) * 60_000;
      const elapsed = now - new Date(o.bestellt_am!).getTime();
      return {
        orderId: o.id,
        bestellnummer: o.bestellnummer,
        customerName: o.kunde_name,
        secsUntilCookStart: -Math.floor((elapsed - prepMs) / 1000), // negativ = überfällig
        prepMin: o.geschaetzte_zubereitung_min ?? 15,
        readyTarget: null,
      };
    });

  const allAlerts = [...alerts, ...untrackedLate].sort((a, b) => a.secsUntilCookStart - b.secsUntilCookStart);
  if (allAlerts.length === 0) return null;

  const criticalCount = allAlerts.filter(a => a.secsUntilCookStart <= 0).length;
  const warnCount = allAlerts.filter(a => a.secsUntilCookStart > 0).length;

  return (
    <div className={cn(
      'rounded-xl border-2 px-4 py-3 space-y-2',
      criticalCount > 0
        ? 'border-red-500 bg-red-50 animate-pulse'
        : 'border-orange-400 bg-orange-50',
    )}>
      {/* Header */}
      <div className="flex items-center gap-2">
        {criticalCount > 0
          ? <Flame className="h-5 w-5 text-red-600 shrink-0" />
          : <Timer className="h-5 w-5 text-orange-600 shrink-0" />
        }
        <span className={cn(
          'text-sm font-black uppercase tracking-wide',
          criticalCount > 0 ? 'text-red-800' : 'text-orange-800',
        )}>
          {criticalCount > 0
            ? `${criticalCount} Bestellung${criticalCount > 1 ? 'en' : ''} SOFORT kochen!`
            : `${warnCount} Bestellung${warnCount > 1 ? 'en' : ''} in <2 Min starten`
          }
        </span>
      </div>

      {/* Alert rows */}
      <div className="flex flex-wrap gap-2">
        {allAlerts.map(alert => {
          const isOverdue = alert.secsUntilCookStart <= 0;
          const isUrgent = alert.secsUntilCookStart <= 30;
          return (
            <div
              key={alert.orderId}
              className={cn(
                'flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs',
                isOverdue
                  ? 'border-red-400 bg-red-100 text-red-900'
                  : isUrgent
                  ? 'border-orange-400 bg-orange-100 text-orange-900'
                  : 'border-amber-300 bg-amber-50 text-amber-900',
              )}
            >
              <ChefHat className="h-3.5 w-3.5 shrink-0" />
              <span className="font-bold">#{alert.bestellnummer}</span>
              <span className="opacity-75 max-w-[100px] truncate">{alert.customerName}</span>
              <span className={cn('font-black tabular-nums ml-1', isOverdue ? 'text-red-700' : 'text-orange-700')}>
                {isOverdue
                  ? `+${fmtCountdown(-alert.secsUntilCookStart)} überfällig`
                  : `in ${fmtCountdown(alert.secsUntilCookStart)}`
                }
              </span>
              <span className="opacity-60 text-[9px]">· {alert.prepMin} Min Zubereitung</span>
              {alert.readyTarget && (
                <span className="opacity-60 text-[9px]">
                  · Fertig {new Date(alert.readyTarget).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
