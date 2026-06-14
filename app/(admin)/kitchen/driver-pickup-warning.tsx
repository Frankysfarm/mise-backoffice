'use client';

/**
 * KitchenDriverPickupWarning — Phase 165
 *
 * Kritischer Warn-Banner: Fahrer ist unterwegs zum Restaurant für
 * Bestellungen die noch NICHT fertig sind. Zeigt einen präzisen
 * Countdown und Bestellliste — handlungsauslösender Alert.
 *
 * Unterschied zu KochstartAlertBand (allgemein) und
 * KitchenCookStartTimer (wann starten):
 * → Dieser Banner zeigt NUR wenn Fahrer BEREITS unterwegs ist
 *   und die Bestellung noch nicht fertig.
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, Bike, CheckCircle2, Flame, Package } from 'lucide-react';

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  kunde_name: string;
  items: { name: string; menge: number }[];
  geschaetzte_zubereitung_min: number | null;
};

type Batch = {
  id: string;
  driver_id: string;
  status: string;
  started_at: string | null;
  total_eta_min: number | null;
};

type Driver = {
  id: string;
  vorname: string;
  nachname: string;
};

type Stop = {
  id: string;
  batch_id: string;
  order_id: string;
  geliefert_am: string | null;
  angekommen_am: string | null;
};

interface UrgentPickup {
  batchId: string;
  driverName: string;
  etaSec: number;
  orders: { id: string; bestellnummer: string; status: string; itemCount: number; items: string[] }[];
}

function useTick() {
  const [, setT] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setT(n => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);
}

function fmtCountdown(sec: number): string {
  if (sec <= 0) return 'JETZT';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function KitchenDriverPickupWarning({
  batches,
  drivers,
  stops,
  orders,
}: {
  batches: Batch[];
  drivers: Driver[];
  stops: Stop[];
  orders: Order[];
}) {
  useTick();

  const now = Date.now();

  const urgentPickups: UrgentPickup[] = batches
    .filter(b => b.status === 'unterwegs' || b.status === 'on_route' || b.status === 'assigned')
    .flatMap(b => {
      if (!b.started_at || b.total_eta_min == null) return [];
      const etaMs = new Date(b.started_at).getTime() + b.total_eta_min * 60_000;
      const etaSec = Math.floor((etaMs - now) / 1000);
      if (etaSec > 12 * 60 || etaSec < -120) return [];

      const batchStops = stops.filter(s => s.batch_id === b.id && !s.geliefert_am && !s.angekommen_am);
      const pendingOrders = batchStops
        .map(s => orders.find(o => o.id === s.order_id))
        .filter((o): o is Order => !!o && !['fertig', 'unterwegs', 'geliefert', 'abgeholt'].includes(o.status));

      if (pendingOrders.length === 0) return [];

      const driver = drivers.find(d => d.id === b.driver_id);
      return [{
        batchId: b.id,
        driverName: driver ? `${driver.vorname} ${driver.nachname[0]}.` : 'Fahrer',
        etaSec,
        orders: pendingOrders.map(o => ({
          id: o.id,
          bestellnummer: o.bestellnummer,
          status: o.status,
          itemCount: o.items.reduce((s, i) => s + i.menge, 0),
          items: o.items.slice(0, 3).map(i => `${i.menge}× ${i.name}`),
        })),
      }];
    })
    .sort((a, b) => a.etaSec - b.etaSec);

  if (urgentPickups.length === 0) return null;

  const isCritical = urgentPickups.some(p => p.etaSec <= 3 * 60);
  const isOverdue = urgentPickups.some(p => p.etaSec <= 0);

  return (
    <div className={cn(
      'rounded-2xl border-2 overflow-hidden',
      isOverdue
        ? 'border-red-500 bg-red-50 animate-pulse'
        : isCritical
        ? 'border-orange-400 bg-orange-50'
        : 'border-amber-300 bg-amber-50',
    )}>
      {/* Header */}
      <div className={cn(
        'flex items-center gap-2.5 px-4 py-2.5',
        isOverdue ? 'bg-red-500 text-white' : isCritical ? 'bg-orange-500 text-white' : 'bg-amber-400 text-amber-900',
      )}>
        {isOverdue
          ? <Flame className="h-4 w-4 shrink-0 animate-bounce" />
          : isCritical
          ? <AlertTriangle className="h-4 w-4 shrink-0" />
          : <Bike className="h-4 w-4 shrink-0" />}
        <span className="font-black text-sm uppercase tracking-wider">
          {isOverdue
            ? 'Fahrer WARTET — Sofort fertigstellen!'
            : isCritical
            ? 'Fahrer kommt gleich — Jetzt fertigstellen!'
            : 'Fahrer unterwegs — Bestellungen vorbereiten'}
        </span>
        <span className="ml-auto text-xs font-bold opacity-80">
          {urgentPickups.length === 1 ? '1 Abholung' : `${urgentPickups.length} Abholungen`}
        </span>
      </div>

      {/* Pickup-Liste */}
      <div className="divide-y divide-black/5">
        {urgentPickups.map(pickup => {
          const secLeft = pickup.etaSec;
          const isPickupCritical = secLeft <= 3 * 60;
          const isPickupOverdue = secLeft <= 0;

          return (
            <div key={pickup.batchId} className="px-4 py-3 flex items-start gap-3">
              {/* Countdown */}
              <div className={cn(
                'rounded-xl px-3 py-2 text-center min-w-[72px] flex-shrink-0',
                isPickupOverdue ? 'bg-red-200' : isPickupCritical ? 'bg-orange-200' : 'bg-amber-200',
              )}>
                <div className={cn(
                  'font-mono font-black text-xl tabular-nums leading-none',
                  isPickupOverdue ? 'text-red-700' : isPickupCritical ? 'text-orange-700' : 'text-amber-800',
                )}>
                  {isPickupOverdue ? 'HIER!' : fmtCountdown(secLeft)}
                </div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-black/50 mt-0.5">
                  {isPickupOverdue ? 'Warte auf dich' : 'bis Ankunft'}
                </div>
              </div>

              {/* Fahrer + Orders */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Bike className="h-3.5 w-3.5 text-black/50 shrink-0" />
                  <span className="font-bold text-sm text-black/80">{pickup.driverName}</span>
                </div>
                <div className="space-y-1.5">
                  {pickup.orders.map(ord => {
                    const isCooking = ord.status === 'in_zubereitung';
                    return (
                      <div
                        key={ord.id}
                        className={cn(
                          'rounded-lg px-2.5 py-1.5 flex items-start gap-2',
                          isCooking ? 'bg-blue-100 border border-blue-200' : 'bg-red-100 border border-red-200',
                        )}
                      >
                        {isCooking
                          ? <Package className="h-3.5 w-3.5 text-blue-600 shrink-0 mt-0.5" />
                          : <Flame className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5 animate-pulse" />}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[10px] font-black text-black/60">#{ord.bestellnummer.slice(-4)}</span>
                            <span className={cn(
                              'rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase',
                              isCooking ? 'bg-blue-200 text-blue-700' : 'bg-red-200 text-red-700',
                            )}>
                              {isCooking ? 'kocht' : 'noch nicht gestartet'}
                            </span>
                          </div>
                          <div className="text-[10px] text-black/60 mt-0.5">
                            {ord.items.join(' · ')}
                            {ord.itemCount > 3 && ` +${ord.itemCount - 3} weitere`}
                          </div>
                        </div>
                        {isCooking && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-blue-400 shrink-0 mt-0.5" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
