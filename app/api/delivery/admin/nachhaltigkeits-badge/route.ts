/**
 * GET /api/delivery/admin/nachhaltigkeits-badge?location_id=<uuid>
 *
 * Phase 845 — Liefer-Nachhaltigkeits-Badge
 * CO2-Ersparnis durch Bündelung: Batching-Faktor vs. Einzelfahrten heute.
 * CO2 Einzel: 0.21 kg/km; Bündelung spart (fahrten_einzel - fahrten_gebündelt) * avg_km * 0.21 kg.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

const CO2_PER_KM = 0.21; // kg CO2 per km (petrol car)
const AVG_STOP_KM = 2.5; // average km between stops

export async function GET(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = await createClient();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data: batches } = await sb
    .from('delivery_batches')
    .select('id')
    .eq('location_id', locationId)
    .gte('started_at', todayStart.toISOString());

  const batchIds = (batches ?? []).map((b: any) => b.id);
  const anzahl_touren = batchIds.length;

  let anzahl_stopps = 0;
  if (batchIds.length > 0) {
    const { count } = await sb
      .from('delivery_stops')
      .select('id', { count: 'exact', head: true })
      .in('batch_id', batchIds);
    anzahl_stopps = count ?? 0;
  }

  const einzelfahrten = anzahl_stopps;
  const gebündelte_fahrten = anzahl_touren;
  const eingesparte_fahrten = Math.max(0, einzelfahrten - gebündelte_fahrten);

  const co2_gespart_kg = Math.round(eingesparte_fahrten * AVG_STOP_KM * CO2_PER_KM * 10) / 10;
  const batching_faktor = gebündelte_fahrten > 0
    ? Math.round((anzahl_stopps / gebündelte_fahrten) * 10) / 10
    : 0;

  const baeume_aequivalent = Math.round((co2_gespart_kg / 21) * 10) / 10;

  return NextResponse.json({
    anzahl_touren,
    anzahl_stopps,
    einzelfahrten,
    gebündelte_fahrten,
    eingesparte_fahrten,
    co2_gespart_kg,
    batching_faktor,
    baeume_aequivalent,
    generatedAt: new Date().toISOString(),
  });
}
