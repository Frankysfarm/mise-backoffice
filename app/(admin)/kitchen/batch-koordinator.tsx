'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Bike, Clock, CheckCircle2, AlertTriangle, Users, Zap } from 'lucide-react';

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  kunde_name: string;
  geschaetzte_zubereitung_min: number | null;
  items: { name: string; menge: number }[];
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
  geliefert_am: string | null;
};

type Driver = {
  id: string;
  vorname: string;
  nachname: string;
};

interface Props {
  orders: Order[];
  batches: Batch[];
  stops: Stop[];
  drivers: Driver[];
}

function secsUntilArrival(batch: Batch): number | null {
  if (!batch.started_at || batch.total_eta_min == null) return null;
  const etaMs = new Date(batch.started_at).getTime() + batch.total_eta_min * 60_000;
  return Math.floor((etaMs - Date.now()) / 1000);
}

function fmtMin(sec: number): string {
  const abs = Math.abs(sec);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  if (m >= 10) return `${sec < 0 ? '-' : ''}${m} Min`;
  return `${sec < 0 ? '-' : ''}${m}:${String(s).padStart(2, '0')}`;
}

type UrgencyLevel = 'ok' | 'warn' | 'critical' | 'overdue';

function urgency(sec: number | null): UrgencyLevel {
  if (sec === null) return 'ok';
  if (sec < 0) return 'overdue';
  if (sec < 120) return 'critical';
  if (sec < 300) return 'warn';
  return 'ok';
}

const URGENCY_STYLES: Record<UrgencyLevel, { card: string; badge: string; icon: string; label: string }> = {
  ok:       { card: 'bg-emerald-50  border-emerald-200', badge: 'bg-emerald-100 text-emerald-700', icon: 'text-emerald-500', label: 'Im Plan' },
  warn:     { card: 'bg-amber-50    border-amber-300',   badge: 'bg-amber-100   text-amber-700',   icon: 'text-amber-500',   label: 'Bald fällig' },
  critical: { card: 'bg-orange-50   border-orange-400',  badge: 'bg-orange-100  text-orange-700',  icon: 'text-orange-500',  label: 'Dringend' },
  overdue:  { card: 'bg-red-50      border-red-400',     badge: 'bg-red-100     text-red-700',     icon: 'text-red-500',     label: 'Überfällig' },
};

export function KitchenBatchKoordinator({ orders, batches, stops, drivers }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  // Find active batches (driver on the way back / assigned)
  const activeBatches = batches.filter(b =>
    b.status === 'unterwegs' || b.status === 'on_route' || b.status === 'assigned' || b.status === 'pickup',
  );

  // Build batch groups: batch → pending orders in kitchen (not yet delivered)
  const groups = activeBatches.flatMap(batch => {
    const batchStops = stops.filter(s => s.batch_id === batch.id && !s.geliefert_am);
    const kitchenOrders = batchStops
      .map(s => orders.find(o => o.id === s.order_id))
      .filter((o): o is Order => o != null && (o.status === 'bestätigt' || o.status === 'in_zubereitung' || o.status === 'fertig'));
    if (kitchenOrders.length === 0) return [];
    const driver = drivers.find(d => d.id === batch.driver_id);
    const sec = secsUntilArrival(batch);
    const u = urgency(sec);
    return [{ batch, kitchenOrders, driver, sec, u }];
  });

  if (groups.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Users size={14} className="text-muted-foreground" />
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Batch-Koordination
        </span>
        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
          {groups.length} {groups.length === 1 ? 'Fahrer' : 'Fahrer'} erwartet
        </span>
      </div>

      <div className="space-y-2">
        {groups.map(({ batch, kitchenOrders, driver, sec, u }) => {
          const styles = URGENCY_STYLES[u];
          const allReady = kitchenOrders.every(o => o.status === 'fertig');
          const doneCount = kitchenOrders.filter(o => o.status === 'fertig').length;

          return (
            <div
              key={batch.id}
              className={cn('rounded-lg border p-3 transition-colors', styles.card)}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Bike size={13} className={styles.icon} />
                  <span className="text-xs font-bold text-foreground">
                    {driver ? `${driver.vorname} ${driver.nachname}` : 'Fahrer'}
                  </span>
                  <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-bold', styles.badge)}>
                    {styles.label}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {u === 'overdue' ? (
                    <AlertTriangle size={12} className="text-red-500" />
                  ) : (
                    <Clock size={12} className={styles.icon} />
                  )}
                  <span className={cn('text-sm font-mono font-bold', u === 'overdue' ? 'text-red-600 animate-pulse' : u === 'critical' ? 'text-orange-600' : 'text-foreground')}>
                    {sec !== null ? fmtMin(sec) : '—'}
                  </span>
                </div>
              </div>

              {/* Order list */}
              <div className="space-y-1.5">
                {kitchenOrders.map(order => {
                  const isReady = order.status === 'fertig';
                  const isCooking = order.status === 'in_zubereitung';
                  return (
                    <div
                      key={order.id}
                      className={cn(
                        'flex items-center gap-2 rounded-md px-2 py-1 text-xs',
                        isReady   ? 'bg-emerald-100/70 text-emerald-800' :
                        isCooking ? 'bg-amber-100/70 text-amber-800' :
                        'bg-white/70 text-foreground',
                      )}
                    >
                      {isReady ? (
                        <CheckCircle2 size={11} className="text-emerald-600 shrink-0" />
                      ) : isCooking ? (
                        <Zap size={11} className="text-amber-500 shrink-0 animate-pulse" />
                      ) : (
                        <Clock size={11} className="text-muted-foreground shrink-0" />
                      )}
                      <span className="font-semibold">#{order.bestellnummer}</span>
                      <span className="truncate text-[11px] opacity-75">{order.kunde_name}</span>
                      <span className="ml-auto text-[10px] opacity-60 shrink-0">
                        {order.items.length} Pos.
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Progress bar */}
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/10">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-500',
                      allReady ? 'bg-emerald-500' : u === 'critical' || u === 'overdue' ? 'bg-orange-500' : 'bg-amber-400',
                    )}
                    style={{ width: `${Math.round((doneCount / kitchenOrders.length) * 100)}%` }}
                  />
                </div>
                <span className="text-[10px] font-bold text-muted-foreground shrink-0">
                  {doneCount}/{kitchenOrders.length} fertig
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
