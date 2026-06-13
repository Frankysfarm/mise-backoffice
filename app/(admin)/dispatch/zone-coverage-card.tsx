'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, Bike, AlertTriangle, CheckCircle2, Clock, TrendingUp } from 'lucide-react';

type ZoneCoverageData = {
  zone: string;
  label: string;
  readyOrders: number;
  activeDrivers: number;
  avgWaitMin: number;
  status: 'ok' | 'strained' | 'critical' | 'empty';
};

type Props = {
  readyOrders: {
    id: string;
    delivery_zone: string | null;
    fertig_am: string | null;
    dispatch_score: number | null;
  }[];
  drivers: {
    employee_id: string;
    ist_online: boolean;
    aktueller_batch_id: string | null;
  }[];
  batches: {
    id: string;
    fahrer_id?: string | null;
    driver_id?: string | null;
    status: string;
    zone?: string | null;
    stops: { geliefert_am: string | null }[];
  }[];
};

const ZONE_LABELS: Record<string, string> = {
  A: 'Zone A (nah)',
  B: 'Zone B (mittel)',
  C: 'Zone C (weit)',
  D: 'Zone D (sehr weit)',
  unknown: 'Unbekannte Zone',
};

function computeZones(props: Props): ZoneCoverageData[] {
  const now = Date.now();

  // Count ready orders per zone
  const ordersByZone = new Map<string, { count: number; totalWaitMs: number }>();
  for (const o of props.readyOrders) {
    const zone = o.delivery_zone ?? 'unknown';
    const waitMs = o.fertig_am ? now - new Date(o.fertig_am).getTime() : 0;
    const current = ordersByZone.get(zone) ?? { count: 0, totalWaitMs: 0 };
    ordersByZone.set(zone, { count: current.count + 1, totalWaitMs: current.totalWaitMs + waitMs });
  }

  // Count active drivers per zone (using batch.zone)
  const driverZones = new Map<string, number>(); // zone -> active driver count
  for (const batch of props.batches) {
    if (!['aktiv', 'unterwegs', 'on_route', 'pickup'].includes(batch.status)) continue;
    const zone = (batch as any).zone ?? 'unknown';
    driverZones.set(zone, (driverZones.get(zone) ?? 0) + 1);
  }

  // Free drivers (online, no active batch)
  const freeDriverCount = props.drivers.filter(
    (d) => d.ist_online && !d.aktueller_batch_id,
  ).length;

  const allZones = new Set([
    ...ordersByZone.keys(),
    ...Array.from({ length: 4 }, (_, i) => String.fromCharCode(65 + i)),
  ]);

  const result: ZoneCoverageData[] = [];
  for (const zone of allZones) {
    if (zone === 'unknown' && !ordersByZone.has(zone)) continue;
    const { count: readyOrders = 0, totalWaitMs = 0 } = ordersByZone.get(zone) ?? {};
    const activeDrivers = driverZones.get(zone) ?? 0;
    const avgWaitMin = readyOrders > 0 ? Math.round(totalWaitMs / readyOrders / 60_000) : 0;

    let status: ZoneCoverageData['status'];
    if (readyOrders === 0) status = 'empty';
    else if (activeDrivers === 0 && freeDriverCount === 0) status = 'critical';
    else if (readyOrders > 2 && activeDrivers < readyOrders / 2) status = 'strained';
    else status = 'ok';

    result.push({ zone, label: ZONE_LABELS[zone] ?? `Zone ${zone}`, readyOrders, activeDrivers, avgWaitMin, status });
  }

  return result.sort((a, b) => {
    const priority = { critical: 0, strained: 1, ok: 2, empty: 3 };
    return priority[a.status] - priority[b.status];
  });
}

const STATUS_META = {
  ok:       { label: 'Gedeckt',   bg: 'bg-matcha-50',  border: 'border-matcha-300',  text: 'text-matcha-700',  dot: 'bg-matcha-500' },
  strained: { label: 'Angespannt', bg: 'bg-amber-50',   border: 'border-amber-300',   text: 'text-amber-700',   dot: 'bg-amber-400 animate-pulse' },
  critical: { label: 'Kritisch',  bg: 'bg-red-50',     border: 'border-red-300',     text: 'text-red-700',     dot: 'bg-red-500 animate-pulse' },
  empty:    { label: 'Leer',      bg: 'bg-muted/40',   border: 'border-border',      text: 'text-muted-foreground', dot: 'bg-muted-foreground/40' },
};

