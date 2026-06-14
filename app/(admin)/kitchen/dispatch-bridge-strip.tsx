'use client';

/**
 * KitchenDispatchBridgeStrip — Küche↔Dispatch Synchronisation
 *
 * Zeigt für jede kochende Lieferbestellung:
 *  - Welchem Fahrer-Batch sie zugeordnet ist
 *  - Verbleibende Kochzeit vs. erwartete Fahrerankunft
 *  - Farbkodierung: Grün = fertig bevor Fahrer ✓  Amber = knapp  Rot = Konflikt ✗
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, Bike, CheckCircle2, ChefHat, Clock, Zap } from 'lucide-react';

type KOrder = {
  id: string;
  bestellnummer: string;
  status: string;
  typ: string;
  kunde_name: string;
};

type KBatch = {
  id: string;
  driver_id: string;
  status: string;
  started_at?: string | null;
  total_eta_min?: number | null;
};

type KStop = {
  id: string;
  batch_id: string;
  order_id: string;
  reihenfolge: number;
  angekommen_am?: string | null;
  geliefert_am?: string | null;
};

type KDriver = {
  id: string;
  vorname: string;
  nachname: string;
  status?: {
    aktueller_batch_id?: string | null;
  } | null;
};

type KTiming = {
  order_id: string;
  ready_target: string | null;
  cook_start_at?: string | null;
  prep_min?: number | null;
  status: string;
};

type Props = {
  orders: KOrder[];
  batches: KBatch[];
  drivers: KDriver[];
  stops: KStop[];
  timings: KTiming[];
};

type SyncStatus = 'on_time' | 'tight' | 'late';

function getSyncStatus(readyTargetIso: string | null, driverArrivalMin: number | null): SyncStatus {
  if (!readyTargetIso || driverArrivalMin == null) return 'on_time';
  const readyInMin = (new Date(readyTargetIso).getTime() - Date.now()) / 60_000;
  const diff = readyInMin - driverArrivalMin;
  if (diff >= 2) return 'on_time';
  if (diff >= -2) return 'tight';
  return 'late';
}

const SYNC_STYLES: Record<SyncStatus, { bg: string; border: string; dot: string; label: string; text: string }> = {
  on_time: { bg: 'bg-matcha-50',  border: 'border-matcha-200', dot: 'bg-matcha-500', label: 'Synchron',  text: 'text-matcha-700'  },
  tight:   { bg: 'bg-amber-50',   border: 'border-amber-200',  dot: 'bg-amber-500',  label: 'Knapp',     text: 'text-amber-700'   },
  late:    { bg: 'bg-red-50',     border: 'border-red-200',    dot: 'bg-red-500',    label: 'Konflikt!', text: 'text-red-700'     },
};

function useTick() {
  const [, setT] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setT((n) => n + 1), 10_000);
    return () => clearInterval(iv);
  }, []);
}

export function KitchenDispatchBridgeStrip({ orders, batches, drivers, stops, timings }: Props) {
  useTick();

  const cookingDelivery = orders.filter(
    (o) => o.status === 'in_zubereitung' && o.typ === 'lieferung',
  );

  if (cookingDelivery.length === 0) return null;

  const ACTIVE_BATCH_STATUSES = new Set(['pickup', 'at_restaurant', 'assigned', 'pending_acceptance']);

  const rows = cookingDelivery.map((order) => {
    const timing = timings.find((t) => t.order_id === order.id);

    // Finde den Stopp mit dieser order_id → then den zugehörigen Batch
    const stop = stops.find((s) => s.order_id === order.id);
    const batch = stop ? batches.find((b) => b.id === stop.batch_id && ACTIVE_BATCH_STATUSES.has(b.status)) : undefined;

    let driverArrivalMin: number | null = null;
    let driverName: string | null = null;

    if (batch) {
      const driver = drivers.find((d) => d.id === batch.driver_id);
      if (driver) {
        driverName = `${driver.vorname} ${driver.nachname}`.trim();
      }
      // Einfache Schätzung: Fahrer kommt in ~8 Min (Pickup-Phase)
      driverArrivalMin = 8;
    }

    const readyCookMin = timing?.ready_target
      ? Math.max(0, Math.round((new Date(timing.ready_target).getTime() - Date.now()) / 60_000))
      : null;

    const syncStatus = getSyncStatus(timing?.ready_target ?? null, driverArrivalMin);

    return { order, timing, driverName, driverArrivalMin, syncStatus, readyCookMin };
  });

  const hasConflict = rows.some((r) => r.syncStatus === 'late');
  const hasTight    = rows.some((r) => r.syncStatus === 'tight');

  return (
    <div className={cn(
      'rounded-2xl border p-3 space-y-2',
      hasConflict
        ? 'bg-red-50 border-red-200'
        : hasTight
        ? 'bg-amber-50 border-amber-200'
        : 'bg-matcha-50 border-matcha-200',
    )}>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <ChefHat className={cn('h-4 w-4', hasConflict ? 'text-red-500' : hasTight ? 'text-amber-500' : 'text-matcha-600')} />
          <Zap className="h-3 w-3 text-stone-400" />
          <Bike className={cn('h-4 w-4', hasConflict ? 'text-red-500' : hasTight ? 'text-amber-500' : 'text-matcha-600')} />
        </div>
        <span className={cn(
          'text-xs font-black uppercase tracking-wider',
          hasConflict ? 'text-red-700' : hasTight ? 'text-amber-700' : 'text-matcha-700',
        )}>
          Küche ↔ Dispatch · {rows.length}
        </span>
        {hasConflict ? (
          <span className="ml-auto flex items-center gap-1 text-[10px] font-black text-red-600 bg-red-100 border border-red-200 rounded-full px-2 py-0.5">
            <AlertTriangle className="h-2.5 w-2.5" />
            Timing-Konflikt!
          </span>
        ) : (
          <span className="ml-auto flex items-center gap-1 text-[10px] font-bold text-matcha-700 bg-matcha-100 rounded-full px-2 py-0.5">
            <CheckCircle2 className="h-2.5 w-2.5" />
            Synchron
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        {rows.map(({ order, driverName, driverArrivalMin, syncStatus, readyCookMin }) => {
          const style = SYNC_STYLES[syncStatus];
          return (
            <div
              key={order.id}
              className={cn(
                'flex items-center gap-2.5 rounded-xl border px-3 py-2',
                style.bg, style.border,
              )}
            >
              <span className={cn('h-2 w-2 rounded-full shrink-0', style.dot)} />
              <span className="flex-1 min-w-0">
                <span className="text-xs font-black text-stone-800">#{order.bestellnummer}</span>
                <span className="text-[10px] text-stone-500 ml-1 truncate">{order.kunde_name}</span>
              </span>
              {readyCookMin != null && (
                <span className={cn(
                  'flex items-center gap-0.5 text-[10px] font-black tabular-nums shrink-0',
                  readyCookMin <= 2 ? 'text-red-600' : readyCookMin <= 5 ? 'text-amber-600' : 'text-stone-600',
                )}>
                  <ChefHat className="h-2.5 w-2.5" />
                  {readyCookMin}m
                </span>
              )}
              {driverArrivalMin != null && (
                <span className="flex items-center gap-0.5 text-[10px] font-semibold text-stone-500 shrink-0 tabular-nums">
                  <Bike className="h-2.5 w-2.5" />
                  {driverArrivalMin}m
                </span>
              )}
              {driverName && (
                <span className="text-[10px] text-stone-400 shrink-0 max-w-[60px] truncate">{driverName}</span>
              )}
              <span className={cn(
                'shrink-0 text-[9px] font-black rounded-full px-1.5 py-0.5',
                style.text,
                syncStatus === 'on_time' ? 'bg-matcha-100' :
                syncStatus === 'tight'   ? 'bg-amber-100'  : 'bg-red-100',
              )}>
                {style.label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-4 pt-0.5">
        {[
          { dot: 'bg-matcha-500', sub: 'Synchron',   label: '≥ 2 Min Puffer' },
          { dot: 'bg-amber-500',  sub: 'Knapp',       label: '< 2 Min'        },
          { dot: 'bg-red-500',    sub: 'Konflikt',     label: 'Fahrer früher'  },
        ].map(({ dot, sub, label }) => (
          <div key={sub} className="flex items-center gap-1.5">
            <span className={cn('h-1.5 w-1.5 rounded-full', dot)} />
            <span className="text-[8px] text-stone-400">{sub} <span className="text-stone-300">({label})</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}
