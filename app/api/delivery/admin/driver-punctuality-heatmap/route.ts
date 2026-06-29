/**
 * GET /api/delivery/admin/driver-punctuality-heatmap?location_id=...&driver_id=...
 *
 * Fahrer-Pünktlichkeits-Heatmap: 7×24 Matrix (Wochentag × Stunde) der Pünktlichkeitsrate.
 * Quelle: mise_delivery_batch_stops (actual_arrival vs. expected_arrival) letzte 30 Tage.
 * Phase 511
 *
 * Response: { ok, drivers: DriverHeatmap[], generatedAt }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface HeatCell {
  dow: number;    // 0=Sonntag, 1=Montag, ..., 6=Samstag
  hour: number;   // 0–23 UTC
  total: number;
  onTime: number;
  pct: number | null;  // null wenn total=0
}

export interface DriverHeatmap {
  driverId: string;
  driverName: string;
  totalDeliveries: number;
  overallPct: number | null;
  cells: HeatCell[];
}

async function resolveLocationId(userId: string): Promise<string | null> {
  const sb = await createClient();
  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', userId)
    .maybeSingle();
  return (emp?.location_id as string) ?? null;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  let locationId = searchParams.get('location_id');
  if (!locationId) locationId = await resolveLocationId(user.id);
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const driverIdFilter = searchParams.get('driver_id');

  const ssb = createServiceClient();
  const now = new Date();
  const since = new Date(now.getTime() - 30 * 24 * 3_600_000);

  // Alle abgeschlossenen Batches in den letzten 30 Tagen für diese Location
  let batchQuery = ssb
    .from('mise_delivery_batches')
    .select('id, driver_id, completed_at')
    .eq('location_id', locationId)
    .in('status', ['completed', 'abgeschlossen', 'delivered'])
    .gte('completed_at', since.toISOString());

  if (driverIdFilter) {
    batchQuery = batchQuery.eq('driver_id', driverIdFilter);
  }

  const { data: batches } = await batchQuery;

  if (!batches || batches.length === 0) {
    return NextResponse.json({ ok: true, drivers: [], generatedAt: now.toISOString() });
  }

  const batchIds = batches.map((b) => b.id as string);
  const driverIds = [...new Set(batches.map((b) => b.driver_id as string).filter(Boolean))];

  // Fahrernamen laden
  const { data: driversData } = await ssb
    .from('mise_drivers')
    .select('id, name')
    .in('id', driverIds);

  const driverNameMap = new Map<string, string>();
  for (const d of driversData ?? []) {
    driverNameMap.set(d.id as string, d.name as string);
  }

  // Stopps mit Pünktlichkeits-Daten
  const { data: stops } = await ssb
    .from('mise_delivery_batch_stops')
    .select('batch_id, arrived_at, expected_arrival_at, status')
    .in('batch_id', batchIds)
    .in('status', ['delivered', 'geliefert', 'completed']);

  // Stopp → Fahrer-ID via Batch
  const batchDriverMap = new Map<string, string>();
  const batchTimeMap = new Map<string, string>();
  for (const b of batches) {
    batchDriverMap.set(b.id as string, b.driver_id as string);
    batchTimeMap.set(b.id as string, b.completed_at as string);
  }

  // Aggregation: driverCells[driverId][dow][hour] = { total, onTime }
  type CellKey = `${number}_${number}`;
  const driverCells = new Map<string, Map<CellKey, { total: number; onTime: number }>>();

  for (const stop of stops ?? []) {
    const dId = batchDriverMap.get(stop.batch_id as string);
    if (!dId) continue;

    const arrivedAt = stop.arrived_at ? new Date(stop.arrived_at as string) : null;
    if (!arrivedAt) continue;

    const dow = arrivedAt.getUTCDay();
    const hour = arrivedAt.getUTCHours();
    const key: CellKey = `${dow}_${hour}`;

    if (!driverCells.has(dId)) driverCells.set(dId, new Map());
    const cellMap = driverCells.get(dId)!;
    if (!cellMap.has(key)) cellMap.set(key, { total: 0, onTime: 0 });

    const cell = cellMap.get(key)!;
    cell.total++;

    // Pünktlich = arrived_at ≤ expected_arrival_at + 5 Min Toleranz
    if (stop.expected_arrival_at) {
      const expectedMs = new Date(stop.expected_arrival_at as string).getTime();
      const arrivedMs = arrivedAt.getTime();
      if (arrivedMs <= expectedMs + 5 * 60_000) {
        cell.onTime++;
      }
    } else {
      // Ohne expected-Zeit als pünktlich zählen
      cell.onTime++;
    }
  }

  const result: DriverHeatmap[] = [];

  for (const dId of driverIds) {
    const cellMap = driverCells.get(dId);
    const cells: HeatCell[] = [];
    let totalAll = 0;
    let onTimeAll = 0;

    for (let dow = 0; dow < 7; dow++) {
      for (let hour = 0; hour < 24; hour++) {
        const key: CellKey = `${dow}_${hour}`;
        const c = cellMap?.get(key);
        const total = c?.total ?? 0;
        const onTime = c?.onTime ?? 0;
        totalAll += total;
        onTimeAll += onTime;
        cells.push({
          dow,
          hour,
          total,
          onTime,
          pct: total > 0 ? Math.round((onTime / total) * 100) : null,
        });
      }
    }

    if (totalAll === 0) continue; // Fahrer ohne Daten überspringen

    result.push({
      driverId: dId,
      driverName: driverNameMap.get(dId) ?? 'Unbekannt',
      totalDeliveries: totalAll,
      overallPct: totalAll > 0 ? Math.round((onTimeAll / totalAll) * 100) : null,
      cells,
    });
  }

  result.sort((a, b) => (b.overallPct ?? 0) - (a.overallPct ?? 0));

  return NextResponse.json({ ok: true, drivers: result, generatedAt: now.toISOString() });
}
