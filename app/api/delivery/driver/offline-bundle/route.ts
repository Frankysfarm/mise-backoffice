/**
 * GET /api/delivery/driver/offline-bundle
 *
 * Phase 91 — Offline-Bundle für Fahrer-App Service Worker
 *
 * Liefert alle Daten, die der Fahrer offline braucht:
 *   - Eigenes Profil + Location-ID
 *   - Aktiver Batch (Stops, Kundenadressen, Kontakte)
 *   - Restaurant-Info (Adresse, Koordinaten, Telefon)
 *   - Nächste 2 geplante Schichten
 *
 * Der Service Worker cached diese Route und gibt die gecachte Version
 * zurück wenn kein Netz verfügbar ist (stale-while-revalidate).
 *
 * Auth: Fahrer-Login (mise_drivers.auth_user_id = user.id)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const svc = createServiceClient();

  // ── 1. Fahrer-Profil auflösen ─────────────────────────────────────────
  const { data: driver, error: driverErr } = await svc
    .from('mise_drivers')
    .select('id, name, vehicle, phone, state, location_id, last_lat, last_lng, mise_batch_id')
    .eq('auth_user_id', user.id)
    .single();

  if (driverErr || !driver) {
    return NextResponse.json({ error: 'Kein Fahrer-Profil gefunden' }, { status: 404 });
  }

  // location_id aus employees holen (mise_drivers hat location_id ggf. nicht direkt)
  const { data: emp } = await svc
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .single();

  const locationId = (driver as Record<string, unknown>).location_id as string | null
    ?? emp?.location_id as string | null;

  if (!locationId) {
    return NextResponse.json({ error: 'Keine Location zugewiesen' }, { status: 404 });
  }

  // ── 2. Restaurant-Info ────────────────────────────────────────────────
  const { data: location } = await svc
    .from('locations')
    .select('id, name, adresse, plz, stadt, lat, lng, telefon')
    .eq('id', locationId)
    .single();

  // ── 3. Aktiver Batch + Stops ──────────────────────────────────────────
  let activeBatch: Record<string, unknown> | null = null;

  const batchId = (driver as Record<string, unknown>).mise_batch_id as string | null;
  if (batchId) {
    const { data: batch } = await svc
      .from('mise_delivery_batches')
      .select(`
        id, state, zone, total_distance_km, total_eta_min,
        kitchen_start_at, estimated_pickup_at, estimated_delivery_at,
        stop_count, created_at,
        stops:mise_delivery_batch_stops(
          id, order_id, type, sequence, lat, lng, address,
          order:customer_orders(
            id, bestellnummer, status,
            kunde_name, kunde_telefon, kunde_adresse, kunde_plz, kunde_stadt,
            eta_earliest, eta_latest, gesamtbetrag,
            bezahlmethode, bezahlt
          )
        )
      `)
      .eq('id', batchId)
      .eq('location_id', locationId)
      .single();

    if (batch) {
      activeBatch = batch as Record<string, unknown>;
    }
  }

  // Falls kein batch_id gecacht, aktive Tour aus DB suchen
  if (!activeBatch) {
    const activeStates = ['pending_acceptance', 'assigned', 'at_restaurant', 'on_route'];
    const { data: foundBatch } = await svc
      .from('mise_delivery_batches')
      .select(`
        id, state, zone, total_distance_km, total_eta_min,
        kitchen_start_at, estimated_pickup_at, estimated_delivery_at,
        stop_count, created_at,
        stops:mise_delivery_batch_stops(
          id, order_id, type, sequence, lat, lng, address,
          order:customer_orders(
            id, bestellnummer, status,
            kunde_name, kunde_telefon, kunde_adresse, kunde_plz, kunde_stadt,
            eta_earliest, eta_latest, gesamtbetrag,
            bezahlmethode, bezahlt
          )
        )
      `)
      .eq('driver_id', driver.id)
      .eq('location_id', locationId)
      .in('state', activeStates)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (foundBatch) {
      activeBatch = foundBatch as Record<string, unknown>;
    }
  }

  // ── 4. Nächste 2 Schichten ────────────────────────────────────────────
  const { data: shifts } = await svc
    .from('driver_shifts')
    .select('id, planned_start, planned_end, status')
    .eq('driver_id', driver.id)
    .in('status', ['scheduled', 'active'])
    .gte('planned_start', new Date().toISOString())
    .order('planned_start', { ascending: true })
    .limit(2);

  // ── Antwort zusammenstellen ───────────────────────────────────────────
  const bundle = {
    lastUpdated: new Date().toISOString(),
    driver: {
      id: driver.id,
      name: driver.name,
      vehicle: driver.vehicle,
      phone: driver.phone,
      state: driver.state,
      locationId,
      lastLat: driver.last_lat,
      lastLng: driver.last_lng,
    },
    restaurant: location
      ? {
          id: location.id,
          name: location.name,
          address: [location.adresse, location.plz, location.stadt].filter(Boolean).join(', '),
          lat: location.lat,
          lng: location.lng,
          phone: location.telefon,
        }
      : null,
    activeBatch,
    upcomingShifts: shifts ?? [],
  };

  return NextResponse.json(bundle, {
    headers: {
      // SW kann 5 Minuten aus Cache lesen, danach revalidiert er
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
    },
  });
}
