'use client';

import { useEffect, useState } from 'react';
import { Bike, Clock, AlertTriangle, CheckCircle2, ChefHat, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BatchOrder {
  orderId: string;
  bestellnummer: string;
  status: string;
  kunde_name: string;
  prep_min: number | null;
  cook_start_at: string | null;
  ready_target: string | null;
  timing_status: string | null;
}

interface UpcomingBatch {
  batchId: string;
  fahrer: string;
  zone: string | null;
  departureTarget: string | null; // ISO
  orders: BatchOrder[];
}

interface Props {
  locationId: string | null;
}

function secsUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.floor((new Date(iso).getTime() - Date.now()) / 1000);
}

function fmtCountdown(secs: number): string {
  if (secs <= 0) return 'Jetzt!';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m > 99) return `${m} Min`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function urgencyFromSecs(secs: number | null): 'ok' | 'tight' | 'urgent' | 'critical' {
  if (secs === null) return 'ok';
  if (secs <= 0) return 'critical';
  if (secs < 120) return 'urgent';
  if (secs < 300) return 'tight';
  return 'ok';
}

const UrgencyStyle = {
  ok:       { bar: 'bg-matcha-500',  text: 'text-matcha-700',  bg: 'bg-matcha-50 border-matcha-200'   },
  tight:    { bar: 'bg-amber-500',   text: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200'     },
  urgent:   { bar: 'bg-orange-500',  text: 'text-orange-700',  bg: 'bg-orange-50 border-orange-300'   },
  critical: { bar: 'bg-red-500',     text: 'text-red-700',     bg: 'bg-red-50 border-red-400 animate-pulse' },
};

export function KitchenBatchDeparturePanel({ locationId }: Props) {
  const [batches, setBatches] = useState<UpcomingBatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (!locationId) return;
    let mounted = true;

    async function load() {
      setLoading(true);
      try {
        const r = await fetch(
          `/api/delivery/kitchen/batch-departures?location_id=${locationId}`,
        );
        if (!mounted) return;
        if (r.ok) {
          const d = await r.json();
          setBatches(d?.batches ?? []);
        }
      } catch {
        // API may not exist yet – show nothing
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    const poll = setInterval(load, 30_000);
    return () => { mounted = false; clearInterval(poll); };
  }, [locationId]);

  // Only show batches departing within the next 20 minutes
  const relevantBatches = batches.filter((b) => {
    const secs = secsUntil(b.departureTarget);
    return secs === null || secs < 20 * 60;
  });

  if (loading && batches.length === 0) {
    return (
      <div className="rounded-xl border bg-card px-4 py-3 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Batch-Abfahrten werden geladen…
      </div>
    );
  }

  if (relevantBatches.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/30">
        <Bike className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">
          Fahrer-Abfahrten — Zeiten einhalten
        </span>
        <span className="ml-auto rounded-full bg-matcha-100 text-matcha-700 text-[10px] font-bold px-2 py-0.5">
          {relevantBatches.length} anstehend
        </span>
      </div>

      <div className="divide-y divide-border">
        {relevantBatches.map((batch) => {
          const depSecs = secsUntil(batch.departureTarget);
          const urgency = urgencyFromSecs(depSecs);
          const us = UrgencyStyle[urgency];

          const readyOrders = batch.orders.filter(
            (o) => o.status === 'fertig' || o.timing_status === 'ready',
          );
          const cookingOrders = batch.orders.filter(
            (o) => o.status === 'in_zubereitung' || o.timing_status === 'cooking',
          );
          const pendingOrders = batch.orders.filter(
            (o) =>
              o.status !== 'fertig' &&
              o.timing_status !== 'ready' &&
              o.timing_status !== 'cooking',
          );

          const allReady = readyOrders.length === batch.orders.length;

          return (
            <div key={batch.batchId} className={cn('px-4 py-3 space-y-2.5', allReady ? 'opacity-60' : '')}>
              {/* Header row */}
              <div className="flex items-center gap-2">
                <div className={cn('flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold border', us.bg, us.text)}>
                  {urgency === 'critical' || urgency === 'urgent' ? (
                    <AlertTriangle className="h-3 w-3 shrink-0" />
                  ) : (
                    <Clock className="h-3 w-3 shrink-0" />
                  )}
                  {depSecs !== null ? fmtCountdown(depSecs) : 'Bald'}
                </div>

                <span className="text-sm font-bold text-foreground truncate">{batch.fahrer}</span>
                {batch.zone && (
                  <span className="rounded bg-muted border border-border/50 px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">
                    {batch.zone}
                  </span>
                )}

                <div className="ml-auto flex items-center gap-1">
                  <span className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-bold',
                    allReady ? 'bg-matcha-100 text-matcha-700' : 'bg-muted text-muted-foreground',
                  )}>
                    {readyOrders.length}/{batch.orders.length} bereit
                  </span>
                </div>
              </div>

              {/* Order status chips */}
              <div className="flex flex-wrap gap-1.5">
                {batch.orders.map((o) => {
                  const isReady = o.status === 'fertig' || o.timing_status === 'ready';
                  const isCooking = o.status === 'in_zubereitung' || o.timing_status === 'cooking';

                  const orderDepSecs = secsUntil(o.ready_target);
                  const orderUrgency = isReady
                    ? 'done'
                    : isCooking
                    ? urgencyFromSecs(orderDepSecs)
                    : 'pending';

                  return (
                    <div
                      key={o.orderId}
                      className={cn(
                        'flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold border',
                        isReady
                          ? 'bg-matcha-100 border-matcha-300 text-matcha-700'
                          : isCooking
                          ? orderUrgency === 'critical'
                            ? 'bg-red-50 border-red-300 text-red-700 animate-pulse'
                            : orderUrgency === 'urgent'
                            ? 'bg-orange-50 border-orange-300 text-orange-700'
                            : 'bg-amber-50 border-amber-300 text-amber-700'
                          : 'bg-muted border-border text-muted-foreground',
                      )}
                    >
                      {isReady ? (
                        <CheckCircle2 className="h-3 w-3 shrink-0" />
                      ) : isCooking ? (
                        <ChefHat className="h-3 w-3 shrink-0" />
                      ) : (
                        <Clock className="h-3 w-3 shrink-0" />
                      )}
                      <span>#{o.bestellnummer.slice(-4)}</span>
                      {isCooking && orderDepSecs !== null && (
                        <span className="font-mono tabular-nums">
                          {fmtCountdown(orderDepSecs)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Progress bar: orders ready */}
              <div className="h-1 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-500', us.bar)}
                  style={{
                    width: `${batch.orders.length > 0
                      ? (readyOrders.length / batch.orders.length) * 100
                      : 0}%`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
