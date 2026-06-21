'use client';
import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Clock, ChefHat, Bike } from 'lucide-react';

// Props match what kitchen/client.tsx already has
type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  kunde_name: string;
  geschaetzte_zubereitung_min: number | null;
  bestellt_am: string | null;
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
};

type Props = {
  orders: Order[];
  batches: Batch[];
  stops: Stop[];
  drivers: Driver[];
};

type Row = {
  driverName: string;
  batchId: string;
  orderId: string;
  bestellnummer: string;
  cookStartInMin: number; // positive = still time, negative = overdue
  prepMin: number;
  urgency: 'safe' | 'soon' | 'overdue';
};

export function KitchenSchichtBatchKochstartBoard({ orders, batches, stops, drivers }: Props) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(iv);
  }, []);

  const rows: Row[] = [];

  for (const batch of batches) {
    if (!['assigned', 'pending_acceptance', 'at_restaurant'].includes(batch.status)) continue;
    const driver = drivers.find(d => d.id === batch.driver_id);
    const driverName = driver ? `${driver.vorname} ${driver.nachname[0]}.` : 'Fahrer';

    // Estimate when driver arrives at restaurant
    // If batch has ETA use it, else assume 15 min from now
    const pickupEtaMs = batch.started_at && batch.total_eta_min != null
      ? new Date(batch.started_at).getTime() + batch.total_eta_min * 60_000
      : now + 15 * 60_000;

    const batchStops = stops.filter(s => s.batch_id === batch.id && !s.geliefert_am);

    for (const stop of batchStops) {
      const order = orders.find(o => o.id === stop.order_id);
      if (!order) continue;
      if (['fertig', 'geliefert', 'abgeholt', 'abgeschlossen'].includes(order.status)) continue;

      const prepMin = order.geschaetzte_zubereitung_min ?? 15;
      const pickupEtaMin = (pickupEtaMs - now) / 60_000;
      const cookStartInMin = pickupEtaMin - prepMin;

      const urgency: Row['urgency'] = cookStartInMin < 0 ? 'overdue' : cookStartInMin < 3 ? 'soon' : 'safe';

      rows.push({
        driverName,
        batchId: batch.id,
        orderId: stop.order_id,
        bestellnummer: order.bestellnummer,
        cookStartInMin,
        prepMin,
        urgency,
      });
    }
  }

  if (rows.length === 0) return null;

  rows.sort((a, b) => a.cookStartInMin - b.cookStartInMin);

  const urgencyStyle = {
    safe: { bar: 'bg-matcha-500', badge: 'bg-matcha-100 text-matcha-700', label: 'Kochstart in' },
    soon: { bar: 'bg-amber-500', badge: 'bg-amber-100 text-amber-700', label: 'Bald starten!' },
    overdue: { bar: 'bg-red-500', badge: 'bg-red-100 text-red-700', label: 'Überfällig!' },
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <ChefHat className="h-4 w-4 text-matcha-600" />
        <span className="text-sm font-bold text-foreground">Batch Kochstart-Board</span>
        <Badge className="ml-auto text-[10px]">{rows.length} Bestellungen</Badge>
      </div>
      <div className="space-y-2">
        {rows.map((row) => {
          const s = urgencyStyle[row.urgency];
          const absMin = Math.abs(Math.round(row.cookStartInMin));
          return (
            <div key={`${row.batchId}-${row.orderId}`} className="rounded-xl border border-stone-100 bg-stone-50 p-3">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <Bike className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold text-foreground">{row.driverName}</span>
                  <span className="text-[10px] text-muted-foreground">#{row.bestellnummer}</span>
                </div>
                <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', s.badge)}>
                  {row.urgency === 'overdue'
                    ? `${absMin} Min überfällig`
                    : `${s.label} ${absMin} Min`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-stone-200 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-700', s.bar)}
                    style={{ width: `${Math.min(100, row.urgency === 'overdue' ? 100 : Math.max(5, 100 - (row.cookStartInMin / 20) * 100))}%` }}
                  />
                </div>
                <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="text-[10px] text-muted-foreground shrink-0">{row.prepMin} Min Prep</span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
