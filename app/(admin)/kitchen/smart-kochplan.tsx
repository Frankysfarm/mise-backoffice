'use client';

/**
 * KitchenSmartKochplan – "Was muss ich JETZT anfangen zu kochen?"
 *
 * Berechnet für alle bestätigten Bestellungen den optimalen Kochstart-Zeitpunkt,
 * so dass das Essen genau dann fertig ist, wenn der Fahrer eintrifft.
 *
 * Farbkodierung:
 *  🔴 Rot    → Hätte schon vor > 2 Min starten sollen (überfällig)
 *  🟠 Orange → Jetzt sofort starten
 *  🟡 Gelb   → In < 5 Min starten
 *  🟢 Grün   → Noch > 5 Min Zeit
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  AlertTriangle, ChefHat, Clock, Play, Zap,
} from 'lucide-react';

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

type Batch = {
  id: string;
  status: string;
  started_at: string | null;
  total_eta_min: number | null;
};

type Stop = {
  id: string;
  batch_id: string;
  order_id: string;
  geliefert_am: string | null;
};

type CookAction = {
  order: Order;
  startInSec: number;       // negative = already late
  driverArrivalSec: number | null;
  urgency: 'overdue' | 'now' | 'soon' | 'ok';
};

function useTick() {
  const [, setT] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setT(n => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);
}

function computeCookActions(
  orders: Order[],
  batches: Batch[],
  stops: Stop[],
): CookAction[] {
  const now = Date.now();

  const activeBatches = batches.filter(
    b => b.status === 'unterwegs' || b.status === 'on_route' || b.status === 'assigned' || b.status === 'pickup',
  );

  const batchEtaMap = new Map<string, number>(); // batch_id → eta_ms
  for (const b of activeBatches) {
    if (b.started_at && b.total_eta_min != null) {
      batchEtaMap.set(b.id, new Date(b.started_at).getTime() + b.total_eta_min * 60_000);
    }
  }

  const stopOrderMap = new Map<string, number>(); // order_id → driver_arrival_ms
  for (const s of stops.filter(s => !s.geliefert_am)) {
    const etaMs = batchEtaMap.get(s.batch_id);
    if (etaMs != null) stopOrderMap.set(s.order_id, etaMs);
  }

  const confirmed = orders.filter(o => o.status === 'bestätigt' && o.typ === 'lieferung');
  const actions: CookAction[] = [];

  for (const order of confirmed) {
    const prepSec = (order.geschaetzte_zubereitung_min ?? 15) * 60;
    const driverArrivalMs = stopOrderMap.get(order.id) ?? null;
    const driverArrivalSec = driverArrivalMs != null ? Math.floor((driverArrivalMs - now) / 1000) : null;

    let startInSec: number;
    if (driverArrivalSec != null) {
      // Start so that ready = driver arrival
      startInSec = driverArrivalSec - prepSec;
    } else {
      // No driver assigned yet: use order age + standard window
      const orderAgeMs = order.bestellt_am ? now - new Date(order.bestellt_am).getTime() : 0;
      startInSec = Math.max(-300, 5 * 60 - Math.floor(orderAgeMs / 1000));
    }

    const urgency: CookAction['urgency'] =
      startInSec < -120 ? 'overdue' :
      startInSec <= 60  ? 'now' :
      startInSec <= 300 ? 'soon' : 'ok';

    actions.push({ order, startInSec, driverArrivalSec, urgency });
  }

  return actions.sort((a, b) => a.startInSec - b.startInSec);
}

function CountdownChip({ sec }: { sec: number }) {
  useTick();
  const abs = Math.abs(sec);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const str = `${m}:${String(s).padStart(2, '0')}`;
  if (sec < -120) return (
    <span className="font-mono font-black text-xs text-red-600">+{str}</span>
  );
  if (sec <= 60) return (
    <span className="font-mono font-black text-xs text-orange-600 animate-pulse">JETZT</span>
  );
  return (
    <span className="font-mono font-black text-xs text-amber-700">in {str}</span>
  );
}

export function KitchenSmartKochplan({
  orders,
  batches,
  stops,
}: {
  orders: Order[];
  batches: Batch[];
  stops: Stop[];
}) {
  useTick();
  const actions = computeCookActions(orders, batches, stops);
  if (actions.length === 0) return null;

  const overdueCount = actions.filter(a => a.urgency === 'overdue').length;
  const nowCount     = actions.filter(a => a.urgency === 'now').length;
  const soonCount    = actions.filter(a => a.urgency === 'soon').length;
  const needsAttention = overdueCount + nowCount;

  return (
    <div className={cn(
      'rounded-xl border p-3 space-y-2 transition-all',
      needsAttention > 0
        ? 'border-orange-300 bg-orange-50 shadow-[0_0_12px_rgba(249,115,22,0.15)]'
        : 'border-border bg-card',
    )}>
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <ChefHat className="h-4 w-4 text-orange-500 shrink-0" />
        <span className="text-sm font-bold text-orange-800">Smart Kochplan</span>
        {overdueCount > 0 && (
          <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[10px] font-black animate-pulse">
            ⚠ {overdueCount} überfällig
          </span>
        )}
        {nowCount > 0 && (
          <span className="rounded-full bg-orange-100 text-orange-700 px-2 py-0.5 text-[10px] font-black">
            <Zap className="inline h-2.5 w-2.5 mr-0.5" />{nowCount} JETZT starten
          </span>
        )}
        {soonCount > 0 && !needsAttention && (
          <span className="rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[10px] font-bold">
            {soonCount} bald
          </span>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground">
          {actions.length} bestätigte Lieferbestellungen
        </span>
      </div>

      {/* Action rows */}
      <div className="space-y-1">
        {actions.slice(0, 6).map(({ order, startInSec, driverArrivalSec, urgency }) => {
          const rowBg =
            urgency === 'overdue' ? 'bg-red-50 border-red-200'
            : urgency === 'now'   ? 'bg-orange-50 border-orange-200'
            : urgency === 'soon'  ? 'bg-amber-50 border-amber-200'
            : 'bg-white border-stone-200';
          const icon =
            urgency === 'overdue' ? <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
            : urgency === 'now'   ? <Play className="h-3.5 w-3.5 text-orange-500 shrink-0" />
            : urgency === 'soon'  ? <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            : <Clock className="h-3.5 w-3.5 text-matcha-500 shrink-0" />;

          const topItems = order.items.slice(0, 2).map(i => `${i.menge}× ${i.name}`).join(', ');

          return (
            <div
              key={order.id}
              className={cn(
                'flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[11px]',
                rowBg,
              )}
            >
              {icon}
              <div className="flex-1 min-w-0">
                <span className="font-black text-stone-800">{order.bestellnummer}</span>
                <span className="text-stone-500 ml-1.5">{order.kunde_name}</span>
                {topItems && (
                  <div className="text-stone-400 truncate text-[9px]">{topItems}</div>
                )}
              </div>
              <div className="text-right shrink-0 space-y-0.5">
                <CountdownChip sec={startInSec} />
                {driverArrivalSec != null && (
                  <div className="text-[8px] text-stone-400">
                    Fahrer in {Math.ceil(driverArrivalSec / 60)} Min
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {actions.length > 6 && (
          <div className="text-center text-[10px] text-muted-foreground">
            +{actions.length - 6} weitere
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 text-[8px] text-muted-foreground flex-wrap border-t pt-1.5">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-400 inline-block" />Hätte schon begonnen</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-orange-400 inline-block" />Jetzt starten</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400 inline-block" />Bald starten</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-matcha-400 inline-block" />Zeit noch vorhanden</span>
      </div>
    </div>
  );
}