export function ZoneCoverageCard(props: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 15_000);
    return () => clearInterval(t);
  }, []);

  const zones = computeZones(props);
  const criticalZones = zones.filter((z) => z.status === 'critical');
  const strainedZones = zones.filter((z) => z.status === 'strained');
  const freeDrivers = props.drivers.filter((d) => d.ist_online && !d.aktueller_batch_id).length;

  if (zones.every((z) => z.status === 'empty') && freeDrivers === 0) return null;

  return (
    <div className="rounded-xl border bg-card p-3 space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="h-3.5 w-3.5 text-matcha-600 shrink-0" />
          <span className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Zonen-Abdeckung
          </span>
        </div>
        <div className="flex items-center gap-2">
          {freeDrivers > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-matcha-100 border border-matcha-300 px-2 py-0.5 text-[10px] font-black text-matcha-700">
              <Bike className="h-2.5 w-2.5" />
              {freeDrivers} frei
            </span>
          )}
          {criticalZones.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 border border-red-300 px-2 py-0.5 text-[10px] font-black text-red-700 animate-pulse">
              <AlertTriangle className="h-2.5 w-2.5" />
              {criticalZones.length} kritisch
            </span>
          )}
        </div>
      </div>

      {/* Alert banner */}
      {criticalZones.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-800">
          ⚠ {criticalZones.map((z) => z.label).join(', ')} ohne Fahrer-Abdeckung —{' '}
          {criticalZones.reduce((s, z) => s + z.readyOrders, 0)} Bestellung{criticalZones.reduce((s, z) => s + z.readyOrders, 0) !== 1 ? 'en' : ''} warten
        </div>
      )}
      {strainedZones.length > 0 && criticalZones.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800">
          {strainedZones.map((z) => z.label).join(', ')} angespannt — mehr Fahrer einplanen
        </div>
      )}

      {/* Zone grid */}
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {zones.map((z) => {
          const meta = STATUS_META[z.status];
          return (
            <div
              key={z.zone}
              className={cn(
                'rounded-xl border px-2.5 py-2 transition-all',
                meta.bg, meta.border,
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] font-black uppercase tracking-wide text-muted-foreground">
                  {z.label}
                </span>
                <span className={cn('h-2 w-2 rounded-full', meta.dot)} />
              </div>

              {z.status === 'empty' ? (
                <div className="text-[10px] text-muted-foreground">Keine Bestellungen</div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <TrendingUp className="h-2.5 w-2.5" />
                      {z.readyOrders} bereit
                    </span>
                    <span className={cn('text-[10px] font-black tabular-nums', meta.text)}>
                      {z.readyOrders}
                    </span>
                  </div>
                  {z.activeDrivers > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Bike className="h-2.5 w-2.5" />
                        aktiv
                      </span>
                      <span className="text-[10px] font-bold tabular-nums text-blue-600">
                        {z.activeDrivers}
                      </span>
                    </div>
                  )}
                  {z.avgWaitMin > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        Ø Warten
                      </span>
                      <span className={cn(
                        'text-[10px] font-bold tabular-nums',
                        z.avgWaitMin > 15 ? 'text-red-600' : z.avgWaitMin > 8 ? 'text-amber-600' : 'text-matcha-600',
                      )}>
                        {z.avgWaitMin}m
                      </span>
                    </div>
                  )}
                  {/* Status label */}
                  <div className={cn(
                    'mt-1 rounded-md px-1.5 py-0.5 text-center text-[8px] font-black uppercase tracking-wide',
                    meta.bg, meta.text,
                  )}>
                    {meta.label}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Free drivers summary */}
      {freeDrivers > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-matcha-50 border border-matcha-200 px-3 py-1.5 text-[11px]">
          <CheckCircle2 className="h-3.5 w-3.5 text-matcha-600 shrink-0" />
          <span className="text-matcha-700 font-semibold">
            {freeDrivers} freier Fahrer kann sofort{' '}
            {criticalZones.length > 0
              ? `Zone ${criticalZones[0].zone} übernehmen`
              : 'dispatcht werden'}
          </span>
        </div>
      )}
    </div>
  );
}
