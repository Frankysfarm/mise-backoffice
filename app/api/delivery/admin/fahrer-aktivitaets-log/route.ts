/**
 * GET /api/delivery/admin/fahrer-aktivitaets-log?location_id=...&limit=50
 *
 * Phase 523 — Fahrer-Aktivitäts-Protokoll
 * Vollständiges Log aller Fahrer-Events heute:
 * Tour gestartet, Stopp erreicht, Geliefert, Pause.
 *
 * Response: { ok, events: ActivityEvent[], drivers: DriverSummary[], generatedAt }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type EventType = 'tour_started' | 'stop_arrived' | 'stop_delivered' | 'tour_completed' | 'pause' | 'online' | 'offline';

export interface ActivityEvent {
  id: string;
  eventType: EventType;
  driverId: string;
  driverName: string;
  occurredAt: string;
  minutesAgo: number;
  detail: string | null;
  zone: string | null;
  batchId: string | null;
}

export interface DriverSummary {
  driverId: string;
  driverName: string;
  eventCount: number;
  deliveries: number;
  toursStarted: number;
  lastSeen: string | null;
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

  const limitParam = Math.min(200, Math.max(10, parseInt(searchParams.get('limit') ?? '60', 10)));

  const ssb = createServiceClient();
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  // Fahrer für Location laden
  const { data: driverRows } = await ssb
    .from('delivery_drivers')
    .select('id, name')
    .eq('location_id', locationId);

  const drivers = (driverRows ?? []) as { id: string; name: string }[];
  const driverMap = new Map<string, string>(drivers.map((d) => [d.id, d.name]));

  // Batches heute
  const { data: batchRows } = await ssb
    .from('mise_delivery_batches')
    .select('id, driver_id, zone, status, startzeit, abgeschlossen_am, created_at')
    .eq('location_id', locationId)
    .gte('created_at', todayStart.toISOString())
    .order('startzeit', { ascending: false })
    .limit(100);

  const batches = (batchRows ?? []) as {
    id: string;
    driver_id: string | null;
    zone: string | null;
    status: string;
    startzeit: string | null;
    abgeschlossen_am: string | null;
    created_at: string;
  }[];

  // Stopp-Events heute
  const { data: stopRows } = await ssb
    .from('mise_delivery_batch_stops')
    .select('id, batch_id, angekommen_am, geliefert_am, expected_arrival_at, order_id')
    .in('batch_id', batches.map((b) => b.id))
    .or('angekommen_am.gte.' + todayStart.toISOString() + ',geliefert_am.gte.' + todayStart.toISOString());

  const stops = (stopRows ?? []) as {
    id: string;
    batch_id: string;
    angekommen_am: string | null;
    geliefert_am: string | null;
    expected_arrival_at: string | null;
    order_id: string | null;
  }[];

  const batchById = new Map(batches.map((b) => [b.id, b]));

  const events: ActivityEvent[] = [];

  // Tour-Start Events
  for (const b of batches) {
    if (b.startzeit && b.driver_id) {
      const ts = new Date(b.startzeit);
      events.push({
        id: `tour-start-${b.id}`,
        eventType: 'tour_started',
        driverId: b.driver_id,
        driverName: driverMap.get(b.driver_id) ?? 'Unbekannt',
        occurredAt: b.startzeit,
        minutesAgo: Math.round((now.getTime() - ts.getTime()) / 60_000),
        detail: b.zone ? `Zone ${b.zone}` : null,
        zone: b.zone,
        batchId: b.id,
      });
    }
    if (b.abgeschlossen_am && b.driver_id) {
      const ts = new Date(b.abgeschlossen_am);
      events.push({
        id: `tour-end-${b.id}`,
        eventType: 'tour_completed',
        driverId: b.driver_id,
        driverName: driverMap.get(b.driver_id) ?? 'Unbekannt',
        occurredAt: b.abgeschlossen_am,
        minutesAgo: Math.round((now.getTime() - ts.getTime()) / 60_000),
        detail: b.zone ? `Zone ${b.zone} abgeschlossen` : 'Tour abgeschlossen',
        zone: b.zone,
        batchId: b.id,
      });
    }
  }

  // Stopp-Events
  for (const s of stops) {
    const batch = batchById.get(s.batch_id);
    if (!batch?.driver_id) continue;
    const driverName = driverMap.get(batch.driver_id) ?? 'Unbekannt';

    if (s.angekommen_am) {
      const ts = new Date(s.angekommen_am);
      events.push({
        id: `stop-arrive-${s.id}`,
        eventType: 'stop_arrived',
        driverId: batch.driver_id,
        driverName,
        occurredAt: s.angekommen_am,
        minutesAgo: Math.round((now.getTime() - ts.getTime()) / 60_000),
        detail: batch.zone ? `Zone ${batch.zone}` : null,
        zone: batch.zone,
        batchId: s.batch_id,
      });
    }
    if (s.geliefert_am) {
      const ts = new Date(s.geliefert_am);
      events.push({
        id: `stop-deliver-${s.id}`,
        eventType: 'stop_delivered',
        driverId: batch.driver_id,
        driverName,
        occurredAt: s.geliefert_am,
        minutesAgo: Math.round((now.getTime() - ts.getTime()) / 60_000),
        detail: batch.zone ? `Zone ${batch.zone} · Bestellung geliefert` : 'Bestellung geliefert',
        zone: batch.zone,
        batchId: s.batch_id,
      });
    }
  }

  // Sortierung: neueste zuerst
  events.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  const sliced = events.slice(0, limitParam);

  // Driver Summaries
  const driverSummaryMap = new Map<string, DriverSummary>();
  for (const ev of events) {
    if (!driverSummaryMap.has(ev.driverId)) {
      driverSummaryMap.set(ev.driverId, {
        driverId: ev.driverId,
        driverName: ev.driverName,
        eventCount: 0,
        deliveries: 0,
        toursStarted: 0,
        lastSeen: null,
      });
    }
    const ds = driverSummaryMap.get(ev.driverId)!;
    ds.eventCount++;
    if (ev.eventType === 'stop_delivered') ds.deliveries++;
    if (ev.eventType === 'tour_started') ds.toursStarted++;
    if (!ds.lastSeen || ev.occurredAt > ds.lastSeen) ds.lastSeen = ev.occurredAt;
  }
  const driverSummaries = Array.from(driverSummaryMap.values())
    .sort((a, b) => b.deliveries - a.deliveries);

  return NextResponse.json({
    ok: true,
    events: sliced,
    drivers: driverSummaries,
    generatedAt: now.toISOString(),
  });
}
