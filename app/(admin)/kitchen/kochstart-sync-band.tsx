'use client';

/**
 * KochstartSyncBand — Zeigt ankommende Fahrer und welche Bestellungen JETZT
 * gestartet werden müssen, damit sie rechtzeitig fertig sind.
 *
 * GRÜN  = Genug Zeit (>5 Min Puffer)
 * AMBER = Knapp (0–5 Min Puffer)
 * ROT   = Überfällig (Kochstart hätte schon sein sollen)
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, Bike, ChefHat, CheckCircle2, Clock, Zap } from 'lucide-react';

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  typ: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
};

type KitchenTiming = {
  id: string;
  order_id: string;
  cook_start_at: string | null;
  ready_target: string | null;
  prep_min: number | null;
  status: string;
};

type Driver = {
  id: string;
  vorname: string;
  nachname: string;
  status: {
    ist_online: boolean;
    aktueller_batch_id: string | null;
    last_update: string | null;
    online_seit: string | null;
  } | null;
};

type Batch = {
  id: string;
  driver_id: string;
  status: string;
  started_at: string | null;
  total_eta_min: number | null;
};

type Stop = {
  id: string;
  batch_id: string;
  order_id: string;
  reihenfolge: number;
  angekommen_am: string | null;
  geliefert_am: string | null;
};

type Props = {
  orders: Order[];
  timings: KitchenTiming[];
  drivers: Driver[];
  batches: Batch[];
  stops: Stop[];
};

// Wie viele Minuten sind noch übrig, bis der Fahrer zurück in der Küche ist?
function computeDriverEtaMin(batch: Batch, stops: Stop[]): number | null {
  if (!batch.started_at || batch.total_eta_min == null) return null;

  const startedMs = new Date(batch.started_at).getTime();
  const totalMs = batch.total_eta_min * 60_000;
  const endMs = startedMs + totalMs;

  // Noch nicht gelieferte Stops zählen als "unterwegs"
  const pendingStops = stops.filter(
    s => s.batch_id === batch.id && !s.geliefert_am,
  );

  if (pendingStops.length === 0) return null; // Alle geliefert — Fahrer kommt bald zurück

  // Schätze Zeit bis zurück: linear restliche ETA
  const nowMs = Date.now();
  const elapsedMs = nowMs - startedMs;
  const fractionDone = Math.min(1, elapsedMs / totalMs);

  // Grobe Schätzung: verbleibende Tour-Dauer + Rückweg (50% der restlichen Zeit)
  const remainingRouteMs = totalMs - elapsedMs;
  // Anteil pendingStops am Gesamten als Gewichtung
  const allStops = stops.filter(s => s.batch_id === batch.id);
  const pendingFraction =
    allStops.length > 0 ? pendingStops.length / allStops.length : 0.5;
  const estimatedReturnMs = remainingRouteMs * (1 + pendingFraction * 0.5);

  const etaMin = Math.round(estimatedReturnMs / 60_000);
  return Math.max(0, etaMin);
}

type CookNowItem = {
  order: Order;
  prepMin: number;
  driverEtaMin: number;
  pufferMin: number; // negativ = überfällig
  driverName: string;
  batchId: string;
};

function fmtTime(secs: number): string {
  const abs = Math.abs(secs);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function urgencyFromPuffer(pufferMin: number): 'green' | 'amber' | 'red' {
  if (pufferMin > 5) return 'green';
  if (pufferMin >= 0) return 'amber';
  return 'red';
}

function useTick() {
  const [, setT] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setT(n => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);
}

export function KochstartSyncBand({ orders, timings, drivers, batches, stops }: Props) {
  useTick();

  const now = Date.now();

  // Schritt 1: Fahrer die UNTERWEGS sind (noch aktive Stops im Batch)
  const activeBatches = batches.filter(b =>
    b.status === 'unterwegs' || b.status === 'on_route',
  );

  // Schritt 2: Nicht-zugewiesene bestätigte Bestellungen die noch nicht kochen
  const pendingOrders = orders.filter(o => {
    if (o.status !== 'bestätigt') return false;
    // Hat keine aktive cooking-Timing
    const timing = timings.find(t => t.order_id === o.id);
    if (timing && (timing.status === 'cooking' || timing.status === 'fertig')) return false;
    return true;
  });

  // Schritt 3: Für jeden aktiven Batch, berechne Fahrer-ETA und welche Orders gestartet werden müssen
  const cookNowItems: CookNowItem[] = [];

  for (const batch of activeBatches) {
    const batchStops = stops.filter(s => s.batch_id === batch.id);
    const pendingStops = batchStops.filter(s => !s.geliefert_am);
    if (pendingStops.length === 0) continue; // Alle geliefert → ignorieren

    const driverEtaMin = computeDriverEtaMin(batch, stops);
    if (driverEtaMin == null) continue;

    const driver = drivers.find(d => d.id === batch.driver_id);
    const driverName = driver
      ? `${driver.vorname} ${driver.nachname}`.trim()
      : 'Unbekannter Fahrer';

    // Welche bestätigten Orders sollten für diese Tour gekocht werden?
    // Wir nehmen Bestellungen die keinem aktiven Batch-Stop zugewiesen sind
    for (const order of pendingOrders) {
      const prepMin =
        timings.find(t => t.order_id === order.id)?.prep_min ??
        order.geschaetzte_zubereitung_min ??
        15;

      // Kochstart nötig wenn Zubereitungszeit > verbleibende Fahrer-ETA
      const pufferMin = driverEtaMin - prepMin;

      // Nur anzeigen wenn Puffer < 10 Min (inklusive überfällig)
      if (pufferMin < 10) {
        // Doppelten Eintrag vermeiden
        if (!cookNowItems.some(i => i.order.id === order.id)) {
          cookNowItems.push({
            order,
            prepMin,
            driverEtaMin,
            pufferMin,
            driverName,
            batchId: batch.id,
          });
        }
      }
    }
  }

  if (cookNowItems.length === 0) return null;

  // Sortiere nach Dringlichkeit (überfällig zuerst)
  cookNowItems.sort((a, b) => a.pufferMin - b.pufferMin);

  const hasOverdue = cookNowItems.some(i => i.pufferMin < 0);
  const hasUrgent = cookNowItems.some(i => i.pufferMin >= 0 && i.pufferMin <= 5);

  const bandColor = hasOverdue
    ? 'border-red-500 bg-red-50'
    : hasUrgent
    ? 'border-amber-400 bg-amber-50'
    : 'border-matcha-400 bg-matcha-50';

  const headerColor = hasOverdue
    ? 'bg-red-500 text-white'
    : hasUrgent
    ? 'bg-amber-400 text-white'
    : 'bg-matcha-500 text-white';

  const HeaderIcon = hasOverdue ? AlertTriangle : hasUrgent ? Zap : ChefHat;

  return (
    <div className={cn('rounded-xl border-2 overflow-hidden', bandColor)}>
      {/* Header */}
      <div className={cn('flex items-center gap-2 px-4 py-2.5', headerColor)}>
        <HeaderIcon className="h-4 w-4 shrink-0" />
        <span className="text-xs font-black uppercase tracking-wider">
          {hasOverdue
            ? `Kochstart überfällig — ${cookNowItems.filter(i => i.pufferMin < 0).length} Bestellung${cookNowItems.filter(i => i.pufferMin < 0).length > 1 ? 'en' : ''}`
            : hasUrgent
            ? 'Jetzt kochen — Fahrer kommt bald zurück'
            : 'Kochstart planen — Fahrer unterwegs'}
        </span>
        <span className="ml-auto text-[10px] font-bold opacity-80">
          {cookNowItems.length} offen
        </span>
      </div>

      {/* Driver rows grouped by batch */}
      <div className="divide-y divide-black/5">
        {(() => {
          const seenBatches = new Set<string>();
          const grouped: { batchId: string; driverName: string; driverEtaMin: number; items: CookNowItem[] }[] = [];
          for (const item of cookNowItems) {
            if (!seenBatches.has(item.batchId)) {
              seenBatches.add(item.batchId);
              grouped.push({
                batchId: item.batchId,
                driverName: item.driverName,
                driverEtaMin: item.driverEtaMin,
                items: cookNowItems.filter(i => i.batchId === item.batchId),
              });
            }
          }
          return grouped.map(group => (
            <div key={group.batchId} className="px-3 py-2.5 space-y-2">
              {/* Driver ETA row */}
              <div className="flex items-center gap-2">
                <Bike className="h-3.5 w-3.5 text-matcha-600 shrink-0" />
                <span className="text-[11px] font-bold text-black/70">{group.driverName}</span>
                <div className="flex items-center gap-1 ml-auto rounded-full border border-matcha-200 bg-white px-2.5 py-0.5">
                  <Clock className="h-3 w-3 text-matcha-500" />
                  <span className="text-[11px] font-black text-matcha-700 tabular-nums">
                    {group.driverEtaMin <= 0 ? 'Jetzt zurück' : `Ankunft in ${group.driverEtaMin} Min`}
                  </span>
                </div>
              </div>

              {/* Order cards */}
              <div className="flex flex-wrap gap-1.5">
                {group.items.map(item => {
                  const urgency = urgencyFromPuffer(item.pufferMin);
                  const secsCountdown = item.pufferMin * 60;
                  const isOverdue = item.pufferMin < 0;

                  return (
                    <div
                      key={item.order.id}
                      className={cn(
                        'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs',
                        urgency === 'red'
                          ? 'border-red-400 bg-red-100 text-red-900'
                          : urgency === 'amber'
                          ? 'border-amber-300 bg-amber-100 text-amber-900'
                          : 'border-matcha-300 bg-matcha-100 text-matcha-900',
                      )}
                    >
                      {urgency === 'red' ? (
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      ) : urgency === 'amber' ? (
                        <Zap className="h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <ChefHat className="h-3.5 w-3.5 shrink-0" />
                      )}

                      <span className="font-black tabular-nums">
                        #{item.order.bestellnummer}
                      </span>

                      <span className="opacity-60 text-[10px]">
                        {item.prepMin} Min
                      </span>

                      <div className={cn(
                        'flex items-center gap-1 rounded px-1.5 py-0.5 font-black tabular-nums text-[11px]',
                        urgency === 'red'
                          ? 'bg-red-200 text-red-800'
                          : urgency === 'amber'
                          ? 'bg-amber-200 text-amber-800'
                          : 'bg-matcha-200 text-matcha-800',
                      )}>
                        <Clock className="h-3 w-3 shrink-0" />
                        {isOverdue
                          ? `+${fmtTime(-secsCountdown)} überfällig`
                          : fmtTime(secsCountdown)
                        }
                      </div>

                      {!isOverdue && item.pufferMin > 5 && (
                        <CheckCircle2 className="h-3 w-3 text-matcha-500 shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ));
        })()}
      </div>
    </div>
  );
}
