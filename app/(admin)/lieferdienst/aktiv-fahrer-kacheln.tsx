'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bike, Car, Clock, MapPin, Package, CheckCircle2, Wifi, WifiOff, Route } from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EmployeeRow = {
  id: string;
  vorname: string;
  nachname: string;
  avatar_url: string | null;
};

type DriverStatusRow = {
  employee_id: string;
  ist_online: boolean;
  fahrzeug: string | null;
  aktueller_batch_id: string | null;
  last_lat: number | null;
  last_lng: number | null;
  last_update: string | null;
  online_seit: string | null;
  employee: EmployeeRow | null;
};

type BatchStop = {
  id: string;
  geliefert_am: string | null;
};

type BatchRow = {
  id: string;
  status: string;
  total_eta_min: number | null;
  started_at: string | null;
  stops: BatchStop[];
};

type DriverWithBatch = DriverStatusRow & {
  batch: BatchRow | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns minutes since the given ISO timestamp, or null if missing. */
function minutesSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
}

/** GPS freshness indicator based on minutes since last update. */
function gpsFreshness(lastUpdate: string | null): 'fresh' | 'stale' | 'offline' {
  const mins = minutesSince(lastUpdate);
  if (mins === null) return 'offline';
  if (mins < 5) return 'fresh';
  if (mins <= 15) return 'stale';
  return 'offline';
}

