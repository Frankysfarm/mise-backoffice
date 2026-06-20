'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Bike, CheckCircle2, Clock, AlertTriangle, ChefHat, Zap, Package } from 'lucide-react';

type Order = {
  id: string; bestellnummer: string; status: string;
  kunde_name: string; bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  delivery_zone: string | null;
};
type BatchStop = { id: string; order_id: string; reihenfolge: number; geliefert_am: string | null };
type Batch = {
  id: string; status: string; fahrer_id: string | null;
  startzeit?: string | null; total_eta_min: number | null;
  fahrer: { vorname: string; nachname: string } | null;
  stops: BatchStop[];
};
type Timing = { order_id: string; cook_start_at: string | null; ready_target: string | null; prep_min: number | null; status: string };

interface Props { orders: Order[]; batches: Batch[]; timings: Timing[] }

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371; const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat); const dLng = toRad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function fmt(sec: number): string {
  if (sec < 0) return `+${Math.ceil(Math.abs(sec) / 60)}m`;
  const m = Math.floor(sec / 60); const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function KitchenBatchTimingKoordinator({ orders, batches, timings }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => { const iv = setInterval(() => setTick(n => n + 1), 1000); return () => clearInterval(iv); }, []);

  const now = Date.now();
  const timingMap = new Map(timings.map(t => [t.order_id, t]));
  const orderMap = new Map(orders.map(o => [o.id, o]));

  const ACTIVE = new Set(['unterwegs', 'on_route', 'assigned', 'pickup', 'at_restaurant']);
  const activeBatches = batches.filter(b => ACTIVE.has(b.status));
  if (activeBatches.length === 0) return null;

  // For each batch, calculate driver ETA (when they arrive at restaurant)
  const batchGroups = activeBatches.map(batch => {
    const driverEtaMs = batch.startzeit && batch.total_eta_min != null
      ? new Date(batch.startzeit).getTime() + batch.total_eta_min * 60_000
      : null;
    const driverEtaSec = driverEtaMs ? Math.floor((driverEtaMs - now) / 1000) : null;

    const pendingStops = batch.stops
      .filter(s => !s.geliefert_am)
      .sort((a, b) => a.reihenfolge - b.reihenfolge);

    const stopOrders = pendingStops
      .map(s => orderMap.get(s.order_id))
      .filter(Boolean) as Order[];

    const kitchenOrders = stopOrders.filter(o =>
      ['neu', 'bestätigt', 'in_zubereitung', 'fertig'].includes(o.status)
    );

    // Compute status for each order in this batch
    const orderStatuses = kitchenOrders.map(o => {
      const t = timingMap.get(o.id);
      const readyMs = t?.ready_target ? new Date(t.ready_target).getTime() : null;
      const readySec = readyMs ? Math.floor((readyMs - now) / 1000) : null;
      const bufferSec = driverEtaMs && readyMs ? Math.floor((driverEtaMs - readyMs) / 1000) : null;

      let urgency: 'ok' | 'tight' | 'late' | 'done' = 'ok';
      if (o.status === 'fertig') urgency = 'done';
      else if (bufferSec !== null) {
        if (bufferSec < 0) urgency = 'late';
        else if (bufferSec < 300) urgency = 'tight';
      } else if (readySec !== null) {
        if (readySec < 0) urgency = 'late';
        else if (readySec < 300) urgency = 'tight';
      }
      return { order: o, timing: t ?? null, readySec, bufferSec, urgency };
    });

    const hasLate = orderStatuses.some(s => s.urgency === 'late');
    const hasTight = orderStatuses.some(s => s.urgency === 'tight');
    const groupUrgency = hasLate ? 'late' : hasTight ? 'tight' : 'ok';

    return { batch, driverEtaSec, kitchenOrders, orderStatuses, groupUrgency };
  }).filter(g => g.kitchenOrders.length > 0);

  if (batchGroups.length === 0) return null;

  return (
    <div className="rounded-xl border border-border overflow-hidden shadow-sm">
      <div className={cn(
        'flex items-center gap-2 px-3 py-2',
        batchGroups.some(g => g.groupUrgency === 'late') ? 'bg-red-600' :
        batchGroups.some(g => g.groupUrgency === 'tight') ? 'bg-amber-500' : 'bg-blue-600',
      )}>
        <ChefHat className="h-4 w-4 text-white" />
        <span className="text-xs font-black uppercase tracking-wider text-white">
          Batch-Timing · {batchGroups.length} Tour{batchGroups.length !== 1 ? 'en' : ''}
        </span>
        {batchGroups.some(g => g.groupUrgency === 'late') && (
          <span className="ml-auto rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold text-white">
            FAHRER WARTET
          </span>
        )}
      </div>
      <div className="divide-y divide-border">
        {batchGroups.map(({ batch, driverEtaSec, orderStatuses, groupUrgency }) => {
          const driverName = batch.fahrer ? `${batch.fahrer.vorname} ${batch.fahrer.nachname[0]}.` : 'Fahrer';
          return (
            <div key={batch.id} className={cn(
              'p-3 space-y-2',
              groupUrgency === 'late' ? 'bg-red-50' :
              groupUrgency === 'tight' ? 'bg-amber-50' : 'bg-card',
            )}>
              {/* Batch header */}
              <div className="flex items-center gap-2">
                <Bike size={13} className={cn(
                  groupUrgency === 'late' ? 'text-red-600' :
                  groupUrgency === 'tight' ? 'text-amber-600' : 'text-blue-600',
                )} />
                <span className="text-xs font-bold">{driverName}</span>
                {driverEtaSec !== null && (
                  <span className={cn(
                    'ml-auto rounded-full px-2 py-0.5 text-[10px] font-black tabular-nums flex items-center gap-1',
                    driverEtaSec < 0 ? 'bg-red-100 text-red-700' :
                    driverEtaSec < 300 ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700',
                  )}>
                    <Clock size={9} />
                    {driverEtaSec < 0 ? 'Überfällig' : `Fahrer in ${Math.ceil(driverEtaSec / 60)} Min`}
                  </span>
                )}
              </div>
              {/* Order list in batch */}
              <div className="space-y-1.5">
                {orderStatuses.map(({ order, readySec, bufferSec, urgency }) => (
                  <div key={order.id} className={cn(
                    'flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs',
                    urgency === 'done' ? 'bg-matcha-50 border border-matcha-200' :
                    urgency === 'late' ? 'bg-red-50 border border-red-200' :
                    urgency === 'tight' ? 'bg-amber-50 border border-amber-200' :
                    'bg-muted/50 border border-border/60',
                  )}>
                    {urgency === 'done'
                      ? <CheckCircle2 size={12} className="text-matcha-600 shrink-0" />
                      : urgency === 'late'
                      ? <AlertTriangle size={12} className="text-red-500 shrink-0 animate-pulse" />
                      : <Package size={12} className="text-muted-foreground shrink-0" />
                    }
                    <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                      #{order.bestellnummer}
                    </span>
                    <span className="flex-1 font-semibold truncate">{order.kunde_name}</span>
                    <span className={cn(
                      'rounded px-1.5 py-0.5 text-[10px] font-bold shrink-0',
                      urgency === 'done' ? 'bg-matcha-100 text-matcha-700' :
                      urgency === 'late' ? 'bg-red-100 text-red-700' :
                      urgency === 'tight' ? 'bg-amber-100 text-amber-700' :
                      'bg-muted text-muted-foreground',
                    )}>
                      {urgency === 'done' ? 'Fertig ✓' :
                       readySec !== null ? (readySec < 0 ? `+${Math.ceil(Math.abs(readySec) / 60)}m` : `${Math.ceil(readySec / 60)}m`) :
                       order.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
