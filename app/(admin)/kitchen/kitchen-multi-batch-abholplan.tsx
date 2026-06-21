'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Bike, Clock, AlertTriangle, Package, CheckCircle2 } from 'lucide-react';

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  typ: string;
  kunde_name: string;
  geschaetzte_zubereitung_min: number | null;
  bestellt_am: string | null;
  fertig_am: string | null;
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

type Driver = {
  id: string;
  vorname: string;
  nachname: string;
  status: { ist_online: boolean; aktueller_batch_id: string | null } | null;
};

interface Props {
  orders: Order[];
  batches: Batch[];
  stops: Stop[];
  drivers: Driver[];
}

interface BatchPickup {
  batchId: string;
  driverName: string;
  etaSec: number | null;
  pendingOrderIds: string[];
  readyCount: number;
  notReadyCount: number;
  risk: 'ok' | 'warn' | 'critical';
}

export function KitchenMultiBatchAbholplan({ orders, batches, stops, drivers }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick(n => n + 1), 5_000);
    return () => clearInterval(iv);
  }, []);

  const now = Date.now();

  const activeBatches = batches.filter(b =>
    ['unterwegs', 'on_route', 'assigned', 'at_restaurant', 'pickup'].includes(b.status),
  );

  const pickups: BatchPickup[] = activeBatches.map(batch => {
    const batchStops = stops.filter(s => s.batch_id === batch.id && !s.geliefert_am);
    const pendingOrderIds = batchStops.map(s => s.order_id);
    const pendingOrders = pendingOrderIds.map(id => orders.find(o => o.id === id)).filter(Boolean) as Order[];

    const etaSec = batch.started_at && batch.total_eta_min != null
      ? Math.max(0, Math.floor((new Date(batch.started_at).getTime() + batch.total_eta_min * 60_000 - now) / 1000))
      : null;

    const driver = drivers.find(d => d.id === batch.driver_id);
    const driverName = driver ? `${driver.vorname} ${driver.nachname[0]}.` : 'Fahrer';

    const readyCount = pendingOrders.filter(o => o.status === 'fertig').length;
    const notReadyCount = pendingOrders.filter(o => ['bestätigt', 'in_zubereitung', 'neu'].includes(o.status)).length;

    let risk: 'ok' | 'warn' | 'critical' = 'ok';
    if (etaSec !== null && notReadyCount > 0) {
      const etaMin = etaSec / 60;
      const maxPrepMin = Math.max(
        ...pendingOrders
          .filter(o => ['bestätigt', 'in_zubereitung'].includes(o.status))
          .map(o => o.geschaetzte_zubereitung_min ?? 20),
        0,
      );
      if (etaMin < 3) risk = 'critical';
      else if (etaMin < maxPrepMin) risk = 'warn';
    }

    return { batchId: batch.id, driverName, etaSec, pendingOrderIds, readyCount, notReadyCount, risk };
  }).filter(p => p.pendingOrderIds.length > 0);

  if (pickups.length < 2) return null;

  const simultaneousPickups = pickups.filter(p => p.etaSec !== null && p.etaSec < 8 * 60);
  if (simultaneousPickups.length < 2) return null;

  const hasConflict = simultaneousPickups.some(p => p.risk !== 'ok');

  return (
    <div className={cn(
      'rounded-xl border p-4 space-y-3',
      hasConflict ? 'border-amber-300 bg-amber-50' : 'border-border bg-card',
    )}>
      <div className="flex items-center gap-2">
        {hasConflict
          ? <AlertTriangle size={14} className="text-amber-600 shrink-0" />
          : <Bike size={14} className="text-muted-foreground shrink-0" />}
        <span className={cn(
          'text-xs font-bold uppercase tracking-wider',
          hasConflict ? 'text-amber-700' : 'text-muted-foreground',
        )}>
          Parallel-Abholplan
        </span>
        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
          {simultaneousPickups.length} Fahrer in &lt;8 Min
        </span>
      </div>

      <div className="space-y-2">
        {simultaneousPickups
          .sort((a, b) => (a.etaSec ?? 999) - (b.etaSec ?? 999))
          .map(pickup => {
            const etaMin = pickup.etaSec !== null ? Math.floor(pickup.etaSec / 60) : null;
            const etaSec = pickup.etaSec !== null ? pickup.etaSec % 60 : null;

            const riskStyle = {
              critical: 'border-red-400 bg-red-50',
              warn: 'border-amber-300 bg-amber-50/60',
              ok: 'border-matcha-200 bg-matcha-50/40',
            }[pickup.risk];

            const badgeStyle = {
              critical: 'bg-red-100 text-red-700',
              warn: 'bg-amber-100 text-amber-700',
              ok: 'bg-matcha-100 text-matcha-700',
            }[pickup.risk];

            return (
              <div key={pickup.batchId} className={cn('rounded-lg border px-3 py-2.5 flex items-center gap-3', riskStyle)}>
                <div className={cn('shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black tabular-nums min-w-[42px] text-center', badgeStyle)}>
                  {etaMin !== null
                    ? `${etaMin}:${String(etaSec ?? 0).padStart(2, '0')}`
                    : '—'}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold truncate">{pickup.driverName}</span>
                    {pickup.risk === 'critical' && (
                      <span className="text-[9px] font-black text-red-600 uppercase">SOFORT!</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {pickup.readyCount > 0 && (
                      <span className="flex items-center gap-0.5 text-[10px] text-matcha-700 font-semibold">
                        <CheckCircle2 size={9} /> {pickup.readyCount} fertig
                      </span>
                    )}
                    {pickup.notReadyCount > 0 && (
                      <span className="flex items-center gap-0.5 text-[10px] text-amber-700 font-semibold">
                        <Clock size={9} /> {pickup.notReadyCount} noch nicht fertig
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {Array.from({ length: pickup.readyCount }).map((_, i) => (
                    <div key={i} className="h-3 w-3 rounded-full bg-matcha-500" />
                  ))}
                  {Array.from({ length: pickup.notReadyCount }).map((_, i) => (
                    <div key={i} className={cn(
                      'h-3 w-3 rounded-full',
                      pickup.risk === 'critical' ? 'bg-red-400 animate-pulse' : 'bg-amber-400',
                    )} />
                  ))}
                </div>
              </div>
            );
          })}
      </div>

      {hasConflict && (
        <p className="text-[10px] text-amber-700 font-medium leading-snug">
          Mehrere Fahrer kommen gleichzeitig — Küche muss priorisieren! Rot = Fahrer kommt bevor Bestellung fertig.
        </p>
      )}
    </div>
  );
}
