'use client';

/**
 * KitchenBatchSyncStrip — Phase 162
 *
 * Zeigt für jede aktive Tour, ob ALLE zugehörigen Bestellungen
 * in der Küche fertig sind — bevor der Fahrer abfährt.
 *
 * ROT    = Tour wartet, mindestens eine Order noch nicht fertig
 * AMBER  = Tour wartet, alle Orders fertig (Fahrer noch nicht da)
 * GRÜN   = Tour abfahrbereit (Fahrer da, alles fertig)
 */

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Bike, CheckCircle2, Clock, Package, Truck, XCircle } from 'lucide-react';

type BatchSync = {
  batchId: string;
  driverName: string;
  vehicle: string | null;
  totalStops: number;
  readyStops: number;
  pendingOrders: { id: string; bestellnummer: string; status: string; kunde_name: string }[];
  startedAt: string | null;
  totalEtaMin: number | null;
};

function useTick(ms = 1000) {
  const [, setT] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setT(n => n + 1), ms);
    return () => clearInterval(iv);
  }, [ms]);
}

export function KitchenBatchSyncStrip({ locationId }: { locationId: string | null }) {
  const supabase = createClient();
  const [syncs, setSyncs] = useState<BatchSync[]>([]);
  const [loading, setLoading] = useState(true);
  useTick(5_000);

  useEffect(() => {
    if (!locationId) { setLoading(false); return; }

    const load = async () => {
      // Aktive Touren: in_transit oder bereit
      const { data: batches } = await supabase
        .from('delivery_batches')
        .select(`
          id, status, started_at, total_eta_min,
          fahrer_id,
          stops:delivery_batch_stops(
            id, order_id, reihenfolge, geliefert_am,
            order:customer_orders(id, bestellnummer, status, kunde_name)
          )
        `)
        .in('status', ['created', 'in_transit'])
        .eq('location_id', locationId)
        .order('started_at', { ascending: true })
        .limit(8);

      if (!batches?.length) { setSyncs([]); setLoading(false); return; }

      const driverIds = [...new Set((batches as any[]).map((b: any) => b.fahrer_id).filter(Boolean))];
      const { data: driverStatuses } = await supabase
        .from('driver_status')
        .select('employee_id, fahrzeug, employee:employees(vorname, nachname)')
        .in('employee_id', driverIds);

      const driverMap = new Map<string, { name: string; vehicle: string | null }>();
      for (const ds of (driverStatuses ?? []) as any[]) {
        driverMap.set(ds.employee_id, {
          name: `${ds.employee?.vorname ?? ''} ${ds.employee?.nachname ?? ''}`.trim(),
          vehicle: ds.fahrzeug ?? null,
        });
      }

      const result: BatchSync[] = [];
      for (const batch of (batches as any[])) {
        const stops = (batch.stops ?? []) as any[];
        const activeStops = stops.filter((s: any) => !s.geliefert_am);
        const pendingOrders = activeStops
          .map((s: any) => s.order)
          .filter(Boolean)
          .filter((o: any) => !['fertig', 'unterwegs', 'geliefert', 'abgeholt'].includes(o.status));

        const driver = driverMap.get(batch.fahrer_id);
        result.push({
          batchId: batch.id,
          driverName: driver?.name ?? 'Unbekannt',
          vehicle: driver?.vehicle ?? null,
          totalStops: activeStops.length,
          readyStops: activeStops.length - pendingOrders.length,
          pendingOrders,
          startedAt: batch.started_at,
          totalEtaMin: batch.total_eta_min,
        });
      }

      setSyncs(result.filter(s => s.totalStops > 0));
      setLoading(false);
    };

    load();
    const iv = setInterval(load, 15_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (loading || syncs.length === 0) return null;

  return (
    <div className="rounded-xl border border-matcha-200 bg-gradient-to-br from-matcha-50 to-white p-3">
      <div className="mb-2.5 flex items-center gap-2">
        <Truck className="h-4 w-4 text-matcha-700" />
        <span className="font-display text-xs font-bold uppercase tracking-wider text-matcha-800">
          Touren-Küchen-Sync · {syncs.length} aktiv
        </span>
      </div>

      <div className="space-y-2">
        {syncs.map(sync => {
          const allReady = sync.pendingOrders.length === 0;
          const pct = sync.totalStops > 0 ? Math.round((sync.readyStops / sync.totalStops) * 100) : 100;

          const stateColor = allReady
            ? 'border-matcha-300 bg-matcha-50'
            : sync.readyStops > 0
              ? 'border-amber-300 bg-amber-50'
              : 'border-red-300 bg-red-50';

          const barColor = allReady ? 'bg-matcha-500' : sync.readyStops > 0 ? 'bg-amber-400' : 'bg-red-400';
          const icon = allReady ? CheckCircle2 : sync.readyStops > 0 ? Clock : XCircle;
          const IconComp = icon;

          return (
            <div key={sync.batchId} className={cn('rounded-lg border p-2.5', stateColor)}>
              <div className="flex items-center gap-2 mb-1.5">
                <IconComp className={cn('h-3.5 w-3.5 shrink-0', allReady ? 'text-matcha-600' : sync.readyStops > 0 ? 'text-amber-600' : 'text-red-600')} />
                <span className="text-[11px] font-bold truncate">
                  {sync.vehicle === 'bike' ? '🚲' : sync.vehicle === 'car' ? '🚗' : '🛵'} {sync.driverName}
                </span>
                <span className="ml-auto text-[10px] font-semibold tabular-nums text-muted-foreground">
                  {sync.readyStops}/{sync.totalStops} fertig
                </span>
              </div>

              {/* Progress bar */}
              <div className="h-1.5 rounded-full bg-black/10 mb-1.5 overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-700', barColor)}
                  style={{ width: `${pct}%` }}
                />
              </div>

              {/* Pending orders */}
              {sync.pendingOrders.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {sync.pendingOrders.map(o => (
                    <span
                      key={o.id}
                      className="inline-flex items-center gap-0.5 rounded bg-white/80 border border-red-200 px-1.5 py-0.5 text-[9px] font-bold text-red-700"
                    >
                      <Package className="h-2.5 w-2.5" />
                      #{o.bestellnummer}
                      <span className="font-normal opacity-70 ml-0.5">{o.status}</span>
                    </span>
                  ))}
                </div>
              )}

              {allReady && (
                <div className="mt-1 text-[10px] font-semibold text-matcha-700 flex items-center gap-1">
                  <Bike className="h-3 w-3" />
                  Alle Bestellungen fertig — Fahrer kann abfahren
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
