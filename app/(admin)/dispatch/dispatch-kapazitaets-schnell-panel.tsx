'use client';

/**
 * DispatchKapazitaetsSchnellPanel — Phase 427
 * Kompakte Echtzeit-Kapazitätsübersicht: Aktive Touren / Wartende Bestellungen / Freie Fahrer.
 * Hilft dem Dispatcher sofort zu erkennen ob Handlungsbedarf besteht.
 */

import { Bike, Package, Route, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Driver {
  ist_online: boolean;
  aktueller_batch_id: string | null;
}

interface Batch {
  id: string;
  status: string;
}

interface Order {
  status: string;
}

interface Props {
  orders: Order[];
  batches: Batch[];
  drivers: Driver[];
}

type CapacityState = 'ok' | 'knapp' | 'überlastet' | 'idle';

function assess(pendingCount: number, freeDrivers: number, activeTours: number): CapacityState {
  if (pendingCount === 0 && activeTours === 0) return 'idle';
  if (freeDrivers === 0 && pendingCount > 2) return 'überlastet';
  if (freeDrivers <= 1 && pendingCount > 0) return 'knapp';
  return 'ok';
}

const STATE_CFG: Record<CapacityState, { label: string; bg: string; dot: string }> = {
  ok:          { label: 'Kapazität OK',    bg: 'bg-matcha-50 border-matcha-200',  dot: 'bg-matcha-500' },
  knapp:       { label: 'Kapazität knapp', bg: 'bg-amber-50 border-amber-200',    dot: 'bg-amber-400' },
  überlastet:  { label: 'Überlastet',      bg: 'bg-red-50 border-red-200',        dot: 'bg-red-500 animate-pulse' },
  idle:        { label: 'Leerlauf',        bg: 'bg-stone-50 border-stone-200',    dot: 'bg-stone-400' },
};

export function DispatchKapazitaetsSchnellPanel({ orders, batches, drivers }: Props) {
  const onlineDrivers = drivers.filter((d) => d.ist_online);
  const freeDrivers   = onlineDrivers.filter((d) => !d.aktueller_batch_id).length;
  const activeTours   = batches.filter((b) => b.status === 'unterwegs' || b.status === 'on_route').length;
  const pendingOrders = orders.filter((o) => o.status === 'fertig' || o.status === 'bestätigt' || o.status === 'neu').length;

  const state = assess(pendingOrders, freeDrivers, activeTours);
  const cfg   = STATE_CFG[state];

  const Icon = state === 'ok' ? CheckCircle2 : state === 'idle' ? Bike : AlertTriangle;

  return (
    <div className={cn('rounded-xl border px-4 py-2.5 flex items-center gap-4', cfg.bg)}>
      {/* Status dot */}
      <div className="flex items-center gap-2 shrink-0">
        <div className={cn('w-2 h-2 rounded-full', cfg.dot)} />
        <Icon className={cn('h-3.5 w-3.5',
          state === 'ok' ? 'text-matcha-600' :
          state === 'idle' ? 'text-stone-500' : 'text-amber-600'
        )} />
      </div>

      {/* Label */}
      <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground shrink-0">
        {cfg.label}
      </span>

      {/* Metrics */}
      <div className="flex-1 flex items-center gap-4 text-[11px] tabular-nums flex-wrap">
        <span className="flex items-center gap-1">
          <Route className="h-3 w-3 text-blue-500" />
          <strong>{activeTours}</strong>
          <span className="text-muted-foreground">Touren aktiv</span>
        </span>
        <span className="flex items-center gap-1">
          <Package className="h-3 w-3 text-amber-500" />
          <strong>{pendingOrders}</strong>
          <span className="text-muted-foreground">wartend</span>
        </span>
        <span className="flex items-center gap-1">
          <Bike className="h-3 w-3 text-matcha-600" />
          <strong>{freeDrivers}</strong>
          <span className="text-muted-foreground">frei</span>
          {onlineDrivers.length > 0 && (
            <span className="text-muted-foreground">/ {onlineDrivers.length}</span>
          )}
        </span>
      </div>
    </div>
  );
}
