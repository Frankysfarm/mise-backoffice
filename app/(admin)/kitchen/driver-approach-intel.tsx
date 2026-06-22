'use client';

/**
 * DriverApproachIntel — Phase 410
 * Zeigt Fahrer, die in den nächsten 5/10/15 Min an der Küche ankommen werden.
 * Hilft der Küche, Bestellungen rechtzeitig fertigzustellen.
 * API: /api/delivery/admin/tours?action=active&location_id=...
 */

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Clock, Navigation, Truck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ApproachingDriver {
  batchId: string;
  driverName: string | null;
  vehicle: string | null;
  etaToKitchenMin: number | null;
  ordersInBatch: number;
  batchState: string;
}

function urgencyColor(eta: number | null): string {
  if (eta === null) return 'text-muted-foreground';
  if (eta <= 3)  return 'text-red-600 font-bold';
  if (eta <= 8)  return 'text-amber-600 font-semibold';
  return 'text-matcha-700';
}

function urgencyBg(eta: number | null): string {
  if (eta === null) return '';
  if (eta <= 3)  return 'bg-red-50 border-red-200';
  if (eta <= 8)  return 'bg-amber-50 border-amber-200';
  return 'bg-matcha-50 border-matcha-200';
}

export function DriverApproachIntel({ locationId }: { locationId: string | null }) {
  const [drivers, setDrivers] = useState<ApproachingDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen]       = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load() {
    if (!locationId) { setLoading(false); return; }
    try {
      const res = await fetch(
        `/api/delivery/admin/tours?action=active&location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (!res.ok) { setLoading(false); return; }
      const json = await res.json();
      const batches: Record<string, unknown>[] = Array.isArray(json.batches)
        ? json.batches
        : Array.isArray(json.tours)
        ? json.tours
        : [];

      const approaching: ApproachingDriver[] = batches
        .filter((b) => {
          const state = b.state as string | undefined;
          return state === 'assigned' || state === 'pending_acceptance' || state === 'at_restaurant';
        })
        .map((b) => ({
          batchId:         b.id as string,
          driverName:      (b.driver_name as string | null) ?? null,
          vehicle:         (b.vehicle as string | null) ?? null,
          etaToKitchenMin: (b.eta_to_kitchen_min as number | null)
                           ?? (b.kitchen_eta_min as number | null)
                           ?? null,
          ordersInBatch:   (b.stop_count as number | undefined) ?? (b.orders as number | undefined) ?? 1,
          batchState:      b.state as string,
        }))
        .sort((a, b) => {
          if (a.etaToKitchenMin === null) return 1;
          if (b.etaToKitchenMin === null) return -1;
          return a.etaToKitchenMin - b.etaToKitchenMin;
        })
        .slice(0, 8);

      setDrivers(approaching);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 20_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const imminent = drivers.filter((d) => d.etaToKitchenMin !== null && d.etaToKitchenMin <= 5).length;

  return (
    <Card className={cn('overflow-hidden', imminent > 0 && 'border-amber-300')}>
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex w-full items-center gap-2 border-b px-4 py-2.5 text-left"
      >
        <Navigation className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Fahrer-Ankunft Intel</span>
        {imminent > 0 && (
          <Badge className="ml-1 bg-amber-400 text-white text-[10px]">{imminent} in &lt;5 Min</Badge>
        )}
        {drivers.length > 0 && imminent === 0 && (
          <Badge variant="secondary" className="ml-1 text-[10px]">{drivers.length} aktiv</Badge>
        )}
        <ChevronDown className={cn('ml-auto h-4 w-4 transition-transform text-muted-foreground', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="p-3 space-y-2">
          {loading && <div className="text-xs text-muted-foreground py-3 text-center">Lade…</div>}

          {!loading && drivers.length === 0 && (
            <div className="text-xs text-muted-foreground py-3 text-center">
              Keine Fahrer unterwegs zur Küche
            </div>
          )}

          {!loading && drivers.map((d) => (
            <div
              key={d.batchId}
              className={cn('rounded-lg border px-3 py-2 flex items-center gap-3', urgencyBg(d.etaToKitchenMin))}
            >
              <Truck className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold truncate">
                  {d.driverName ?? 'Fahrer'}
                  {d.vehicle && (
                    <span className="ml-1 text-[10px] text-muted-foreground capitalize">· {d.vehicle}</span>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {d.ordersInBatch} Bestellung{d.ordersInBatch !== 1 ? 'en' : ''}
                  {' '}· {d.batchState === 'at_restaurant' ? 'Am Restaurant' : 'Unterwegs'}
                </div>
              </div>
              <div className={cn('text-sm tabular-nums', urgencyColor(d.etaToKitchenMin))}>
                {d.etaToKitchenMin !== null ? (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {d.etaToKitchenMin <= 0 ? 'da' : `${d.etaToKitchenMin} Min`}
                  </span>
                ) : (
                  <span className="text-muted-foreground text-[10px]">?</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