function driverDisplayName(emp: EmployeeRow | null, fallbackId: string): string {
  if (!emp) return fallbackId.slice(0, 8);
  return `${emp.vorname} ${emp.nachname}`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function GpsDot({ freshness }: { freshness: 'fresh' | 'stale' | 'offline' }) {
  return (
    <span
      className={cn(
        'inline-block h-2.5 w-2.5 rounded-full flex-shrink-0',
        freshness === 'fresh' && 'bg-emerald-500',
        freshness === 'stale' && 'bg-amber-400',
        freshness === 'offline' && 'bg-red-500',
      )}
      title={
        freshness === 'fresh'
          ? 'GPS aktuell (< 5 min)'
          : freshness === 'stale'
          ? 'GPS veraltet (5–15 min)'
          : 'GPS offline (> 15 min)'
      }
    />
  );
}

function VehicleIcon({ fahrzeug }: { fahrzeug: string | null }) {
  const isBike = fahrzeug === 'fahrrad' || fahrzeug === 'bike';
  const Icon = isBike ? Bike : Car;
  return <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />;
}

function DriverTile({ driver }: { driver: DriverWithBatch }) {
  const { employee, fahrzeug, last_update, batch } = driver;
  const freshness = gpsFreshness(last_update);
  const lastPingMin = minutesSince(last_update);
  const hasActiveBatch = batch !== null;

  const remainingStops = batch
    ? batch.stops.filter((s) => s.geliefert_am === null).length
    : 0;

  const totalStops = batch ? batch.stops.length : 0;

  return (
    <Card className="flex flex-col gap-0 overflow-hidden border border-border/60 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-3 flex flex-col gap-2">
        {/* Top row: name + vehicle + GPS dot */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <VehicleIcon fahrzeug={fahrzeug} />
            <span className="text-sm font-semibold leading-tight truncate">
              {driverDisplayName(employee, driver.employee_id)}
            </span>
          </div>
          <GpsDot freshness={freshness} />
        </div>

        {/* Status badge */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {hasActiveBatch ? (
            <Badge
              className="text-xs bg-blue-100 text-blue-800 border-blue-200 border"
              variant="outline"
            >
              <Route className="h-3 w-3 mr-1" />
              Unterwegs
            </Badge>
          ) : (
            <Badge
              className="text-xs bg-emerald-100 text-emerald-800 border-emerald-200 border"
              variant="outline"
            >
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Verfügbar
            </Badge>
          )}
        </div>

        {/* Batch details */}
        {hasActiveBatch && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1">
              <Package className="h-3 w-3 flex-shrink-0" />
              {remainingStops}/{totalStops} Stops
            </span>
            {batch!.total_eta_min !== null && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3 flex-shrink-0" />
                ~{batch!.total_eta_min} min
              </span>
            )}
          </div>
        )}

        {/* Last GPS ping */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {freshness === 'offline' ? (
            <WifiOff className="h-3 w-3 flex-shrink-0 text-red-400" />
          ) : (
            <Wifi className="h-3 w-3 flex-shrink-0 text-emerald-500" />
          )}
          <span>
            {lastPingMin === null
              ? 'Kein GPS'
              : lastPingMin === 0
              ? 'Gerade eben'
              : `Vor ${lastPingMin} min`}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AktivFahrerKacheln({ locationId }: { locationId: string | null }) {
  const supabase = createClient();
  const [drivers, setDrivers] = useState<DriverWithBatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDrivers = useCallback(async () => {
    if (!locationId) {
      setDrivers([]);
      return;
    }

    try {
      // Fetch online drivers with employee info
      const { data: statusRows, error: statusErr } = await supabase
        .from('driver_status')
        .select(`
          employee_id, ist_online, fahrzeug, aktueller_batch_id, last_lat, last_lng, last_update, online_seit,
          employee:employees(id, vorname, nachname, avatar_url)
        `)
        .eq('ist_online', true)
        .eq('location_id', locationId);

      if (statusErr) throw statusErr;
      if (!statusRows?.length) {
        setDrivers([]);
        setError(null);
        return;
      }

      // Collect batch IDs that are actually set
      const batchIds = statusRows
        .map((r: any) => r.aktueller_batch_id)
        .filter((id: string | null): id is string => !!id);

      let batchMap = new Map<string, BatchRow>();

      if (batchIds.length > 0) {
        const { data: batches, error: batchErr } = await supabase
          .from('delivery_batches')
          .select('id, status, total_eta_min, started_at, stops:batch_stops(id, geliefert_am)')
          .in('id', batchIds)
          .in('status', ['unterwegs', 'on_route', 'assigned']);

        if (batchErr) {
          // Non-fatal: show drivers without batch info
          console.warn('[AktivFahrerKacheln] batch fetch error:', batchErr.message);
        } else {
          for (const b of (batches ?? []) as BatchRow[]) {
            batchMap.set(b.id, b);
          }
        }
      }

      const driversWithBatch: DriverWithBatch[] = (statusRows as DriverStatusRow[]).map((row) => ({
        ...row,
        batch: row.aktueller_batch_id ? (batchMap.get(row.aktueller_batch_id) ?? null) : null,
      }));

      setDrivers(driversWithBatch);
      setError(null);
    } catch (err: any) {
      console.error('[AktivFahrerKacheln] fetch error:', err);
      setError('Fahrerdaten konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [locationId, supabase]);

  useEffect(() => {
    setLoading(true);
    fetchDrivers();

    const interval = setInterval(fetchDrivers, 15_000);
    return () => clearInterval(interval);
  }, [fetchDrivers]);

  const totalOnline = drivers.length;
  const activeTouren = drivers.filter((d) => d.batch !== null).length;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-3">
      {/* Summary header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-sm font-semibold text-foreground">Aktive Fahrer</h2>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            {totalOnline} Fahrer online
          </span>
          <span className="text-border">·</span>
          <span className="flex items-center gap-1">
            <Route className="h-3 w-3" />
            {activeTouren} aktive Touren
          </span>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && drivers.length === 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="border border-border/40">
              <CardContent className="p-3 flex flex-col gap-2">
                <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && drivers.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-10 text-center">
          <Bike className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">Keine Fahrer aktiv</p>
          <p className="text-xs text-muted-foreground/70">
            {locationId ? 'Aktuell ist kein Fahrer online.' : 'Kein Standort ausgewählt.'}
          </p>
        </div>
      )}

      {/* Driver tile grid */}
      {drivers.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {drivers.map((driver) => (
            <DriverTile key={driver.employee_id} driver={driver} />
          ))}
        </div>
      )}
    </div>
  );
}
