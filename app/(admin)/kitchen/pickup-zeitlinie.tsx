'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, CheckCircle2, AlertTriangle, Bike, Timer, Flame } from 'lucide-react';

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  typ: string;
  kunde_name: string;
  fertig_am?: string | null;
  fertig_am_str?: string | null;
};

type Batch = {
  id: string;
  status: string;
  fahrer_id: string | null;
  startzeit?: string | null;
  total_eta_min?: number | null;
  fahrer?: { vorname: string; nachname: string } | null;
  stops: {
    id: string;
    order_id: string;
    reihenfolge: number;
    geliefert_am: string | null;
  }[];
};

interface Props {
  orders: Order[];
  batches: Batch[];
}

function useSecondTick() {
  const [, set] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => set(n => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);
}

function waitMinutes(fertigAm: string | null | undefined): number {
  if (!fertigAm) return 0;
  return Math.floor((Date.now() - new Date(fertigAm).getTime()) / 60_000);
}

function urgencyColor(waitMin: number, hasDriver: boolean) {
  if (!hasDriver) return 'border-red-500/60 bg-red-500/10';
  if (waitMin >= 8) return 'border-red-400/60 bg-red-400/10';
  if (waitMin >= 3) return 'border-amber-400/60 bg-amber-400/10';
  return 'border-emerald-400/60 bg-emerald-400/10';
}

function urgencyText(waitMin: number, hasDriver: boolean) {
  if (!hasDriver) return 'text-red-400';
  if (waitMin >= 8) return 'text-red-400';
  if (waitMin >= 3) return 'text-amber-400';
  return 'text-emerald-400';
}

function urgencyIcon(waitMin: number, hasDriver: boolean) {
  if (!hasDriver) return AlertTriangle;
  if (waitMin >= 8) return Flame;
  if (waitMin >= 3) return Timer;
  return CheckCircle2;
}

export function KitchenPickupZeitlinie({ orders, batches }: Props) {
  useSecondTick();

  const readyOrders = orders.filter(o =>
    o.status === 'fertig' && o.typ === 'lieferung',
  );

  if (readyOrders.length === 0) return null;

  const orderBatchMap = new Map<string, Batch>();
  for (const batch of batches) {
    for (const stop of batch.stops) {
      if (!stop.geliefert_am) {
        orderBatchMap.set(stop.order_id, batch);
      }
    }
  }

  const enriched = readyOrders
    .map(order => {
      const fertigAt = (order.fertig_am ?? order.fertig_am_str) as string | null;
      const waitMin = waitMinutes(fertigAt);
      const batch = orderBatchMap.get(order.id) ?? null;
      const hasDriver = batch != null && batch.fahrer_id != null;
      const driverName = batch?.fahrer ? `${batch.fahrer.vorname} ${batch.fahrer.nachname[0]}.` : null;
      const etaMin = batch?.startzeit && batch?.total_eta_min != null
        ? Math.max(0, Math.ceil((new Date(batch.startzeit).getTime() + batch.total_eta_min * 60_000 - Date.now()) / 60_000))
        : null;
      return { order, waitMin, batch, hasDriver, driverName, etaMin, fertigAt };
    })
    .sort((a, b) => b.waitMin - a.waitMin);

  const maxWait = Math.max(...enriched.map(e => e.waitMin), 1);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
        <Clock size={14} className="text-muted-foreground" />
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Abholungs-Zeitlinie
        </span>
        <span className="ml-auto rounded-full bg-amber-500/20 text-amber-600 px-2 py-0.5 text-[10px] font-black">
          {readyOrders.length} Fertig
        </span>
      </div>

      {/* Timeline */}
      <div className="p-3 space-y-2">
        {enriched.map(({ order, waitMin, hasDriver, driverName, etaMin, fertigAt }) => {
          const Icon = urgencyIcon(waitMin, hasDriver);
          const widthPct = maxWait > 0 ? Math.min(100, (waitMin / maxWait) * 100) : 0;
          return (
            <div
              key={order.id}
              className={cn(
                'rounded-lg border px-3 py-2 transition-all',
                urgencyColor(waitMin, hasDriver),
              )}
            >
              <div className="flex items-center gap-2">
                <Icon size={13} className={cn('shrink-0', urgencyText(waitMin, hasDriver))} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold text-foreground truncate">
                        {order.kunde_name}
                      </span>
                      <span className="text-[10px] text-muted-foreground ml-1.5">
                        #{order.bestellnummer}
                      </span>
                    </div>
                    <span className={cn('text-xs font-black tabular-nums shrink-0', urgencyText(waitMin, hasDriver))}>
                      {waitMin === 0 ? 'Gerade fertig' : `${waitMin} Min`}
                    </span>
                  </div>

                  {/* Wartezeit-Balken */}
                  <div className="mt-1 h-1 rounded-full bg-black/10 overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-700',
                        !hasDriver ? 'bg-red-500' :
                        waitMin >= 8 ? 'bg-red-400' :
                        waitMin >= 3 ? 'bg-amber-400' : 'bg-emerald-400',
                      )}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>

                  {/* Driver info or warning */}
                  <div className="mt-1 flex items-center gap-2">
                    {hasDriver ? (
                      <>
                        <Bike size={10} className="text-muted-foreground shrink-0" />
                        <span className="text-[10px] text-muted-foreground">
                          {driverName ?? 'Fahrer zugewiesen'}
                          {etaMin != null && ` · Abholung in ~${etaMin} Min`}
                        </span>
                      </>
                    ) : (
                      <span className="text-[10px] font-bold text-red-500">
                        Kein Fahrer zugewiesen!
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary Footer */}
      <div className="px-4 py-2 border-t bg-muted/20 flex items-center gap-4 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
          Frisch (&lt;3 Min)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
          Warm (3–8 Min)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-red-400" />
          Kritisch (&gt;8 Min)
        </span>
      </div>
    </div>
  );
}
