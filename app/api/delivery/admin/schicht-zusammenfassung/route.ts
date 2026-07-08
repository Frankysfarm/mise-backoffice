/**
 * GET /api/delivery/admin/schicht-zusammenfassung?driver_id=<uuid>&location_id=<uuid>
 *
 * Phase 844 — Schicht-Zusammenfassung für Fahrer
 * Kompakte Endabrechnung: Touren, km, Einnahmen, Ø-Bewertung, Stornos.
 * Wird beim Abmelden (is_online=false) angezeigt.
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
  if (!driverId) return NextResponse.json({ error: 'driver_id required' }, { status: 400 });

  const sb = await createClient();

  const { data: driver } = await sb
    .from('employees')
    .select('id, location_id')
    .eq('id', driverId)
    .eq('location_id', locationId)
    .maybeSingle();

  if (!driver) return NextResponse.json({ error: 'Driver not found' }, { status: 404 });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data: batches } = await sb
    .from('delivery_batches')
    .select('id, started_at, abgeschlossen_am, status')
    .eq('location_id', locationId)
    .or(`fahrer_id.eq.${driverId},driver_id.eq.${driverId}`)
    .gte('started_at', todayStart.toISOString());

  const batchIds = (batches ?? []).map((b: any) => b.id);
  const touren = batchIds.length;

  let stopps = 0;
  let km = 0;
  let stornos = 0;

  if (batchIds.length > 0) {
    const { data: stops } = await sb
      .from('delivery_stops')
      .select('id, lat, lng, geliefert_am, reihenfolge')
      .in('batch_id', batchIds)
      .order('batch_id')
      .order('reihenfolge');

    const batchStops: Record<string, { lat: number | null; lng: number | null }[]> = {};
    for (const s of stops ?? []) {
      const bid = (s as any).batch_id ?? 'unknown';
      if (!batchStops[bid]) batchStops[bid] = [];
      batchStops[bid].push({ lat: (s as any).lat ?? null, lng: (s as any).lng ?? null });
      if ((s as any).geliefert_am) stopps++;
    }

    for (const pts of Object.values(batchStops)) {
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1];
        const b = pts[i];
        if (a.lat && a.lng && b.lat && b.lng) {
          km += haversineKm(a.lat, a.lng, b.lat, b.lng);
        }
      }
    }

    const { count } = await sb
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', locationId)
      .eq('status', 'storniert')
      .gte('created_at', todayStart.toISOString());

    stornos = count ?? 0;
  }

  const { data: shift } = await sb
    .from('driver_shifts')
    .select('started_at, ended_at')
    .eq('driver_id', driverId)
    .eq('location_id', locationId)
    .gte('started_at', todayStart.toISOString())
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let schicht_dauer_min = 0;
  if (shift?.started_at) {
    const start = new Date(shift.started_at).getTime();
    const end = shift?.ended_at ? new Date(shift.ended_at).getTime() : Date.now();
    schicht_dauer_min = Math.round((end - start) / 60000);
  }

  const { data: ratings } = await sb
    .from('driver_ratings')
    .select('rating')
    .eq('driver_id', driverId)
    .gte('created_at', todayStart.toISOString());

  const ratingVals = (ratings ?? []).map((r: any) => r.rating).filter((v: unknown) => typeof v === 'number');
  const avg_bewertung = ratingVals.length > 0
    ? Math.round((ratingVals.reduce((a: number, b: number) => a + b, 0) / ratingVals.length) * 10) / 10
    : null;

  const { data: payRows } = await sb
    .from('driver_payments')
    .select('betrag, typ')
    .eq('driver_id', driverId)
    .gte('created_at', todayStart.toISOString());

  let einnahmen = 0;
  let trinkgeld = 0;
  for (const p of payRows ?? []) {
    if ((p as any).typ === 'trinkgeld') trinkgeld += (p as any).betrag ?? 0;
    else einnahmen += (p as any).betrag ?? 0;
  }

  return NextResponse.json({
    touren,
    stopps,
    km: Math.round(km * 10) / 10,
    einnahmen: Math.round(einnahmen * 100) / 100,
    trinkgeld: Math.round(trinkgeld * 100) / 100,
    avg_bewertung,
    stornos,
    schicht_dauer_min,
    generatedAt: new Date().toISOString(),
  });
}
