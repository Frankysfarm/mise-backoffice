/**
 * GET /api/delivery/admin/touren-replay?driver_id=<uuid>&date=YYYY-MM-DD&location_id=<uuid>
 *
 * Phase 837 — Fahrer-Touren-Replay-API
 * Alle Touren eines Fahrers an einem bestimmten Tag mit Stopps, km, ETA-Delta, Bewertung.
 * Basis für tägliche Nachbesprechung.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const fromQuery = new URL(req.url).searchParams.get('location_id');
  if (fromQuery) return fromQuery;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  return emp?.location_id ?? null;
}

export async function GET(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const driverId = url.searchParams.get('driver_id');
  const dateStr = url.searchParams.get('date') ?? new Date().toISOString().slice(0, 10);

  if (!driverId) return NextResponse.json({ error: 'driver_id required' }, { status: 400 });

  const sb = await createClient();

  // Verify driver belongs to this location
  const { data: driver } = await sb
    .from('employees')
    .select('id, name, location_id')
    .eq('id', driverId)
    .eq('location_id', locationId)
    .maybeSingle();

  if (!driver) return NextResponse.json({ error: 'Driver not found' }, { status: 404 });

  const dayStart = `${dateStr}T00:00:00.000Z`;
  const dayEnd   = `${dateStr}T23:59:59.999Z`;

  // Load batches (tours) for this driver on this date
  const { data: batches } = await sb
    .from('delivery_batches')
    .select('id, started_at, completed_at, created_at, location_id')
    .eq('location_id', locationId)
    .eq('driver_id', driverId)
    .gte('created_at', dayStart)
    .lte('created_at', dayEnd)
    .order('created_at', { ascending: true });

  if (!batches || batches.length === 0) {
    return NextResponse.json({
      fahrer_id: driverId,
      fahrer_name: driver.name,
      datum: dateStr,
      touren: [],
      gesamt: { touren: 0, stopps: 0, km: 0, avg_eta_delta_min: null, avg_bewertung: null },
    });
  }

  const batchIds = batches.map(b => b.id);

  // Load stops for all batches
  const { data: stops } = await sb
    .from('delivery_stops')
    .select('id, batch_id, order_id, position, geliefert_am, created_at, lat, lng')
    .in('batch_id', batchIds)
    .order('position', { ascending: true });

  // Load orders for ETA-Delta and ratings
  const orderIds = (stops ?? []).map(s => s.order_id).filter(Boolean) as string[];
  const { data: orders } = orderIds.length > 0
    ? await sb
        .from('customer_orders')
        .select('id, geschaetzte_zubereitung_min, created_at, fahrer_bewertung, geliefert_am')
        .in('id', orderIds)
    : { data: [] };

  const orderMap = new Map((orders ?? []).map(o => [o.id as string, o]));

  // Build tour summaries
  const touren = batches.map(batch => {
    const batchStops = (stops ?? []).filter(s => s.batch_id === batch.id);

    // Estimate km via haversine between consecutive stops
    let km = 0;
    for (let i = 1; i < batchStops.length; i++) {
      const prev = batchStops[i - 1];
      const curr = batchStops[i];
      if (prev.lat && prev.lng && curr.lat && curr.lng) {
        km += haversineKm(
          prev.lat as number, prev.lng as number,
          curr.lat as number, curr.lng as number,
        );
      }
    }

    // ETA-Delta: tatsächliche Lieferzeit vs. geschätzte
    const etaDeltas: number[] = [];
    const bewertungen: number[] = [];
    for (const stop of batchStops) {
      if (!stop.order_id) continue;
      const order = orderMap.get(stop.order_id as string);
      if (!order) continue;
      if (order.fahrer_bewertung) bewertungen.push(order.fahrer_bewertung as number);
      if (stop.geliefert_am && order.created_at && order.geschaetzte_zubereitung_min) {
        const actualMin = (new Date(stop.geliefert_am as string).getTime() - new Date(order.created_at as string).getTime()) / 60_000;
        const delta = actualMin - (order.geschaetzte_zubereitung_min as number);
        etaDeltas.push(delta);
      }
    }

    const durationMin = batch.started_at && batch.completed_at
      ? Math.round((new Date(batch.completed_at as string).getTime() - new Date(batch.started_at as string).getTime()) / 60_000)
      : null;

    return {
      tour_id: batch.id,
      gestartet: batch.started_at,
      abgeschlossen: batch.completed_at,
      dauer_min: durationMin,
      stopps: batchStops.map((s, i) => {
        const order = s.order_id ? orderMap.get(s.order_id as string) : null;
        const actualMin = (s.geliefert_am && order?.created_at)
          ? Math.round((new Date(s.geliefert_am as string).getTime() - new Date(order.created_at as string).getTime()) / 60_000)
          : null;
        return {
          position: i + 1,
          order_id: s.order_id,
          geliefert_am: s.geliefert_am,
          eta_delta_min: actualMin != null && order?.geschaetzte_zubereitung_min
            ? Math.round(actualMin - (order.geschaetzte_zubereitung_min as number))
            : null,
          bewertung: order?.fahrer_bewertung ?? null,
        };
      }),
      km: Math.round(km * 10) / 10,
      avg_eta_delta_min: etaDeltas.length > 0 ? Math.round(etaDeltas.reduce((a, b) => a + b, 0) / etaDeltas.length) : null,
      avg_bewertung: bewertungen.length > 0 ? Math.round((bewertungen.reduce((a, b) => a + b, 0) / bewertungen.length) * 10) / 10 : null,
    };
  });

  // Gesamt-Aggregat
  const allDeltas = touren.flatMap(t => t.stopps.map(s => s.eta_delta_min).filter((d): d is number => d != null));
  const allBewertungen = touren.flatMap(t => t.stopps.map(s => s.bewertung).filter((b): b is number => b != null));

  return NextResponse.json({
    fahrer_id: driverId,
    fahrer_name: driver.name,
    datum: dateStr,
    touren,
    gesamt: {
      touren: touren.length,
      stopps: touren.reduce((n, t) => n + t.stopps.length, 0),
      km: Math.round(touren.reduce((n, t) => n + t.km, 0) * 10) / 10,
      avg_eta_delta_min: allDeltas.length > 0 ? Math.round(allDeltas.reduce((a, b) => a + b, 0) / allDeltas.length) : null,
      avg_bewertung: allBewertungen.length > 0 ? Math.round((allBewertungen.reduce((a, b) => a + b, 0) / allBewertungen.length) * 10) / 10 : null,
    },
  });
}
