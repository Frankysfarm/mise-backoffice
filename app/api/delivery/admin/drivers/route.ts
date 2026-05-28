/**
 * GET  /api/delivery/admin/drivers?location_id=...
 * PATCH /api/delivery/admin/drivers?driver_id=...
 *
 * Admin: Fahrer-Management mit Live-Status, aktiver Tour und Position.
 * Gibt alle mise_drivers zurück (systemweit aktiv) mit aggregierten Infos.
 *
 * PATCH: Fahrer aktivieren/deaktivieren oder max_capacity setzen.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  // Alle Fahrer mit aktueller Position + aktivem Batch
  const { data: drivers, error } = await sb
    .from('mise_drivers')
    .select('id, name, telefon, vehicle, state, active, max_radius_km, max_capacity, current_capacity, total_deliveries, last_lat, last_lng, last_position_at')
    .order('state', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!drivers || drivers.length === 0) {
    return NextResponse.json({ drivers: [] });
  }

  const driverIds = drivers.map((d) => d.id as string);

  // Aktive Batches pro Fahrer
  const { data: batches } = await sb
    .from('mise_delivery_batches')
    .select('id, driver_id, state, stop_count, zone, created_at')
    .in('driver_id', driverIds)
    .not('state', 'in', '("completed","cancelled")')
    .order('created_at', { ascending: false });

  // Jüngste GPS-Positionen
  const { data: positions } = await sb
    .from('mise_driver_locations')
    .select('driver_id, lat, lng, heading, speed_kmh, recorded_at')
    .in('driver_id', driverIds)
    .order('recorded_at', { ascending: false });

  // Neueste Position pro Fahrer
  const latestPosition = new Map<
    string,
    { lat: number; lng: number; heading: number | null; speed_kmh: number | null; recorded_at: string; seconds_stale: number }
  >();
  for (const p of positions ?? []) {
    const dId = p.driver_id as string;
    if (!latestPosition.has(dId)) {
      latestPosition.set(dId, {
        lat: p.lat as number,
        lng: p.lng as number,
        heading: p.heading as number | null,
        speed_kmh: p.speed_kmh as number | null,
        recorded_at: p.recorded_at as string,
        seconds_stale: Math.floor(
          (Date.now() - new Date(p.recorded_at as string).getTime()) / 1000,
        ),
      });
    }
  }

  // Aktivster Batch pro Fahrer
  const activeBatch = new Map<
    string,
    { id: string; state: string; stop_count: number; zone: string | null }
  >();
  for (const b of batches ?? []) {
    const dId = b.driver_id as string;
    if (!activeBatch.has(dId)) {
      activeBatch.set(dId, {
        id: b.id as string,
        state: b.state as string,
        stop_count: b.stop_count as number,
        zone: b.zone as string | null,
      });
    }
  }

  const enriched = drivers.map((d) => ({
    ...d,
    live_position: latestPosition.get(d.id as string) ?? null,
    active_batch:  activeBatch.get(d.id as string) ?? null,
  }));

  return NextResponse.json({ drivers: enriched });
}

export async function PATCH(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const driverId = searchParams.get('driver_id');
  if (!driverId) return NextResponse.json({ error: 'driver_id fehlt' }, { status: 400 });

  let body: {
    active?: boolean;
    state?: string;
    max_capacity?: number;
    max_radius_km?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiges JSON' }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (typeof body.active === 'boolean') update.active = body.active;
  if (typeof body.state === 'string') update.state = body.state;
  if (typeof body.max_capacity === 'number' && body.max_capacity > 0) {
    update.max_capacity = body.max_capacity;
  }
  if (typeof body.max_radius_km === 'number' && body.max_radius_km > 0) {
    update.max_radius_km = body.max_radius_km;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Keine Änderungen angegeben' }, { status: 400 });
  }

  const { data, error } = await sb
    .from('mise_drivers')
    .update(update)
    .eq('id', driverId)
    .select('id, name, active, state, max_capacity, max_radius_km')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, driver: data });
}
